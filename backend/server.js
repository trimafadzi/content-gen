/**
 * StoryBOARD GEN — Backend Proxy Server
 * v3.7.0 — Security hardening (rate limiting, CORS whitelist, FFmpeg sanitization,
 *           temp file auto-cleanup, Helmet security headers)
 *
 * Routes:
 *   POST /api/llm/generate    — Proxy LLM requests to various providers
 *   POST /api/image/generate  — Proxy image generation requests
 *   POST /api/tts/generate    — Text-to-Speech via Google TTS
 *   POST /api/video/assemble  — FFmpeg video assembly pipeline
 *   GET  /api/health          — Health check
 *   GET  /                    — Serve frontend
 */

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const googleTTS  = require('google-tts-api');

const app  = express();
const PORT = process.env.PORT || 3456;

// Create temp directory for saving TTS/video files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ─── SEC-05: SECURITY HEADERS (Helmet) ────────────────────────
// CSP disabled — frontend uses inline scripts & CDN resources
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// ─── SEC-02: CORS WHITELIST ────────────────────────────────────
// Allow localhost development + any ALLOWED_ORIGINS env var for production
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || [
  'http://localhost:3456',
  'http://127.0.0.1:3456',
  'http://localhost:8080',
  'http://localhost:5500'
].join(',')).split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin server calls)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from: ${origin}`);
      callback(new Error(`CORS policy: origin "${origin}" not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

// ─── SEC-01: RATE LIMITING ─────────────────────────────────────
const llmLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded: max 20 LLM requests/minute. Try again shortly.' }
});

const imgLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded: max 10 image requests/minute.' }
});

const videoLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded: max 5 video assembly requests/minute.' }
});

const ttsLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded: max 30 TTS requests/minute.' }
});

// Apply rate limiters to API routes
app.use('/api/llm/generate',   llmLimiter);
app.use('/api/image/generate', imgLimiter);
app.use('/api/video/assemble', videoLimiter);
app.use('/api/tts/generate',   ttsLimiter);

// ─── SEC-03: FFMPEG INPUT SANITIZER ───────────────────────────
/**
 * Sanitize text before embedding into FFmpeg drawtext filter.
 * Strips shell metacharacters that could cause command injection.
 */
