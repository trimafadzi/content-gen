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

const app = express();
const PORT = process.env.PORT || 3456;

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

// ─── ROUTE: Health check ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

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
