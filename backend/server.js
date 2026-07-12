/**
 * StoryBOARD GEN — Backend Proxy Server
 * 
 * Handles LLM API calls to avoid CORS issues when calling from the browser.
 * Also serves the frontend static files.
 * 
 * Routes:
 *   POST /api/llm/generate — Proxy LLM requests to various providers
 *   GET  /                 — Serve frontend
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const googleTTS = require('google-tts-api');

const app = express();
const PORT = process.env.PORT || 3456;

// Create temp directory for saving TTS files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ─── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ─── PROVIDER ENDPOINTS ───────────────────────────────────────
const ENDPOINTS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
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

  // OpenAI-compatible providers (OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Custom)
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
  const { text, lang } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: text'
    });
  }

  const cleanText = text.trim();
  const language = lang || 'id'; // default to indonesian

  try {
    // Hash text + lang to avoid recreating duplicate audio files
    const crypto = require('crypto');
    const textHash = crypto.createHash('md5').update(`${cleanText}_${language}`).digest('hex');
    const fileName = `tts_${textHash}.mp3`;
    const filePath = path.join(tempDir, fileName);

    console.log(`[TTS] Request: "${cleanText.substring(0, 30)}..." [lang: ${language}]`);

    // Check cache
    if (fs.existsSync(filePath)) {
      console.log(`[TTS] ✅ Cache Hit: ${fileName}`);
      return res.json({
        success: true,
        audioUrl: `/temp/${fileName}`
      });
    }

    // Get TTS URL
    const url = googleTTS.getAudioUrl(cleanText, {
      lang: language === 'English' ? 'en' : 'id',
      slow: false,
      host: 'https://translate.google.com'
    });

    console.log(`[TTS] Fetching from: ${url}`);
    const audioRes = await fetch(url);
    if (!audioRes.ok) {
      throw new Error(`Google TTS request failed with status: ${audioRes.status}`);
    }

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
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
app.post('/api/video/assemble', async (req, res) => {
  const { storyboard, images } = req.body;

  if (!storyboard || !storyboard.scenes || storyboard.scenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing or empty storyboard data'
    });
  }

  const videoId = `vid_${Date.now()}`;
  console.log(`[Video] 🎬 Initiating assembly for video: ${videoId}`);

  const aspect = storyboard.aspect_ratio || '9:16';
  const isVertical = aspect === '9:16';
  const width = isVertical ? 720 : 1280;
  const height = isVertical ? 1280 : 720;
  const subtitleMaxChars = isVertical ? 26 : 52;
  const subtitleFontSize = isVertical ? 30 : 26;
  const subtitleYPos = isVertical ? 'h-240' : 'h-120';

  const scenes = storyboard.scenes;
  const clipPaths = [];
  const tempFiles = [];

  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNum = scene.scene_num || (i + 1);

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
        const ttsUrl = googleTTS.getAudioUrl(cleanText, {
          lang: storyboard.platform === 'YouTube' ? 'en' : 'id',
          slow: false,
          host: 'https://translate.google.com'
        });
        const generatedAudioPath = path.join(tempDir, `tts_fallback_${videoId}_${i}.mp3`);
        tempFiles.push(generatedAudioPath);

        const audioRes = await fetch(ttsUrl);
        if (audioRes.ok) {
          fs.writeFileSync(generatedAudioPath, Buffer.from(await audioRes.arrayBuffer()));
          localAudioPath = generatedAudioPath;
          duration = getAudioDuration(localAudioPath);
          console.log(`[Video] Scene ${sceneNum}: Generated fallback TTS. Duration: ${duration}s`);
        }
      }

      // 3. Write subtitle file (Text overlay)
      let localSubPath = null;
      if (scene.narration && scene.narration !== 'null' && scene.narration.trim() !== '') {
        const wrappedText = wrapText(scene.narration.trim().replace(/^"|"$/g, ''), subtitleMaxChars);
        const subFileName = `${videoId}_sub_${i}.txt`;
        localSubPath = path.join(tempDir, subFileName);
        tempFiles.push(localSubPath);
        fs.writeFileSync(localSubPath, wrappedText);
      }

      // 4. Render video clip for this scene
      const clipPath = path.join(tempDir, `${videoId}_clip_${i}.mp4`);
      clipPaths.push(clipPath);
      tempFiles.push(clipPath);

      // FFmpeg options
      // scale aspect ratio and crop center to fit canvas exactly
      const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
      
      // Subtitle burn-in filter (DejaVuSans Bold, yellow comic fill, bold black outline)
      const drawTextFilter = localSubPath 
        ? `,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${localSubPath.replace(/\\/g, '/')}'` +
          `:fontcolor=0xFFE500:fontsize=${subtitleFontSize}:borderw=4:bordercolor=0x0A0A0A:x=(w-text_w)/2:y=${subtitleYPos}`
        : '';

      let ffmpegCmd = '';
      if (localAudioPath) {
        ffmpegCmd = `ffmpeg -y -loop 1 -i "${localImgPath}" -i "${localAudioPath}" ` +
                    `-vf "${videoFilter}${drawTextFilter}" -c:v libx264 -t ${duration} ` +
                    `-pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${clipPath}"`;
      } else {
        // Fallback to silent clip if no narration exists
        ffmpegCmd = `ffmpeg -y -loop 1 -i "${localImgPath}" -f lavfi -i anullsrc=r=44100:cl=mono ` +
                    `-vf "${videoFilter}${drawTextFilter}" -c:v libx264 -t ${duration} ` +
                    `-pix_fmt yuv420p -c:a aac -shortest "${clipPath}"`;
      }

      console.log(`[Video] Rendering Scene ${sceneNum}...`);
      await runCommand(ffmpegCmd);
      console.log(`[Video] Scene ${sceneNum} rendered: ${path.basename(clipPath)}`);
    }

    // 5. Concatenate all clips
    const listFilePath = path.join(tempDir, `${videoId}_list.txt`);
    tempFiles.push(listFilePath);

    const listContent = clipPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFilePath, listContent);

    const finalVideoName = `${videoId}_final.mp4`;
    const finalVideoPath = path.join(tempDir, finalVideoName);

    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${finalVideoPath}"`;
    console.log(`[Video] Concatenating clips into final output: ${finalVideoName}`);
    await runCommand(concatCmd);

    console.log(`[Video] 🏁 Video assembly completed successfully: ${finalVideoName}`);

    // Clean up temporary files except the final video
    for (const f of tempFiles) {
      if (fs.existsSync(f) && f !== finalVideoPath) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }

    res.json({
      success: true,
      videoUrl: `/temp/${finalVideoName}`,
      duration_total: clipPaths.length * 3.5 // rough approximate or track it precisely
    });

  } catch (err) {
    console.error(`[Video] ❌ Assembly failed:`, err.message);
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
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve temp audio files statically
app.use('/temp', express.static(tempDir));

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