function sanitizeForFFmpeg(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\\':]/g, ' ')           // strip shell-dangerous chars: \ ' :
    .replace(/[\n\r]+/g, ' ')          // flatten newlines
    .replace(/[^\w\s.,!?()\-–—%&@#]/g, '') // keep only safe printable chars
    .replace(/\s{2,}/g, ' ')           // collapse multiple spaces
    .trim()
    .substring(0, 500);                // cap length to prevent abuse
}

// ─── SEC-04: TEMP FILE AUTO-CLEANUP ───────────────────────────
const TEMP_VIDEO_MAX_AGE_MS = 60 * 60 * 1000;      // 1 hour for assembled videos
const TEMP_TTS_MAX_AGE_MS   = 24 * 60 * 60 * 1000; // 24 hours for TTS MP3 cache

function cleanupTempFiles() {
  const now = Date.now();
  let cleaned = 0;
  try {
    const files = fs.readdirSync(tempDir);
    for (const filename of files) {
      const filePath = path.join(tempDir, filename);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }
      const age = now - stat.mtimeMs;
      if (filename.startsWith('vid_') && age > TEMP_VIDEO_MAX_AGE_MS) {
        fs.unlinkSync(filePath); cleaned++;
      } else if (filename.startsWith('tts_') && age > TEMP_TTS_MAX_AGE_MS) {
        fs.unlinkSync(filePath); cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Cleanup] 🗑️  Removed ${cleaned} stale temp file(s)`);
    }
  } catch (err) {
    console.error('[Cleanup] ❌ Error during cleanup:', err.message);
  }
}

// Run cleanup on startup, then every 15 minutes
cleanupTempFiles();
setInterval(cleanupTempFiles, 15 * 60 * 1000);

// ─── PROVIDER ENDPOINTS ───────────────────────────────────────
const ENDPOINTS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  weizerouter: 'https://weizerouter.web.id/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions'
};

// ─── HELPER: Build request for each provider ──────────────────
function buildProviderRequest(provider, model, apiKey, prompt, customUrl) {
  // Anthropic has its own format
  if (provider === 'anthropic') {
    return {
      url: ENDPOINTS.anthropic,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      },
      extractText: (data) => (data.content || []).map(b => b.text || '').join('')
    };
  }

  // Gemini has its own format
  if (provider === 'gemini') {
    const url = `${ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`;
    return {
      url,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      },
      extractText: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    };
  }

  // OpenAI-compatible providers (OpenAI, OpenRouter, WeizeRouter, Groq, DeepSeek, Mistral, Custom)
  const baseUrl = provider === 'custom'
    ? (customUrl.replace(/\/$/, '') + '/chat/completions')
    : ENDPOINTS[provider];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://storyboard-gen.app';
    headers['X-Title'] = 'StoryBOARD GEN';
  }

  return {
    url: baseUrl,
    options: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    },
    extractText: (data) => data.choices?.[0]?.message?.content || ''
  };
}

// ─── ROUTE: POST /api/llm/generate ────────────────────────────
app.post('/api/llm/generate', async (req, res) => {
  const { provider, model, apiKey, prompt, customUrl } = req.body;

  // Validation
  if (!provider || !model || !apiKey || !prompt) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: provider, model, apiKey, prompt'
    });
  }

  if (provider === 'custom' && !customUrl) {
    return res.status(400).json({
      success: false,
      error: 'Custom provider requires customUrl'
    });
  }

  try {
    const { url, options, extractText } = buildProviderRequest(provider, model, apiKey, prompt, customUrl);

    console.log(`[LLM] ${provider}/${model} → ${url.substring(0, 60)}...`);
    const startTime = Date.now();

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.error?.type || `HTTP ${response.status}`;
      console.log(`[LLM] ❌ Error: ${errorMsg}`);
      return res.status(response.status).json({
        success: false,
        error: errorMsg
      });
    }

    const data = await response.json();
    const text = extractText(data);
    const elapsed = Date.now() - startTime;

    console.log(`[LLM] ✅ ${provider}/${model} — ${text.length} chars in ${elapsed}ms`);

    res.json({
      success: true,
      text,
      meta: {
        provider,
        model,
        chars: text.length,
        elapsed_ms: elapsed
      }
    });

  } catch (err) {
    console.error(`[LLM] ❌ Exception:`, err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

// ─── ROUTE: POST /api/upload/scene-image ──────────────────────
const multer = require('multer');
const upload = multer({
  dest: tempDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

app.post('/api/upload/scene-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No valid image file uploaded' });
  }
  try {
    const ext = path.extname(req.file.originalname) || '.jpg';
    const newFileName = `${req.file.filename}${ext}`;
    const newPath = path.join(tempDir, newFileName);
    fs.renameSync(req.file.path, newPath);
    
    res.json({ 
      success: true, 
      imageUrl: `/temp/${newFileName}` 
    });
  } catch (err) {
    console.error(`[Upload] ❌ Error renaming file:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to process uploaded image' });
  }
});

// ─── ROUTE: POST /api/image/generate ──────────────────────────
app.post('/api/image/generate', async (req, res) => {
  const { provider, model, prompt, size, apiKey, seed } = req.body;

  if (!provider || !model || !prompt) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: provider, model, prompt'
    });
  }

  try {
    console.log(`[Image] ${provider}/${model} → size: ${size || 'default'}, seed: ${seed || 'none'}...`);
    const startTime = Date.now();

    // 0. WeizeRouter GPT-5.5 prompt enhancer + Pollinations renderer
    // WeizeRouter currently exposes OpenAI-compatible chat completions, not /images/generations.
    // Use GPT-5.5 to turn each scene into a strong image prompt, then render via Pollinations.
    if (provider === 'weizerouter') {
      if (!apiKey) throw new Error('Missing WeizeRouter API key');

      const response = await fetch('https://weizerouter.web.id/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'wz/gpt-5.5',
          messages: [
            { role: 'system', content: 'You rewrite short storyboard scene descriptions into a single concise, vivid image-generation prompt. Return only the prompt, no markdown.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 700
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `WeizeRouter API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const enhancedPrompt = (data.choices?.[0]?.message?.content || prompt).trim();
      const [w, h] = (size || '1024x1024').split('x');
      let imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${w}&height=${h}&model=flux&nologo=true`;
      if (seed) imageUrl += `&seed=${seed}`;

      return res.json({ success: true, imageUrl, prompt: enhancedPrompt, elapsed_ms: Date.now() - startTime });
    }

    // 1. OpenAI DALL-E
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'dall-e-3',
          prompt,
          n: 1,
          size: size === '1024x1024' ? '1024x1024' : (size === '768x1344' ? '1024x1792' : '1792x1024') // DALL-E 3 specific dimensions
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) throw new Error('No image URL returned from OpenAI');

      return res.json({ success: true, imageUrl, elapsed_ms: Date.now() - startTime });
    }

    // 2. Stability AI
    if (provider === 'stability') {
      // For Stability Core, SD3, etc.
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('output_format', 'jpeg');
      formData.append('aspect_ratio', size === '768x1344' ? '9:16' : (size === '1344x768' ? '16:9' : '1:1'));
      if (seed) formData.append('seed', seed.toString());

      const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${model === 'core' ? 'core' : 'sd3'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0] || errorData.message || `Stability API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const base64 = data.image;
      if (!base64) throw new Error('No base64 image data returned from Stability');
      const imageUrl = `data:image/jpeg;base64,${base64}`;

      return res.json({ success: true, imageUrl, elapsed_ms: Date.now() - startTime });
    }

    // 3. Together AI (Flux)
    if (provider === 'together') {
      const bodyObj = {
        model: model || 'black-forest-labs/FLUX.1-schnell-Free',
        prompt,
        width: size === '768x1344' ? 768 : (size === '1344x768' ? 1024 : 1024),
        height: size === '768x1344' ? 1024 : (size === '1344x768' ? 576 : 1024),
        steps: 4,
        n: 1,
        response_format: 'b64_json'
      };
      if (seed) bodyObj.seed = seed;

      const response = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyObj)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Together AI error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('No base64 data returned from Together AI');
      const imageUrl = `data:image/jpeg;base64,${b64}`;

      return res.json({ success: true, imageUrl, elapsed_ms: Date.now() - startTime });
    }

    // Default Fallback / Pollinations
    if (provider === 'pollinations') {
      const encoded = encodeURIComponent(prompt);
      const [w, h] = size.split('x');
      let imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&model=${model}&nologo=true`;
      if (seed) imageUrl += `&seed=${seed}`;
      return res.json({ success: true, imageUrl, elapsed_ms: Date.now() - startTime });
    }

    throw new Error(`Unsupported image provider: ${provider}`);

  } catch (err) {
    console.error(`[Image] ❌ Exception:`, err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate image'
    });
  }
});

