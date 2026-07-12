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
      const bodyObj = {
        prompt,
        output_format: 'jpeg',
        aspect_ratio: size === '768x1344' ? '9:16' : (size === '1344x768' ? '16:9' : '1:1')
      };
      if (seed) bodyObj.seed = seed;

      const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${model === 'core' ? 'core' : 'sd3'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(bodyObj)
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