// ─── ROUTE: POST /api/tts/generate ────────────────────────────
app.post('/api/tts/generate', async (req, res) => {
  const { text, lang, elevenlabsApiKey, elevenlabsVoiceId } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: text'
    });
  }

  const cleanText = text.trim();
  const language = lang || 'id';

  try {
    const crypto = require('crypto');
    const voiceId = elevenlabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
    
    const textHash = elevenlabsApiKey
      ? crypto.createHash('md5').update(`${cleanText}_el_${voiceId}`).digest('hex')
      : crypto.createHash('md5').update(`${cleanText}_${language}`).digest('hex');
      
    const fileName = `tts_${textHash}.mp3`;
    const filePath = path.join(tempDir, fileName);

    console.log(`[TTS] Request: "${cleanText.substring(0, 30)}..." [ElevenLabs: ${!!elevenlabsApiKey}]`);

    if (fs.existsSync(filePath)) {
      console.log(`[TTS] ✅ Cache Hit: ${fileName}`);
      return res.json({
        success: true,
        audioUrl: `/temp/${fileName}`
      });
    }

    if (elevenlabsApiKey) {
      console.log(`[ElevenLabs] Fetching voice generation from ElevenLabs API for: ${voiceId}`);
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      
      if (!elRes.ok) {
        const errorText = await elRes.text();
        throw new Error(`ElevenLabs API error: ${elRes.status} - ${errorText}`);
      }
      
      const buffer = Buffer.from(await elRes.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    } else {
      const url = googleTTS.getAudioUrl(cleanText, {
        lang: language === 'English' ? 'en' : 'id',
        slow: false,
        host: 'https://translate.google.com'
      });

      console.log(`[TTS] Fetching from Google TTS: ${url}`);
      const audioRes = await fetch(url);
      if (!audioRes.ok) {
        throw new Error(`Google TTS request failed with status: ${audioRes.status}`);
      }

      const buffer = Buffer.from(await audioRes.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    }

    console.log(`[TTS] ✅ Saved: ${fileName}`);

    res.json({
      success: true,
      audioUrl: `/temp/${fileName}`
    });

  } catch (err) {
    console.error(`[TTS] ❌ Exception:`, err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate speech narration'
    });
  }
});

// ─── HELPERS FOR VIDEO ASSEMBLY ────────────────────────────────
const http = require('http');
const https = require('https');
const { exec, execSync } = require('child_process');

// Helper to download external files (images)
async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: status ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

// Helper to get audio duration using ffprobe
function getAudioDuration(filePath) {
  try {
    const cmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const durationStr = execSync(cmd).toString().trim();
    return parseFloat(durationStr);
  } catch (err) {
    console.error(`[Video] ffprobe error for ${filePath}:`, err.message);
    return 3.5; // default fallback duration in seconds
  }
}

// Helper to execute terminal commands
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${cmd}\nError: ${error.message}\nStderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Helper to wrap text for subtitles
function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  let lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

// ─── ROUTE: POST /api/video/assemble ──────────────────────────
// Map to track progress for ongoing video assemblies
const assemblyProgress = new Map();

// ─── ROUTE: GET /api/video/progress/:videoId ──────────────────
app.get('/api/video/progress/:videoId', (req, res) => {
  const { videoId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  console.log(`[SSE] Client connected for video progress: ${videoId}`);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  const pollInterval = setInterval(() => {
    const progress = assemblyProgress.get(videoId);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      if (progress.done || progress.error) {
        clearInterval(pollInterval);
        clearInterval(keepAlive);
        res.end();
      }
    }
  }, 300);

  req.on('close', () => {
    console.log(`[SSE] Client disconnected for video: ${videoId}`);
    clearInterval(pollInterval);
    clearInterval(keepAlive);
  });
});

app.post('/api/video/assemble', async (req, res) => {
  const { storyboard, images, transition = 'cut', bgmTrack = 'none', bgmVolume = 15, videoId: reqVideoId, quality = '720p', elevenlabsApiKey, elevenlabsVoiceId } = req.body;

  if (!storyboard || !storyboard.scenes || storyboard.scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing or empty storyboard data'
    });
  }

  const videoId = reqVideoId || `vid_${Date.now()}`;
  console.log(`[Video] 🎬 Initiating assembly for video: ${videoId} with transition: ${transition}, quality: ${quality}`);

  const QUALITY_PRESETS = {
    '720p':  { multiplier: 1.0, crf: 23, preset: 'fast' },
    '1080p': { multiplier: 1.5, crf: 20, preset: 'medium' },
    '1440p': { multiplier: 2.0, crf: 18, preset: 'slow' }
  };
  
  const qPreset = QUALITY_PRESETS[quality] || QUALITY_PRESETS['720p'];

  const aspect = storyboard.aspect_ratio || '9:16';
  const isVertical = aspect === '9:16';
  
  const baseWidth = isVertical ? 720 : 1280;
  const baseHeight = isVertical ? 1280 : 720;

  const width = Math.round(baseWidth * qPreset.multiplier);
  const height = Math.round(baseHeight * qPreset.multiplier);
  
  const subtitleMaxChars = isVertical ? 26 : 52;
  const subtitleFontSize = Math.round((isVertical ? 30 : 26) * qPreset.multiplier);
  const subtitleYPos = isVertical ? `h-${Math.round(240 * qPreset.multiplier)}` : `h-${Math.round(120 * qPreset.multiplier)}`;

  const scenes = storyboard.scenes;
  const clipPaths = [];
  const tempFiles = [];

  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNum = scene.scene_num || (i + 1);

      assemblyProgress.set(videoId, {
        pct: Math.round((i / scenes.length) * 80),
        status: `Rendering scene ${sceneNum}/${scenes.length}...`
      });

      console.log(`[Video] Processing Scene ${sceneNum}/${scenes.length}...`);

      // 1. Get scene image (Download locally if it's an external URL)
      const imageUrl = images?.[i] || scene.visual_url || '';
      if (!imageUrl) {
        throw new Error(`Scene ${sceneNum} is missing an image. Generate images first!`);
      }

      const localImgPath = path.join(tempDir, `${videoId}_scene_${i}.jpg`);
      tempFiles.push(localImgPath);

      if (imageUrl.startsWith('http')) {
        console.log(`[Video] Downloading image for scene ${sceneNum}: ${imageUrl}`);
        await downloadFile(imageUrl, localImgPath);
      } else if (imageUrl.startsWith('data:image')) {
        // Base64 image fallback (e.g. from Stability)
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(localImgPath, base64Data, { encoding: 'base64' });
      } else {
        // Local path fallback
        const sourcePath = path.join(__dirname, '..', imageUrl.replace(/^\//, ''));
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, localImgPath);
        } else {
          throw new Error(`Scene ${sceneNum} image path "${imageUrl}" not found.`);
        }
      }

      // 2. Get scene narration audio
      let localAudioPath = null;
      let duration = 3.5; // default fallback

      const clientAudioUrl = scene.audioUrl || '';
      if (clientAudioUrl) {
        // Cached URL like '/temp/tts_xxxx.mp3' -> local path 'backend/temp/tts_xxxx.mp3'
        const resolvedAudioPath = path.join(tempDir, path.basename(clientAudioUrl));
        if (fs.existsSync(resolvedAudioPath)) {
          localAudioPath = resolvedAudioPath;
          duration = getAudioDuration(localAudioPath);
          console.log(`[Video] Scene ${sceneNum}: Found cached audio. Duration: ${duration}s`);
        }
      }

      // If narration exists but wasn't generated/cached, generate it now!
      if (!localAudioPath && scene.narration && scene.narration !== 'null' && scene.narration.trim() !== '') {
        console.log(`[Video] Scene ${sceneNum}: Generating missing TTS for: "${scene.narration.substring(0, 20)}..."`);
        const cleanText = scene.narration.trim();
        const generatedAudioPath = path.join(tempDir, `tts_fallback_${videoId}_${i}.mp3`);
        tempFiles.push(generatedAudioPath);

        if (elevenlabsApiKey) {
          try {
            const voiceId = elevenlabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
            console.log(`[Video] Scene ${sceneNum}: Generating via ElevenLabs voice: ${voiceId}`);
            const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenlabsApiKey,
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg'
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75
                }
              })
            });
            if (elRes.ok) {
              fs.writeFileSync(generatedAudioPath, Buffer.from(await elRes.arrayBuffer()));
              localAudioPath = generatedAudioPath;
              duration = getAudioDuration(localAudioPath);
              console.log(`[Video] Scene ${sceneNum}: Generated ElevenLabs fallback. Duration: ${duration}s`);
            } else {
              const elErr = await elRes.text();
              console.error(`[Video] ElevenLabs fallback request failed: ${elRes.status} - ${elErr}`);
            }
          } catch (e) {
            console.error(`[Video] ElevenLabs fallback error:`, e.message);
          }
        }

        // Fallback to Google TTS if not ElevenLabs or if ElevenLabs fetch failed
        if (!localAudioPath) {
          const ttsUrl = googleTTS.getAudioUrl(cleanText, {
            lang: storyboard.platform === 'YouTube' ? 'en' : 'id',
            slow: false,
            host: 'https://translate.google.com'
          });
          const audioRes = await fetch(ttsUrl);
          if (audioRes.ok) {
            fs.writeFileSync(generatedAudioPath, Buffer.from(await audioRes.arrayBuffer()));
            localAudioPath = generatedAudioPath;
            duration = getAudioDuration(localAudioPath);
            console.log(`[Video] Scene ${sceneNum}: Generated Google TTS fallback. Duration: ${duration}s`);
          }
        }
      }

      // 3. Write subtitle file (Text overlay)
      // SEC-03: Sanitize narration before using in FFmpeg drawtext filter
      let localSubPath = null;
      if (scene.narration && scene.narration !== 'null' && scene.narration.trim() !== '') {
        const safeNarration = sanitizeForFFmpeg(scene.narration.trim().replace(/^"|"$/g, ''));
        if (safeNarration) {
          const wrappedText = wrapText(safeNarration, subtitleMaxChars);
          const subFileName = `${videoId}_sub_${i}.txt`;
          localSubPath = path.join(tempDir, subFileName);
          tempFiles.push(localSubPath);
          fs.writeFileSync(localSubPath, wrappedText);
        }
      }

      // 4. Render video clip for this scene
      const clipPath = path.join(tempDir, `${videoId}_clip_${i}.mp4`);
      clipPaths.push(clipPath);
      tempFiles.push(clipPath);

      // FFmpeg options
      // scale aspect ratio and crop center to fit canvas exactly
      let videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
      
      if (transition === 'zoom') {
        const totalFrames = Math.ceil(duration * 25);
        videoFilter = `scale=${width*2}:${height*2},zoompan=z='min(zoom+0.0015,1.5)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`;
      }

      if (transition === 'fade') {
        const d = Math.min(0.4, duration / 2);
        videoFilter += `,fade=t=in:st=0:d=${d},fade=t=out:st=${(duration - d).toFixed(2)}:d=${d}`;
      }
      
      // Subtitle burn-in filter (DejaVuSans Bold, yellow comic fill, bold black outline)
      const drawTextFilter = localSubPath 
        ? `,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${localSubPath.replace(/\\/g, '/')}'` +
          `:fontcolor=0xFFE500:fontsize=${subtitleFontSize}:borderw=4:bordercolor=0x0A0A0A:x=(w-text_w)/2:y=${subtitleYPos}`
        : '';

      let ffmpegCmd = '';
      if (localAudioPath) {
        ffmpegCmd = `ffmpeg -y -loop 1 -i "${localImgPath}" -i "${localAudioPath}" ` +
                    `-vf "${videoFilter}${drawTextFilter}" -c:v libx264 -crf ${qPreset.crf} -preset ${qPreset.preset} -t ${duration} ` +
                    `-pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${clipPath}"`;
      } else {
        // Fallback to silent clip if no narration exists
        ffmpegCmd = `ffmpeg -y -loop 1 -i "${localImgPath}" -f lavfi -i anullsrc=r=44100:cl=mono ` +
                    `-vf "${videoFilter}${drawTextFilter}" -c:v libx264 -crf ${qPreset.crf} -preset ${qPreset.preset} -t ${duration} ` +
                    `-pix_fmt yuv420p -c:a aac -shortest "${clipPath}"`;
      }

      console.log(`[Video] Rendering Scene ${sceneNum}...`);
      await runCommand(ffmpegCmd);
      console.log(`[Video] Scene ${sceneNum} rendered: ${path.basename(clipPath)}`);
    }

    // 5. Concatenate all clips
    assemblyProgress.set(videoId, {
      pct: 82,
      status: 'Merging scene clips...'
    });

    const listFilePath = path.join(tempDir, `${videoId}_list.txt`);
    tempFiles.push(listFilePath);

    const listContent = clipPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFilePath, listContent);

    const intermediateVideoName = `${videoId}_intermediate.mp4`;
    const intermediateVideoPath = path.join(tempDir, intermediateVideoName);

    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${intermediateVideoPath}"`;
    console.log(`[Video] Concatenating clips into intermediate output: ${intermediateVideoName}`);
    await runCommand(concatCmd);
    tempFiles.push(intermediateVideoPath);

    const finalVideoName = `${videoId}_final.mp4`;
    const finalVideoPath = path.join(tempDir, finalVideoName);

    if (bgmTrack && bgmTrack !== 'none') {
      assemblyProgress.set(videoId, {
        pct: 90,
        status: `Mixing background music: ${bgmTrack}...`
      });
      const bgmPath = path.join(__dirname, 'assets', 'music', `${bgmTrack}.mp3`);
      if (fs.existsSync(bgmPath)) {
        console.log(`[Video] Mixing BGM track: ${bgmTrack} at volume: ${bgmVolume}%`);
        const vol = parseFloat(bgmVolume) / 100;
        
        // Mix intermediate video audio stream with BGM stream
        const bgmCmd = `ffmpeg -y -i "${intermediateVideoPath}" -stream_loop -1 -i "${bgmPath}" `
          + `-filter_complex "[1:a]volume=${vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]" `
          + `-map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${finalVideoPath}"`;
        
        await runCommand(bgmCmd);
      } else {
        console.warn(`[Video] BGM track "${bgmPath}" not found, skipping mix.`);
        fs.renameSync(intermediateVideoPath, finalVideoPath);
      }
    } else {
      fs.renameSync(intermediateVideoPath, finalVideoPath);
    }

    console.log(`[Video] 🏁 Video assembly completed successfully: ${finalVideoName}`);
    
    assemblyProgress.set(videoId, {
      pct: 100,
      done: true,
      videoUrl: `/temp/${finalVideoName}`,
      status: `Video assembly completed successfully!`
    });

    // Clean up temporary files except the final video
    for (const f of tempFiles) {
      if (fs.existsSync(f) && f !== finalVideoPath) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }

    res.json({
      success: true,
      videoUrl: `/temp/${finalVideoName}`,
      duration_total: clipPaths.length * 3.5
    });

  } catch (err) {
    console.error(`[Video] ❌ Assembly failed:`, err.message);
    assemblyProgress.set(videoId, {
      pct: 100,
      error: err.message || 'Failed to assemble video',
      status: `Assembly failed: ${err.message}`
    });
    // Cleanup any created temp files on failure
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to assemble video'
    });
  }
});

// ─── ROUTE: Health check ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.11.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    security: {
      rateLimit: 'active',
      cors:      'whitelist',
      helmet:    'active',
      ffmpegSanitize: 'active',
      tempCleanup: 'active (15min interval)'
    }
  });
});

// ─── ROUTE: GET /api/music/list ───────────────────────────────
app.get('/api/music/list', (req, res) => {
  try {
    const musicDir = path.join(__dirname, 'assets', 'music');
    if (!fs.existsSync(musicDir)) {
      return res.json({ success: true, tracks: [] });
    }
    const files = fs.readdirSync(musicDir);
    const tracks = files
      .filter(f => f.endsWith('.mp3'))
      .map(f => {
        const id = f.replace('.mp3', '');
        return {
          id: id,
          url: `/assets/music/${f}`,
          label: id.replace(/_/g, ' ').toUpperCase()
        };
      });
    res.json({ success: true, tracks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve temp audio and assets statically
app.use('/temp', express.static(tempDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ─── STATIC FILES (after API routes) ──────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ─── FALLBACK: Serve index.html ───────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'storyboard_generator_neobrutalism.html'));
});

// ─── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  StoryBOARD GEN — Backend Server             ║
║  http://localhost:${PORT}                        ║
║  API Proxy: POST /api/llm/generate           ║
║  Health:    GET  /api/health                 ║
╚══════════════════════════════════════════════╝
  `);
});
