/* =================================================================
   StoryBOARD GEN — Main JavaScript
   v3.3 — Phase 2.4 Refactor + Phase 3 Visual Generation
   ================================================================= */

// ─── PROVIDER CONFIG ──────────────────────────────────────────
const PROVIDERS = {
  anthropic: { note: 'sk-ant-api03-...', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-5', 'claude-opus-4-5'] },
  openai:    { note: 'sk-...',           models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini'] },
  gemini:    { note: 'AIza...',          models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-pro'] },
  openrouter:{ note: 'sk-or-v1-...',     models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free'] },
  weizerouter:{ note: 'wzr_live_...',    models: ['wz/gpt-5.5'] },
  groq:      { note: 'gsk_...',          models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  deepseek:  { note: 'sk-...',           models: ['deepseek-chat', 'deepseek-reasoner'] },
  mistral:   { note: '...',              models: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'] },
  custom:    { note: 'Your API key',     models: ['custom-model'] }
};

// Image generation provider config
const IMAGE_PROVIDERS = {
  weizerouter: { label: 'GPT-5.5 Prompt → Image',   note: 'Uses WeizeRouter key; GPT-5.5 enhances prompt, Pollinations renders image', models: ['wz/gpt-5.5'] },
  openai:      { label: 'DALL-E 3 (OpenAI)',       note: 'Uses OpenAI API key', models: ['dall-e-3', 'dall-e-2'] },
  stability:   { label: 'Stable Diffusion (API)',  note: 'stability.ai key', models: ['sd3-medium', 'sd3-large', 'core'] },
  together:    { label: 'Flux via Together AI',    note: 'together.ai key', models: ['black-forest-labs/FLUX.1-schnell-Free', 'black-forest-labs/FLUX.1-schnell'] },
  pollinations:{ label: 'Pollinations (Free)',      note: 'No API key needed', models: ['flux', 'turbo'] },
};

// ─── STATE ────────────────────────────────────────────────────
let currentProvider = 'anthropic';
let selectedGenres  = ['ASMR Satisfying'];
let currentJSON     = null;
let useBackend      = false;
let backendBase      = '';
// Per-scene image cache: { sceneIdx: dataURL }
let sceneImages     = {};
let styleLockSeed   = null;

// Style presets prompt modifiers
const PRESET_MODIFIERS = {
  cinematic: "cinematic photo, highly detailed, dramatic lighting, shot on 35mm lens, 8k resolution",
  anime: "anime style, vibrant colors, detailed digital illustration, hand-drawn aesthetic, high quality studio ghibli style",
  "3d-render": "3d character render, pixar disney style, clay model feel, cute, soft lighting, vibrant pastel colors, octanerender, 8k",
  miniature: "tilt-shift photography, miniature toy world, macro lens, small dioramas, tiny figures, shallow depth of field",
  cyberpunk: "cyberpunk neon aesthetic, glowing neon lights, futuristic city streets, dark moody atmosphere, highly stylized",
  vector: "minimalist flat vector illustration, clean lines, simple shapes, modern tech illustration, behance style"
};

// ─── STORAGE KEYS ─────────────────────────────────────────────
const STORAGE = {
  API_KEYS:   'sbgen_api_keys',
  PREFS:      'sbgen_prefs',
  HISTORY:    'sbgen_history',
  CUSTOM_URL: 'sbgen_custom_url',
  IMG_PREFS:  'sbgen_img_prefs'
};

// ─── JSON REPAIR HELPERS ──────────────────────────────────────
function escapeControlCharsInStrings(jsonStr) {
  let inString = false;
  let result = '';
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (char === '"' && (i === 0 || jsonStr[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
    } else if (inString) {
      if (char === '\\') {
        const nextChar = jsonStr[i + 1];
        if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(nextChar)) {
          result += char;
        } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/.test(jsonStr.slice(i + 2, i + 6))) {
          result += char;
        } else {
          result += '\\\\';
        }
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

function repairJSON(str) {
  let clean = str.trim();
  
  // Extract main JSON block
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf(']');
  }
  
  if (startIdx !== -1 && endIdx !== -1) {
    clean = clean.slice(startIdx, endIdx + 1);
  }
  
  // Escaping control chars inside strings
  clean = escapeControlCharsInStrings(clean);
  
  // 1. Fix missing commas between closing brace and opening brace: } { -> },{
  clean = clean.replace(/}\s*({)/g, '},$1');
  
  // 2. Fix missing commas between properties/elements separated by newline
  clean = clean.replace(/("|-?\d+(?:\.\d+)?|true|false|null|\]|\})\s*\n+\s*(")/g, '$1,\n$2');
  
  // 3. Fix trailing commas before } or ]
  clean = clean.replace(/,\s*([}\]])/g, '$1');
  
  return clean;
}

function safeParseJSON(str) {
  let clean = str.trim();
  try {
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    const candidate = s >= 0 ? clean.slice(s, e + 1) : clean;
    return JSON.parse(candidate);
  } catch (initialErr) {
    try {
      const repaired = repairJSON(clean);
      return JSON.parse(repaired);
    } catch (repairErr) {
      throw initialErr;
    }
  }
}

// ─── LOCALSTORAGE HELPERS ─────────────────────────────────────
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota exceeded */ }
}
function loadFromStorage(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) { return fallback; }
}
function saveApiKey(provider, key) {
  const keys = loadFromStorage(STORAGE.API_KEYS, {});
  keys[provider] = key;
  saveToStorage(STORAGE.API_KEYS, keys);
}
function loadApiKey(provider) {
  const keys = loadFromStorage(STORAGE.API_KEYS, {});
  return keys[provider] || '';
}
function savePreferences() {
  saveToStorage(STORAGE.PREFS, {
    provider: currentProvider,
    model:    document.getElementById('model').value,
    dur:      document.getElementById('dur').value,
    ratio:    document.getElementById('ratio').value,
    plat:     document.getElementById('plat').value,
    narr:     document.getElementById('narr').value,
    genres:   selectedGenres
  });
}
function loadPreferences() { return loadFromStorage(STORAGE.PREFS, null); }

// ─── TOAST NOTIFICATION ───────────────────────────────────────
function showToast(message, duration = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── PROVIDER SELECTION ───────────────────────────────────────
function setProvider(provider) {
  const prevKey = document.getElementById('apikey').value.trim();
  if (prevKey) saveApiKey(currentProvider, prevKey);
  currentProvider = provider;
  document.querySelectorAll('.prov').forEach(el => el.classList.toggle('on', el.dataset.p === provider));
  const config = PROVIDERS[provider];
  document.getElementById('keynote').textContent = config.note;
  document.getElementById('apikey').placeholder = config.note;
  document.getElementById('apikey').value = loadApiKey(provider);
  const modelSelect = document.getElementById('model');
  modelSelect.innerHTML = config.models.map(m => `<option>${m}</option>`).join('');
  document.getElementById('customUrlWrap').style.display = provider === 'custom' ? '' : 'none';
  if (provider === 'custom') {
    document.getElementById('customUrl').value = loadFromStorage(STORAGE.CUSTOM_URL, '');
  }
  savePreferences();
}

// ─── GENRE CHIPS ──────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const value = chip.dataset.v;
    if (chip.classList.contains('on')) {
      if (selectedGenres.length > 1) { chip.classList.remove('on'); selectedGenres = selectedGenres.filter(g => g !== value); }
    } else { chip.classList.add('on'); selectedGenres.push(value); }
    savePreferences();
  });
});

// Provider click handlers
document.querySelectorAll('.prov').forEach(el => el.addEventListener('click', () => setProvider(el.dataset.p)));

// ─── TAB SWITCHING ────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((el, i) => el.classList.toggle('on', ['s', 'j', 't'][i] === tab));
  document.getElementById('scenesView').style.display  = tab === 's' ? '' : 'none';
  document.getElementById('jsonView').style.display    = tab === 'j' ? '' : 'none';
  document.getElementById('tipsView').style.display    = tab === 't' ? '' : 'none';
}

// ─── COPY & DOWNLOAD JSON ─────────────────────────────────────
async function copyJSON() {
  if (!currentJSON) { showToast('⚠️ Belum ada JSON untuk dicopy!'); return; }

  const jsonText = JSON.stringify(currentJSON, null, 2);
  const btn = document.querySelector('.copy-btn');

  // Helper: ubah tampilan tombol sementara
  function flashBtn(text, dur = 1800) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, dur);
  }

  // Coba Clipboard API modern (HTTPS / localhost)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(jsonText);
      flashBtn('✅ Copied!');
      showToast('📋 JSON copied to clipboard!');
      return;
    } catch (err) {
      console.warn('[copyJSON] Clipboard API gagal, mencoba fallback...', err);
    }
  }

  // Fallback: textarea + execCommand (HTTP / browser lama)
  try {
    const ta = document.createElement('textarea');
    ta.value = jsonText;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS support
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      flashBtn('✅ Copied!');
      showToast('📋 JSON copied to clipboard!');
    } else {
      throw new Error('execCommand copy returned false');
    }
  } catch (fallbackErr) {
    console.error('[copyJSON] Semua metode copy gagal:', fallbackErr);
    flashBtn('❌ Gagal!', 2000);
    showToast('❌ Copy gagal. Coba Ctrl+A lalu Ctrl+C di JSON view.');
  }
}
function downloadJSON() {
  if (!currentJSON) return;
  const blob = new Blob([JSON.stringify(currentJSON, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `storyboard_${currentJSON.video_id || 'export'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 JSON downloaded!');
}

// Pilih semua teks di JSON view (fallback manual Ctrl+C)
function selectAllJSON() {
  const pre = document.getElementById('jp');
  if (!pre) return;
  const range = document.createRange();
  range.selectNodeContents(pre);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  showToast('✅ Semua teks terpilih — tekan Ctrl+C / Cmd+C untuk copy!');
}

// ─── EXPORT PDF ───────────────────────────────────────────────
function exportPDF() {
  if (!currentJSON) { showToast('⚠️ Tidak ada storyboard untuk diexport!'); return; }
  switchTab('s');
  setTimeout(() => window.print(), 100);
}

// ─── STATUS & ERROR ───────────────────────────────────────────
function setStatus(message) {
  const el = document.getElementById('stBar');
  el.style.display = message ? 'flex' : 'none';
  el.innerHTML = message ? `<span class="sp"></span>${message}` : '';
}
function setError(message) {
  const el = document.getElementById('erBar');
  el.style.display = message ? '' : 'none';
  el.innerHTML = message ? `<strong>ERROR:</strong> ${message}` : '';
}

// ─── LOADING SKELETON ─────────────────────────────────────────
function showSkeleton() {
  const count = Math.max(4, Math.round(parseInt(document.getElementById('dur').value) / 2));
  const cards = Array.from({ length: count }, () => `
    <div class="skel-card">
      <div class="skel-img"></div>
      <div class="skel-card-body">
        <div class="skel-line w40 thick"></div>
        <div class="skel-line w60"></div>
        <div class="skel-line w100"></div>
        <div class="skel-line w80"></div>
      </div>
    </div>
  `).join('');
  document.getElementById('scenesView').innerHTML = `<div class="skel-grid">${cards}</div>`;
}

// ─── PHASE 3: IMAGE GENERATION ────────────────────────────────

function getImageProviderKey() {
  const prov = document.getElementById('imgProvider')?.value || 'pollinations';
  if (prov === 'pollinations') return '';
  return loadApiKey(`img_${prov}`);
}

async function generateSceneImage(sceneIdx, visualPrompt, styleHint) {
  const imgProv = document.getElementById('imgProvider')?.value || 'pollinations';
  const imgModel = document.getElementById('imgModel')?.value || 'flux';
  const preset = document.getElementById('imgPreset')?.value || '';
  const styleLock = document.getElementById('styleLock')?.checked || false;
  const ratio = currentJSON?.aspect_ratio || '16:9';

  // Build size from ratio
  const sizeMap = { '9:16': '768x1344', '16:9': '1344x768', '1:1': '1024x1024' };
  const size = sizeMap[ratio] || '1024x576';

  // Apply style preset modifier
  const presetModifier = PRESET_MODIFIERS[preset] || '';
  let finalStyleHint = styleHint || 'cinematic, high quality';
  if (presetModifier) {
    finalStyleHint = `${presetModifier}, ${finalStyleHint}`;
  }

  const fullPrompt = `${visualPrompt}. Visual style: ${finalStyleHint}. Shot for ${ratio} social media video.`;

  // Get style lock seed
  if (styleLock && !styleLockSeed) {
    styleLockSeed = Math.floor(Math.random() * 999999);
  }
  const seed = styleLock ? styleLockSeed : Math.floor(Math.random() * 999999);

  if (imgProv === 'pollinations') {
    const encoded = encodeURIComponent(fullPrompt);
    const [w, h] = size.split('x');
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&model=${imgModel}&nologo=true&seed=${seed}`;
    return { url, type: 'url' };
  }

  if (useBackend) {
    const apiKey = loadApiKey(`img_${imgProv}`);
    if (!apiKey && imgProv !== 'pollinations') {
      throw new Error(`API key untuk image provider "${imgProv}" belum dimasukkan. Gunakan Pollinations (gratis) atau masukkan key di sidebar.`);
    }
    const response = await fetch(`${backendBase}/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: imgProv, model: imgModel, prompt: fullPrompt, size, apiKey, seed })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Image generation failed');
    return { url: result.imageUrl, type: 'url' };
  }

  throw new Error('Backend tidak tersedia. Gunakan Pollinations (free) atau jalankan backend server.');
}

async function genImageForScene(sceneIdx) {
  if (!currentJSON || !currentJSON.scenes[sceneIdx]) return;
  const scene = currentJSON.scenes[sceneIdx];
  const card = document.querySelector(`.scene-card[data-idx="${sceneIdx}"]`);
  if (!card) return;

  const imgWrap = card.querySelector('.sc-image-wrap');
  // Show loading overlay
  const loader = imgWrap.querySelector('.sc-img-loading') || (() => {
    const d = document.createElement('div');
    d.className = 'sc-img-loading';
    d.innerHTML = `<span class="sp"></span>Generating...`;
    imgWrap.appendChild(d);
    return d;
  })();
  loader.style.display = 'flex';

  try {
    const styleHint = currentJSON.visual_style || '';
    const { url } = await generateSceneImage(sceneIdx, scene.visual, styleHint);
    // Display in card
    let img = imgWrap.querySelector('img');
    const placeholder = imgWrap.querySelector('.sc-image-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    if (!img) {
      img = document.createElement('img');
      imgWrap.insertBefore(img, loader);
    }
    img.src = url;
    img.alt = `Scene ${sceneIdx + 1} visual`;
    img.onerror = () => { img.src = ''; showToast(`❌ Image failed to load`); };
    sceneImages[sceneIdx] = url;
    showToast(`🎨 Scene ${sceneIdx + 1} image generated!`);
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    loader.style.display = 'none';
  }
}

async function uploadSceneImage(sceneIdx, input) {
  const file = input.files[0];
  if (!file) return;

  if (!useBackend) {
    showToast('⚠️ Backend tidak aktif. Tidak dapat mengupload gambar.');
    input.value = '';
    return;
  }

  const card = document.querySelector(`.scene-card[data-idx="${sceneIdx}"]`);
  if (!card) return;

  const imgWrap = card.querySelector('.sc-image-wrap');
  const loader = imgWrap.querySelector('.sc-img-loading') || (() => {
    const d = document.createElement('div');
    d.className = 'sc-img-loading';
    imgWrap.appendChild(d);
    return d;
  })();
  loader.innerHTML = `<span class="sp"></span>Uploading...`;
  loader.style.display = 'flex';

  try {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${backendBase}/upload/scene-image`, {
      method: 'POST',
      body: formData
    });
    
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to upload image');

    let img = imgWrap.querySelector('img');
    const placeholder = imgWrap.querySelector('.sc-image-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    if (!img) {
      img = document.createElement('img');
      imgWrap.insertBefore(img, loader);
    }
    img.src = result.imageUrl;
    img.alt = `Scene ${sceneIdx + 1} visual`;
    sceneImages[sceneIdx] = result.imageUrl;
    
    if (currentJSON && currentJSON.scenes[sceneIdx]) {
      currentJSON.scenes[sceneIdx].visual_url = result.imageUrl;
    }

    showToast(`📁 Scene ${sceneIdx + 1} — Custom image uploaded!`);
  } catch (err) {
    showToast(`❌ Upload gagal: ${err.message}`);
  } finally {
    loader.style.display = 'none';
    input.value = '';
  }
}

async function improveScene(sceneIdx) {
  if (!currentJSON || !currentJSON.scenes[sceneIdx]) return;

  const apiKey = document.getElementById('apikey').value.trim();
  if (!apiKey) {
    showToast('⚠️ Masukkan API key terlebih dahulu untuk menggunakan AI!');
    return;
  }

  const model = document.getElementById('model').value;
  const scene = currentJSON.scenes[sceneIdx];

  const card = document.querySelector(`.scene-card[data-idx="${sceneIdx}"]`);
  if (!card) return;

  const imgWrap = card.querySelector('.sc-image-wrap');
  const loader = imgWrap.querySelector('.sc-img-loading') || (() => {
    const d = document.createElement('div');
    d.className = 'sc-img-loading';
    imgWrap.appendChild(d);
    return d;
  })();
  loader.innerHTML = `<span class="sp"></span>Improving scene...`;
  loader.style.display = 'flex';

  const prompt = `You are a viral short-form video storyboard expert.
Given this storyboard context:
Title: ${currentJSON.title}
Platform: ${currentJSON.platform}
Genre: ${currentJSON.genre}
Visual Style: ${currentJSON.visual_style}

Here is Scene ${sceneIdx + 1} that needs improvement:
${JSON.stringify(scene, null, 2)}

Improve this scene's visual description, camera movement, sfx, narration, and micro action to make it more engaging, dramatic, and viral.
Ensure the output JSON structure has EXACTLY the same keys as the input scene object.
Return ONLY valid JSON for this single scene object, no markdown codeblocks, no explanations:`;

  try {
    const raw = await callAPI(apiKey, model, prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    
    // Attempt json repair using helper
    const improvedScene = repairJSON(clean) ? JSON.parse(repairJSON(clean)) : JSON.parse(clean);
    
    // Merge back, preserving timing, scene_num, visual_url, and audioUrl
    improvedScene.scene_num = scene.scene_num;
    improvedScene.timing = scene.timing;
    if (scene.visual_url) improvedScene.visual_url = scene.visual_url;
    if (scene.audioUrl) improvedScene.audioUrl = scene.audioUrl;
    
    currentJSON.scenes[sceneIdx] = improvedScene;
    
    document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
    render(currentJSON);
    showToast(`✨ Scene ${sceneIdx + 1} improved successfully!`);
  } catch (err) {
    showToast(`❌ Gagal improve: ${err.message}`);
    console.error('[Improve] Error:', err);
  } finally {
    loader.style.display = 'none';
  }
}



async function genAllImages() {
  if (!currentJSON) return;
  const btn = document.getElementById('genAllImgBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  const scenes = currentJSON.scenes || [];
  for (let i = 0; i < scenes.length; i++) {
    setStatus(`Generating image ${i + 1}/${scenes.length}...`);
    await genImageForScene(i);
    await new Promise(r => setTimeout(r, 800)); // small delay between requests
  }
  setStatus('');
  btn.disabled = false;
  btn.textContent = '✦ Generate All Images';
  showToast('🖼️ All scene images generated!');
}

// Update image provider select UI
function updateImgProviderUI() {
  const prov = document.getElementById('imgProvider')?.value || 'pollinations';
  const provCfg = IMAGE_PROVIDERS[prov];
  const modelSel = document.getElementById('imgModel');
  if (modelSel && provCfg) {
    modelSel.innerHTML = provCfg.models.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  const noteEl = document.getElementById('imgProviderNote');
  if (noteEl && provCfg) {
    noteEl.textContent = provCfg.note;
    noteEl.style.display = prov === 'pollinations' ? 'none' : 'block';
  }
  // Save img prefs
  saveToStorage(STORAGE.IMG_PREFS, { provider: prov, model: modelSel?.value || 'flux' });
}

// ─── PHASE 4: TEXT TO SPEECH (TTS) ────────────────────────────
async function speakScene(sceneIdx) {
  if (!currentJSON || !currentJSON.scenes[sceneIdx]) return;
  const scene = currentJSON.scenes[sceneIdx];
  const text = scene.narration;
  if (!text || text === 'null') return;

  const btn = document.querySelector(`.scene-card[data-idx="${sceneIdx}"] .tts-btn`);
  if (!btn) return;

  if (btn.classList.contains('playing')) return;

  btn.classList.add('playing');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  try {
    const lang = document.getElementById('narr')?.value || 'Indonesian';
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang,
        elevenlabsApiKey: loadApiKey('elevenlabs'),
        elevenlabsVoiceId: loadApiKey('elevenlabs_voice')
      })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'TTS generation failed');

    // Save audioUrl back to storyboard state (crucial for Phase 5 video compilation)
    scene.audioUrl = result.audioUrl;
    document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);

    const audio = new Audio(result.audioUrl);
    audio.onended = () => {
      btn.classList.remove('playing');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    };
    audio.onerror = () => {
      btn.classList.remove('playing');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
      showToast('❌ Audio playback failed');
    };
    await audio.play();
  } catch (err) {
    btn.classList.remove('playing');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    showToast(`❌ TTS: ${err.message}`);
  }
}

// ─── BGM MUSIC MANAGEMENT ─────────────────────────────────────
let bgmTracks = [];
let bgmAudio = null;
let playingBgmId = null;

async function loadBgmList() {
  if (useBackend) {
    try {
      const res = await fetch(`${backendBase}/music/list`);
      const result = await res.json();
      if (result.success && result.tracks) {
        bgmTracks = result.tracks;
      }
    } catch (err) {
      console.warn('[BGM] Gagal mengambil daftar musik dari backend:', err.message);
    }
  }
  
  if (bgmTracks.length === 0) {
    bgmTracks = [
      { id: 'lofi_chill', label: 'LOFI CHILL', url: '/assets/music/lofi_chill.mp3' },
      { id: 'energetic_upbeat', label: 'ENERGETIC UPBEAT', url: '/assets/music/energetic_upbeat.mp3' },
      { id: 'cinematic_epic', label: 'CINEMATIC EPIC', url: '/assets/music/cinematic_epic.mp3' },
      { id: 'acoustic_soft', label: 'ACOUSTIC SOFT', url: '/assets/music/acoustic_soft.mp3' },
      { id: 'electronic_minimal', label: 'ELECTRONIC MINIMAL', url: '/assets/music/electronic_minimal.mp3' },
      { id: 'jazz_smooth', label: 'JAZZ SMOOTH', url: '/assets/music/jazz_smooth.mp3' },
      { id: 'nature_ambient', label: 'NATURE AMBIENT', url: '/assets/music/nature_ambient.mp3' },
      { id: 'corporate_clean', label: 'CORPORATE CLEAN', url: '/assets/music/corporate_clean.mp3' }
    ];
  }
}

function togglePlayBgm() {
  const select = document.getElementById('bgmTrack');
  const playBtn = document.getElementById('bgmPlayBtn');
  if (!select || !playBtn) return;
  
  const trackId = select.value;
  if (trackId === 'none') {
    showToast('⚠️ Pilih musik terlebih dahulu untuk memutar preview.');
    return;
  }
  
  if (bgmAudio && playingBgmId === trackId) {
    if (bgmAudio.paused) {
      bgmAudio.play();
      playBtn.textContent = '⏸️';
      playBtn.title = 'Pause Preview';
    } else {
      bgmAudio.pause();
      playBtn.textContent = '▶️';
      playBtn.title = 'Play Preview';
    }
    return;
  }
  
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
  
  const track = bgmTracks.find(t => t.id === trackId);
  if (!track) return;
  
  bgmAudio = new Audio(track.url);
  bgmAudio.loop = true;
  bgmAudio.volume = (parseInt(document.getElementById('bgmVolume')?.value || 15) / 100);
  
  bgmAudio.play().then(() => {
    playingBgmId = trackId;
    playBtn.textContent = '⏸️';
    playBtn.title = 'Pause Preview';
  }).catch(err => {
    showToast('❌ Gagal memutar musik preview.');
  });
}

function updateBgmVolume() {
  const volVal = document.getElementById('bgmVolume')?.value || 15;
  const label = document.getElementById('bgmVolumeLabel');
  if (label) label.textContent = `${volVal}%`;
  if (bgmAudio) {
    bgmAudio.volume = parseFloat(volVal) / 100;
  }
}

// ─── PHASE 5: VIDEO ASSEMBLY ──────────────────────────────────
async function assembleVideo() {
  if (!currentJSON) return;
  
  // Validate that all images are generated
  const scenesCount    = currentJSON.scenes.length;
  const generatedCount = Object.keys(sceneImages).length;
  if (generatedCount < scenesCount) {
    showConfirm(
      `Baru ${generatedCount}/${scenesCount} gambar yang sudah di-generate.\n\nSilakan generate semua gambar terlebih dahulu sebelum assemble video.`,
      null, // no confirm action — just info
      'Images Belum Lengkap'
    );
    return;
  }

  if (!useBackend) {
    showConfirm(
      'Backend server tidak aktif.\n\nJalankan backend Node.js terlebih dahulu, lalu klik tombol ⚡ Connect di header untuk menghubungkan.',
      null,
      'Backend Tidak Aktif',
      'info'
    );
    return;
  }

  const btn = document.getElementById('assembleVideoBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Assembling...';
  setStatus('🎬 FFmpeg sedang merakit klip video, menggabungkan audio, dan menempelkan subtitle...');

  const videoId = `vid_cli_${Date.now()}`;
  
  const progressWrap = document.getElementById('assemblyProgressWrap');
  const progressBar = document.getElementById('assemblyProgressBar');
  const progressText = document.getElementById('assemblyStatusText');
  const progressPct = document.getElementById('assemblyProgressPercent');
  
  if (progressWrap && progressBar && progressText && progressPct) {
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';
    progressText.textContent = '🎬 Menghubungkan ke progress stream...';
    progressWrap.style.display = 'block';
  }

  const evtSource = new EventSource(`${backendBase}/video/progress/${videoId}`);
  
  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (progressBar) progressBar.style.width = `${data.pct}%`;
      if (progressPct) progressPct.textContent = `${data.pct}%`;
      if (progressText) progressText.textContent = `🎬 ${data.status || 'Memproses...'}`;
      
      if (data.done) {
        evtSource.close();
        if (progressWrap) progressWrap.style.display = 'none';
      }
      if (data.error) {
        evtSource.close();
        if (progressWrap) progressWrap.style.display = 'none';
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error('[SSE] JSON parse error:', err);
    }
  };

  evtSource.onerror = () => {
    evtSource.close();
  };

  try {
    const response = await fetch('/api/video/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyboard: currentJSON,
        images: Object.values(sceneImages),
        transition: document.getElementById('transitionType')?.value || 'cut',
        bgmTrack: document.getElementById('bgmTrack')?.value || 'none',
        bgmVolume: parseInt(document.getElementById('bgmVolume')?.value || 15),
        videoId: videoId,
        quality: document.getElementById('videoQuality')?.value || '720p',
        elevenlabsApiKey: loadApiKey('elevenlabs'),
        elevenlabsVoiceId: loadApiKey('elevenlabs_voice')
      })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Video assembly failed');

    evtSource.close();
    if (progressWrap) progressWrap.style.display = 'none';

    // Display the video player
    document.getElementById('videoPlayerWrap').style.display = 'block';
    
    const aspect = currentJSON.aspect_ratio || '9:16';
    const isVertical = aspect === '9:16';
    
    const player = document.getElementById('videoPlayer');
    player.src = result.videoUrl;
    player.style.aspectRatio = isVertical ? '9/16' : '16/9';
    player.style.width = isVertical ? '270px' : '480px';
    player.load();
    
    document.getElementById('videoDownloadLink').href = result.videoUrl;
    
    // Auto-scroll to player
    document.getElementById('videoPlayerWrap').scrollIntoView({ behavior: 'smooth' });
    showToast('🎬 Video berhasil dirakit!');
  } catch (err) {
    showToast(`❌ Gagal merakit video: ${err.message}`, 4000);
  } finally {
    setStatus('');

    btn.disabled = false;
    btn.textContent = '🎬 Assemble Video (MP4)';
  }
}

function closeVideoPlayer() {
  const player = document.getElementById('videoPlayer');
  player.pause();
  player.src = '';
  document.getElementById('videoPlayerWrap').style.display = 'none';
}

// ─── RENDER STORYBOARD ────────────────────────────────────────
function render(data) {
  sceneImages = {}; // reset images on re-render
  const scenes = data.scenes || [];

  document.getElementById('metaRow').innerHTML = `
    <div class="meta-item"><span>Durasi</span>${data.duration_total || '—'}</div>
    <div class="meta-item"><span>Scenes</span>${scenes.length}</div>
    <div class="meta-item"><span>Rasio</span>${data.aspect_ratio || '—'}</div>
    <div class="meta-item"><span>Genre</span>${data.genre || selectedGenres.join(', ')}</div>
    <div class="meta-item"><span>Provider</span>${currentProvider}</div>
  `;

  // Image generation controls bar (Phase 3)
  const imgProvOptions = Object.entries(IMAGE_PROVIDERS)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const savedImgPrefs = loadFromStorage(STORAGE.IMG_PREFS, { provider: 'pollinations', model: 'flux' });
  
  // Reset style lock seed whenever we render a fresh storyboard
  styleLockSeed = null;

  document.getElementById('imgGenBar').innerHTML = `
    <span class="img-gen-bar-label">🎨 Image Gen:</span>
    <select id="imgProvider" onchange="updateImgProviderUI()">
      ${Object.entries(IMAGE_PROVIDERS).map(([k, v]) =>
        `<option value="${k}" ${k === savedImgPrefs.provider ? 'selected' : ''}>${v.label}</option>`
      ).join('')}
    </select>
    <select id="imgModel">
      ${IMAGE_PROVIDERS[savedImgPrefs.provider]?.models.map(m =>
        `<option value="${m}" ${m === savedImgPrefs.model ? 'selected' : ''}>${m}</option>`
      ).join('') || ''}
    </select>
    <select id="imgPreset" style="flex: 0.8; min-width: 120px;">
      <option value="">No Preset (Follow Prompt)</option>
      <option value="cinematic">Cinematic Photo</option>
      <option value="anime">Anime Illustration</option>
      <option value="3d-render">3D Pixar Character</option>
      <option value="miniature">Miniature Toy World</option>
      <option value="cyberpunk">Cyberpunk Neon</option>
      <option value="vector">Flat Vector Art</option>
    </select>
    <label style="display:flex; align-items:center; gap:6px; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:700; text-transform:uppercase; cursor:pointer; user-select:none;">
      <input type="checkbox" id="styleLock" checked style="width:auto; box-shadow:none; cursor:pointer; margin:0;"/>
      Style Lock
    </label>
    <button class="gen-all-btn" id="genAllImgBtn" onclick="genAllImages()">✦ Generate All Images</button>
    <select id="transitionType" style="flex: 0.6; min-width: 100px; padding: 5px 8px; border: var(--border); font-family: 'IBM Plex Mono', monospace; font-size: 10px; background: var(--white); box-shadow: 2px 2px 0 var(--black);">
      <option value="cut">⚡ Cut (No Transition)</option>
      <option value="fade">🌅 Fade In/Out</option>
      <option value="zoom">🔍 Zoom (Ken Burns)</option>
    </select>
    <select id="videoQuality" style="flex: 0.6; min-width: 100px; padding: 5px 8px; border: var(--border); font-family: 'IBM Plex Mono', monospace; font-size: 10px; background: var(--white); box-shadow: 2px 2px 0 var(--black); margin-left: 6px;">
      <option value="720p">📺 720p (Fast)</option>
      <option value="1080p">📺 1080p (Standard)</option>
      <option value="1440p">📺 1440p (High)</option>
    </select>
    <button class="gen-all-btn" id="assembleVideoBtn" onclick="assembleVideo()" style="background: var(--red); color: var(--white); margin-left: 8px;">🎬 Assemble Video (MP4)</button>
    
    <div style="width: 100%; height: 2.5px; background: var(--black); margin: 10px 0; border: none;"></div>
    
    <span class="img-gen-bar-label">🎵 BGM Music:</span>
    <select id="bgmTrack" style="flex: 0.8; min-width: 130px; padding: 5px 8px; border: var(--border); font-family: 'IBM Plex Mono', monospace; font-size: 10px; background: var(--white); box-shadow: 2px 2px 0 var(--black);">
      <option value="none">🔇 No Music (Silence)</option>
      ${bgmTracks.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
    </select>
    <button class="sc-img-btn" id="bgmPlayBtn" onclick="togglePlayBgm()" style="position:static; opacity:1; cursor:pointer; font-size:10px; padding:5px 10px; height:auto; box-shadow:2px 2px 0 var(--black);" title="Play Preview">▶️</button>
    <label style="display:flex; align-items:center; gap:8px; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:700; text-transform:uppercase;">
      Vol:
      <input type="range" id="bgmVolume" min="5" max="50" value="15" oninput="updateBgmVolume()" style="width:70px; height:6px; cursor:pointer; box-shadow:none; padding:0; margin:0;"/>
      <span id="bgmVolumeLabel">15%</span>
    </label>
    
    <span class="img-provider-note" id="imgProviderNote" style="display:none"></span>
  `;

  // Scene cards with image slots (Phase 3)
  document.getElementById('scenesView').innerHTML = `<div class="scene-grid">${scenes.map((scene, idx) => `
    <div class="scene-card" data-idx="${idx}">
      <div class="sc-num">${String(scene.scene_num ?? idx + 1).padStart(2, '0')}</div>

      <div class="sc-image-wrap">
        <div class="sc-image-placeholder" onclick="genImageForScene(${idx})">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
          Click to generate image
        </div>
        <div class="sc-img-actions-wrap" onclick="event.stopPropagation();">
          <button class="sc-img-btn" onclick="genImageForScene(${idx})">↻ Regenerate</button>
          <label class="sc-upload-btn" title="Upload custom image">
            📁 Upload
            <input type="file" accept="image/*" onchange="uploadSceneImage(${idx}, this)" style="display:none">
          </label>
        </div>
        <div class="sc-img-loading" style="display:none"><span class="sp"></span>Generating...</div>
      </div>

      <div class="scene-card-body">
        <div class="sc-time">${scene.timing || '—'}</div>
        ${scene.visual    ? `<div class="sc-lbl">Visual</div><div class="sc-val" contenteditable="true" data-field="visual" data-idx="${idx}">${scene.visual}</div>` : ''}
        ${scene.camera    ? `<div class="sc-lbl">Camera</div><div class="sc-val" contenteditable="true" data-field="camera" data-idx="${idx}">${scene.camera}</div>` : ''}
        ${scene.sfx       ? `<div class="sc-lbl">SFX</div><div class="sc-val" contenteditable="true" data-field="sfx" data-idx="${idx}">${scene.sfx}</div>` : ''}
        ${scene.narration && scene.narration !== 'null'
          ? `<div class="sc-lbl">Narasi</div>
             <div class="sc-narr-wrap">
               <button class="tts-btn" onclick="speakScene(${idx})" title="Listen Narration">
                 <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
               </button>
               <div class="sc-val narr" contenteditable="true" data-field="narration" data-idx="${idx}">"${scene.narration}"</div>
             </div>`
          : ''}
        ${scene.micro_action ? `<div class="sc-lbl">Micro Action</div><div class="sc-val" contenteditable="true" data-field="micro_action" data-idx="${idx}">${scene.micro_action}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <div class="sc-edit-hint" style="margin:0;">✏️ Click to edit</div>
          <button class="sc-img-btn" onclick="event.stopPropagation(); improveScene(${idx})" style="position:static; opacity:1; padding:3px 6px; font-size:9px; background:var(--yellow); cursor:pointer; height:auto; box-shadow: 2px 2px 0 var(--black);" title="Improve Scene content using AI">✨ Improve Scene</button>
        </div>
      </div>
    </div>
  `).join('')}</div>`;

  // Attach edit listeners
  document.querySelectorAll('.sc-val[contenteditable]').forEach(el => {
    el.addEventListener('blur', () => {
      const idx   = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      let value   = el.textContent.trim();
      if (field === 'narration') value = value.replace(/^"|"$/g, '');
      if (currentJSON && currentJSON.scenes[idx]) {
        currentJSON.scenes[idx][field] = value;
        document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
        showToast(`✏️ Scene ${idx + 1} updated`);
      }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });

  // Tips
  const tips = data.tips || [];
  document.getElementById('tipsView').innerHTML = tips.length
    ? `<div class="tips-row">${tips.map((t, i) => `<div class="tip"><div class="tip-num">TIP ${String(i + 1).padStart(2, '0')}</div>${t}</div>`).join('')}</div>`
    : '<p style="font-size:13px;color:#888">Tidak ada tips.</p>';
}

// ─── HISTORY MANAGEMENT (IndexedDB + localStorage fallback) ────
async function getHistory() {
  if (typeof idbKeyval !== 'undefined') {
    try {
      const history = await idbKeyval.get(STORAGE.HISTORY);
      return history || [];
    } catch (e) {
      console.warn('[IDB] Error reading history, falling back to localStorage:', e);
    }
  }
  return loadFromStorage(STORAGE.HISTORY, []);
}

async function addToHistory(data) {
  const history = await getHistory();
  history.unshift({
    id:        Date.now(),
    title:     data.title || data.concept || 'Untitled',
    timestamp: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    provider:  currentProvider,
    data
  });
  if (history.length > 20) history.pop();
  
  if (typeof idbKeyval !== 'undefined') {
    try {
      await idbKeyval.set(STORAGE.HISTORY, history);
    } catch (e) {
      console.warn('[IDB] Error saving history, falling back to localStorage:', e);
      saveToStorage(STORAGE.HISTORY, history);
    }
  } else {
    saveToStorage(STORAGE.HISTORY, history);
  }
  await renderHistory();
}

async function renderHistory() {
  const history   = await getHistory();
  const container = document.getElementById('histList');
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = '<div class="history-empty">Belum ada history</div>';
    return;
  }
  container.innerHTML = history.map(entry => `
    <div class="history-item" onclick="loadHistory(${entry.id})" title="${entry.title}">
      <span class="hi-title">${entry.title}</span>
      <span class="hi-time">${entry.timestamp}</span>
    </div>
  `).join('');
}

async function loadHistory(id) {
  const history = await getHistory();
  const entry = history.find(h => h.id === id);
  if (!entry) return;
  currentJSON = entry.data;
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('resultArea').style.display  = '';
  document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
  render(currentJSON);
  switchTab('s');
  showToast('📂 Loaded from history');
}

async function clearHistory() {
  if (!confirm('Hapus semua history?')) return;
  
  if (typeof idbKeyval !== 'undefined') {
    try {
      await idbKeyval.del(STORAGE.HISTORY);
    } catch (e) {
      console.warn('[IDB] Error clearing history, falling back to localStorage:', e);
      saveToStorage(STORAGE.HISTORY, []);
    }
  } else {
    saveToStorage(STORAGE.HISTORY, []);
  }
  await renderHistory();
  showToast('🗑️ History cleared');
}

// ─── BACKEND DETECTION ────────────────────────────────────────
async function detectBackend() {
  const healthPaths = ['/api/health', '/storyboard-api/health'];
  for (const healthPath of healthPaths) {
    try {
      const res = await fetch(healthPath, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        useBackend = true;
        backendBase = healthPath.replace(/\/health$/, '');
        document.getElementById('verBadge').innerHTML = '<span class="conn-dot ok"></span>v3.11.0 — BACKEND CONNECTED';
        // Sembunyikan tombol Connect saat berhasil terhubung
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) connectBtn.style.display = 'none';
        return;
      }
    } catch {}
  }
  useBackend = false;
  backendBase = '';
  document.getElementById('verBadge').innerHTML = '<span class="conn-dot err"></span>v3.11.0 — DIRECT MODE';
  // Tampilkan tombol Connect saat backend tidak tersedia
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) connectBtn.style.display = 'inline-flex';
}

// ─── RECONNECT BACKEND ────────────────────────────────────────
async function reconnectBackend() {
  const btn = document.getElementById('connectBtn');
  const badge = document.getElementById('verBadge');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Connecting...';
  }
  if (badge) badge.innerHTML = '<span class="conn-dot" style="background:#f59e0b;animation:pulse 1s infinite"></span>v3.11.0 — CONNECTING...';
  await detectBackend();
  if (btn) {
    btn.disabled = false;
    btn.textContent = '⚡ Connect';
  }
  if (useBackend) {
    showToast('✅ Backend berhasil terhubung!');
  } else {
    showToast('❌ Backend tidak ditemukan. Jalankan server terlebih dahulu.');
  }
}

// ─── LLM API CALL (Proxy or Direct) ──────────────────────────
async function callAPI(apiKey, model, prompt) {
  if (useBackend) {
    const res = await fetch(`${backendBase}/llm/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: currentProvider, model, apiKey, prompt,
        customUrl: currentProvider === 'custom' ? document.getElementById('customUrl').value.trim() : undefined
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Backend error');
    return result.text;
  }

  // Direct fallback (CORS may block)
  if (currentProvider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-calls': 'true' },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
    const d = await r.json();
    return (d.content || []).map(b => b.text || '').join('');
  }

  if (currentProvider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    weizerouter: 'https://weizerouter.web.id/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions'
  };
  const baseUrl = currentProvider === 'custom'
    ? (document.getElementById('customUrl').value.trim().replace(/\/$/, '') + '/chat/completions')
    : ENDPOINTS[currentProvider];
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  if (currentProvider === 'openrouter') { headers['HTTP-Referer'] = 'https://storyboard-gen.app'; headers['X-Title'] = 'StoryBOARD GEN'; }
  const r = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

// ─── GENERATE STORYBOARD ──────────────────────────────────────
async function gen() {
  const apiKey = document.getElementById('apikey').value.trim();
  const idea   = document.getElementById('idea').value.trim();
  const model  = document.getElementById('model').value;

  if (!apiKey) { showToast('⚠️ Masukkan API key!'); return; }
  if (!idea)   { showToast('⚠️ Masukkan ide konten!'); return; }
  if (currentProvider === 'custom' && !document.getElementById('customUrl').value.trim()) {
    showToast('⚠️ Masukkan base URL!'); return;
  }

  saveApiKey(currentProvider, apiKey);
  if (currentProvider === 'custom') saveToStorage(STORAGE.CUSTOM_URL, document.getElementById('customUrl').value.trim());
  savePreferences();

  const dur        = document.getElementById('dur').value;
  const ratio      = document.getElementById('ratio').value;
  const plat       = document.getElementById('plat').value;
  const narr       = document.getElementById('narr').value;
  const sceneCount = Math.max(4, Math.round(parseInt(dur) / 2));

  document.getElementById('variationSwitcher').style.display = 'none';
  storyboardVariations = [];

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultArea').style.display = '';
  setError('');
  setStatus(`Generating via ${currentProvider} (${model})...`);
  showSkeleton();
  document.getElementById('gb').disabled    = true;
  document.getElementById('gb').textContent = '⏳ Generating...';

  const prompt = `You are a viral short-form video storyboard expert.
Content idea: "${idea}"
Duration: ${dur} seconds | Ratio: ${ratio} | Platform: ${plat} | Genre: ${selectedGenres.join(', ')} | Narration: ${narr}
Scenes: exactly ${sceneCount}
Return ONLY valid JSON, no markdown fences, no explanation:
{"video_id":"snake_case","title":"Title","concept":"One line","duration_total":"${dur} detik","aspect_ratio":"${ratio}","platform":"${plat}","genre":"${selectedGenres.join(', ')}","visual_style":"Aesthetic description","difficulty":"Mudah","scenes":[{"scene_num":1,"timing":"0:00-0:03","visual":"Specific visual description for image generation","camera":"Angle+movement","sfx":"Sound effects","narration":${narr === 'None' ? 'null' : '"Text in ' + narr + '"'},"micro_action":"Subtle action"}],"tips":["Tip 1","Tip 2","Tip 3"],"generate_with":["ffmpeg","edge-tts"]}`;

  try {
    const raw   = await callAPI(apiKey, model, prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    currentJSON = safeParseJSON(clean);
    document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
    render(currentJSON);
    setStatus('');
    addToHistory(currentJSON);
    showToast('✅ Storyboard generated!');
  } catch (err) {
    setStatus('');
    setError(err.message || 'Gagal generate.');
    document.getElementById('scenesView').innerHTML = '';
  } finally {
    document.getElementById('gb').disabled    = false;
    document.getElementById('gb').textContent = '▶ Generate Storyboard';
  }
}

async function genBatch() {
  const apiKey = document.getElementById('apikey').value.trim();
  const idea   = document.getElementById('idea').value.trim();
  const model  = document.getElementById('model').value;

  if (!apiKey) { showToast('⚠️ Masukkan API key!'); return; }
  if (!idea)   { showToast('⚠️ Masukkan ide konten!'); return; }
  if (currentProvider === 'custom' && !document.getElementById('customUrl').value.trim()) {
    showToast('⚠️ Masukkan base URL!'); return;
  }

  saveApiKey(currentProvider, apiKey);
  if (currentProvider === 'custom') saveToStorage(STORAGE.CUSTOM_URL, document.getElementById('customUrl').value.trim());
  savePreferences();

  const dur        = document.getElementById('dur').value;
  const ratio      = document.getElementById('ratio').value;
  const plat       = document.getElementById('plat').value;
  const narr       = document.getElementById('narr').value;
  const sceneCount = Math.max(4, Math.round(parseInt(dur) / 2));

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultArea').style.display = '';
  document.getElementById('variationSwitcher').style.display = 'none';
  setError('');
  setStatus(`Generating 3 Variations via ${currentProvider} (${model})...`);
  showSkeleton();
  
  const gbb = document.getElementById('gbb');
  gbb.disabled = true;
  gbb.textContent = '⏳ Generating (3x)...';
  
  const gb = document.getElementById('gb');
  gb.disabled = true;

  const buildPrompt = (varNum) => {
    let focus = "";
    if (varNum === 1) focus = "Focus on intense emotional appeal or a surprising hook.";
    if (varNum === 2) focus = "Focus on a highly educational, step-by-step breakdown or demonstration.";
    if (varNum === 3) focus = "Focus on dynamic visual pacing and viral comedy/relatability.";
    
    return `You are a viral short-form video storyboard expert.
Content idea: "${idea}"
Duration: ${dur} seconds | Ratio: ${ratio} | Platform: ${plat} | Genre: ${selectedGenres.join(', ')} | Narration: ${narr}
Scenes: exactly ${sceneCount}
${focus}
Return ONLY valid JSON, no markdown fences, no explanation:
{"video_id":"snake_case","title":"Title (Variation ${varNum})","concept":"One line","duration_total":"${dur} detik","aspect_ratio":"${ratio}","platform":"${plat}","genre":"${selectedGenres.join(', ')}","visual_style":"Aesthetic description","difficulty":"Mudah","scenes":[{"scene_num":1,"timing":"0:00-0:03","visual":"Specific visual description for image generation","camera":"Angle+movement","sfx":"Sound effects","narration":${narr === 'None' ? 'null' : '"Text in ' + narr + '"'},"micro_action":"Subtle action"}],"tips":["Tip 1","Tip 2","Tip 3"],"generate_with":["ffmpeg","edge-tts"]}`;
  };

  try {
    const promises = [1, 2, 3].map(async (i) => {
      const p = buildPrompt(i);
      const raw = await callAPI(apiKey, model, p);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = safeParseJSON(clean);
      if (!parsed || !parsed.scenes) throw new Error(`Variation ${i} failed to return valid storyboard JSON`);
      return parsed;
    });

    const results = await Promise.allSettled(promises);
    storyboardVariations = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (storyboardVariations.length === 0) {
      throw new Error('Gagal men-generate semua variasi storyboard. Silakan coba lagi.');
    }

    selectedVariationIndex = 0;
    currentJSON = storyboardVariations[0];
    document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
    render(currentJSON);
    
    document.getElementById('variationSwitcher').style.display = 'flex';
    updateVariationTabUI();
    
    showToast(`👥 Berhasil men-generate ${storyboardVariations.length} variasi storyboard!`);
    addToHistory(currentJSON);
  } catch (err) {
    setError(err.message);
    showToast(`❌ ${err.message}`);
  } finally {
    setStatus('');
    gbb.disabled = false;
    gbb.textContent = '👥 Generate 3 Variations';
    gb.disabled = false;
  }
}

function selectVariation(idx) {
  if (!storyboardVariations[idx]) return;
  selectedVariationIndex = idx;
  currentJSON = storyboardVariations[idx];
  document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
  render(currentJSON);
  updateVariationTabUI();
  showToast(`📂 Mengaktifkan Variasi ${idx + 1}`);
}

function updateVariationTabUI() {
  for (let i = 0; i < 3; i++) {
    const btn = document.getElementById(`varBtn${i}`);
    if (btn) {
      btn.style.display = storyboardVariations[i] ? 'inline-block' : 'none';
      if (i === selectedVariationIndex) {
        btn.classList.add('on');
      } else {
        btn.classList.remove('on');
      }
    }
  }
}

// ─── EXPORT AS IMAGE ──────────────────────────────────────────

function buildExportCard(data) {
  const scenes = data.scenes || [];
  const genre  = data.genre  || selectedGenres.join(', ');
  const platform = data.platform || 'Shorts / TikTok / Reels';

  // ── Hero image: pakai gambar scene pertama jika ada ──────────
  const heroImgSrc = sceneImages[0] || null;
  const heroHTML = heroImgSrc
    ? `<img src="${heroImgSrc}" alt="Hero"/>`
    : `<div class="ec-hero-placeholder">🎬</div>`;

  // ── Metadata sidebar ──────────────────────────────────────────
  const metaItems = [
    { icon: '⏱', label: 'Durasi Total', value: data.duration_total || '—' },
    { icon: '🎬', label: 'Jumlah Scene', value: `${scenes.length} Scene` },
    { icon: '📐', label: 'Rasio', value: data.aspect_ratio || '9:16' },
    { icon: '🎵', label: 'Genre', value: genre },
    { icon: '😊', label: 'Vibe', value: data.visual_style ? data.visual_style.split(' ').slice(0,2).join(' ') : 'Satisfying' },
    { icon: '▶', label: 'Platform', value: platform },
  ];
  const metaHTML = metaItems.map((m, i) => `
    <div class="ec-meta-item">
      <div class="ec-meta-icon-row">
        <span class="ec-meta-icon">${m.icon}</span>
        <span class="ec-meta-label">${m.label}</span>
      </div>
      <div class="ec-meta-value">${m.value}</div>
    </div>
    ${i < metaItems.length - 1 ? '<div class="ec-meta-divider"></div>' : ''}
  `).join('');

  // ── Scene cards ───────────────────────────────────────────────
  const regularScenes = scenes.slice(0, 6); // max 6 scene di grid
  const bonusTips = data.tips || [];

  function makeSceneCard(scene, idx, isBonus = false) {
    const imgSrc = sceneImages[idx] || null;
    const imgHTML = imgSrc
      ? `<img src="${imgSrc}" alt="Scene ${idx+1}"/>`
      : `<div class="ec-scene-img-placeholder">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#555">
             <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
           </svg>
         </div>`;

    const fields = [
      scene.visual  ? { lbl: 'VISUAL', val: scene.visual } : null,
      scene.camera  ? { lbl: 'CAMERA', val: scene.camera } : null,
      scene.sfx     ? { lbl: 'SFX', val: scene.sfx } : null,
      scene.micro_action ? { lbl: 'AKSI MINI', val: scene.micro_action } : null,
    ].filter(Boolean);

    const sceneNumLabel = isBonus ? '★' : (idx + 1);
    const cardClass = isBonus ? 'ec-scene-card bonus' : 'ec-scene-card';
    const titleClass = isBonus ? 'ec-scene-title ec-scene-bonus-title' : 'ec-scene-title';
    const titleText  = isBonus ? 'BONUS SHOT (OPSIONAL)' : (scene.visual || '').split(' ').slice(0, 4).join(' ').toUpperCase() || `SCENE ${idx + 1}`;

    return `
      <div class="${cardClass}">
        <div class="ec-scene-img-wrap">
          ${imgHTML}
          <div class="ec-scene-num">${sceneNumLabel}</div>
          ${scene.timing ? `<div class="ec-timecode">${scene.timing}</div>` : ''}
        </div>
        <div class="ec-scene-body">
          <div class="${titleClass}">${titleText}</div>
          ${fields.map(f => `
            <div class="ec-field">
              <span class="ec-field-lbl">${f.lbl}:</span>
              <span class="ec-field-val">${f.val}</span>
            </div>
          `).join('')}
          ${scene.narration && scene.narration !== 'null'
            ? `<div class="ec-field">
                 <span class="ec-field-lbl">NARASI:</span>
                 <span class="ec-field-val ec-narr-val">"${scene.narration}"</span>
               </div>`
            : ''}
        </div>
      </div>
    `;
  }

  // Buat scene grid — pasangkan scene terakhir dengan bonus card jika ganjil
  let sceneCardsHTML = regularScenes.map((s, i) => makeSceneCard(s, i)).join('');
  // Jika jumlah scene ganjil → tambah bonus card sebagai pasangan
  if (regularScenes.length % 2 !== 0) {
    sceneCardsHTML += makeSceneCard({ visual: 'Tampilkan dari berbagai sudut.', camera: 'Macro cinematic sweep.', sfx: 'Ambience dapur Jepang, suara alat mini.', micro_action: 'Pekerja membereskan alat, foto bersama.' }, -1, true);
  }

  // ── Tips section ─────────────────────────────────────────────
  const tipsHTML = bonusTips.length > 0
    ? bonusTips.map(t => `
        <div class="ec-tip-item">
          <span class="ec-tip-check">✓</span>
          <span>${t}</span>
        </div>
      `).join('')
    : '<div class="ec-tip-item"><span class="ec-tip-check">✓</span><span>Generate storyboard untuk melihat tips creator.</span></div>';

  // ── Footer bar ────────────────────────────────────────────────
  const footerItems = [
    { icon: '⏱', lbl: 'Durasi Total', val: data.duration_total || '—' },
    { icon: '🎬', lbl: 'Jumlah Scene', val: `${scenes.length} Scene` },
    { icon: '😊', lbl: 'Vibe', val: 'Satisfying' },
    { icon: '🎵', lbl: 'Genre', val: genre },
    { icon: '📐', lbl: 'Rasio', val: data.aspect_ratio || '9:16' },
    { icon: '▶', lbl: 'Platform', val: platform },
  ];

  // ── Header badges ─────────────────────────────────────────────
  const dur = data.duration_total || '';
  const sceneCountBadge = `${scenes.length} SCENE`;

  // ── Subtitle dari genre/concept ───────────────────────────────
  const conceptLine = data.concept || '';
  const titleDisplay = (data.title || 'STORYBOARD').toUpperCase();

  return `
    <!-- HEADER -->
    <div class="ec-header">
      <div class="ec-header-left">
        <div class="ec-brand">STORYBOARD</div>
        <div class="ec-category">${genre.toUpperCase()}</div>
        <div class="ec-subtitle">${conceptLine || platform}</div>
        <div class="ec-title-big">${titleDisplay}</div>
        <div class="ec-badges">
          <div class="ec-badge filled">${genre.toUpperCase()}</div>
          <div class="ec-badge">${dur} • ${sceneCountBadge}</div>
        </div>
      </div>
      <div class="ec-hero-image">
        ${heroHTML}
        <div class="ec-hero-gradient"></div>
      </div>
      <div class="ec-meta-sidebar">
        ${metaHTML}
      </div>
    </div>

    <!-- SCENE GRID -->
    <div class="ec-scenes-grid">
      ${sceneCardsHTML}
    </div>

    <!-- TIPS SECTION -->
    ${bonusTips.length > 0 ? `
    <div class="ec-tips">
      <div class="ec-tips-title">TIPS CREATOR</div>
      <div class="ec-tips-grid">
        ${tipsHTML}
      </div>
    </div>` : ''}

    <!-- FOOTER BAR -->
    <div class="ec-footer">
      ${footerItems.map(f => `
        <div class="ec-footer-item">
          <span class="ec-footer-icon">${f.icon}</span>
          <div>
            <div class="ec-footer-lbl">${f.lbl}</div>
            <div class="ec-footer-val">${f.val}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function shareStoryboard() {
  if (!currentJSON) { 
    showToast('⚠️ Belum ada storyboard untuk dibagikan!'); 
    return; 
  }
  try {
    const jsonStr = JSON.stringify(currentJSON);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    
    if (base64.length > 8000) {
      showConfirm(
        'Storyboard ini terlalu besar untuk dibagikan via URL (melebihi limit ukuran 8KB).\n\nSilakan gunakan tombol "Download JSON" untuk mengekspor data sebagai berkas.',
        null,
        'Ukuran Terlalu Besar',
        'info'
      );
      return;
    }
    
    const shareUrl = `${location.origin}${location.pathname}?sb=${base64}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('🔗 Link share berhasil disalin ke clipboard!');
      }).catch(() => {
        fallbackCopyText(shareUrl);
      });
    } else {
      fallbackCopyText(shareUrl);
    }
  } catch (err) {
    showToast('❌ Gagal memproses link share.');
    console.error('[Share] Error:', err);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (ok) {
    showToast('🔗 Link share berhasil disalin ke clipboard!');
  } else {
    showConfirm(
      `Gagal menyalin otomatis. Silakan salin tautan berikut secara manual:\n\n${text}`,
      null,
      'Salin Tautan Manual',
      'info'
    );
  }
}

async function exportAsImage() {
  if (!currentJSON) { showToast('⚠️ Belum ada storyboard untuk diexport!'); return; }

  const btn = document.getElementById('exportImgBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Rendering...';

  // Tampilkan loading overlay
  const overlay = document.createElement('div');
  overlay.className = 'export-loading-overlay';
  overlay.id = 'exportLoadingOverlay';
  overlay.innerHTML = `
    <div class="export-loading-box">
      <div class="export-loading-icon">📸</div>
      <div class="export-loading-text">Rendering storyboard image...</div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    // Populate export card
    const card = document.getElementById('exportCard');
    card.innerHTML = buildExportCard(currentJSON);

    // Pindah ke posisi visible sementara (di luar viewport)
    card.style.position = 'fixed';
    card.style.left = '-9999px';
    card.style.top = '0';
    card.style.zIndex = '-1';

    // Tunggu images load
    await new Promise(r => setTimeout(r, 300));

    // Capture dengan html2canvas
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0D0D0D',
      logging: false,
      width: 900,
      height: card.scrollHeight,
    });

    // Convert ke PNG blob dan download
    canvas.toBlob((blob) => {
      if (!blob) { showToast('❌ Gagal generate image!'); return; }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      const title = (currentJSON.title || 'storyboard')
        .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      a.href     = url;
      a.download = `storyboard_${title}_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📸 Storyboard image downloaded!');
    }, 'image/png');

  } catch (err) {
    console.error('[Export Image]', err);
    showToast(`❌ Export gagal: ${err.message}`);
  } finally {
    document.getElementById('exportLoadingOverlay')?.remove();
    btn.disabled = false;
    btn.textContent = '📸 Export Image';
  }
}

// ─── SETTINGS PANEL ──────────────────────────────────────────

// Config semua LLM providers untuk settings grid
const SETTINGS_LLM_PROVIDERS = [
  { key: 'anthropic',   label: 'Anthropic',    note: 'sk-ant-api03-...' },
  { key: 'openai',      label: 'OpenAI',       note: 'sk-...' },
  { key: 'gemini',      label: 'Gemini',       note: 'AIza...' },
  { key: 'openrouter',  label: 'OpenRouter',   note: 'sk-or-v1-...' },
  { key: 'weizerouter', label: 'WeizeRouter',  note: 'wzr_live_...' },
  { key: 'groq',        label: 'Groq',         note: 'gsk_...' },
  { key: 'deepseek',    label: 'DeepSeek',     note: 'sk-...' },
  { key: 'mistral',     label: 'Mistral',      note: '...' },
  { key: 'custom',      label: 'Custom API',   note: 'Your API key' },
];

// Config image providers untuk settings grid
const SETTINGS_IMG_PROVIDERS = [
  { key: 'img_openai',     label: 'OpenAI (DALL-E)',    note: 'sk-... (sama seperti OpenAI)' },
  { key: 'img_stability',  label: 'Stability AI',       note: 'sk-... (stability.ai)' },
  { key: 'img_together',   label: 'Together AI',        note: 'together.ai key' },
  { key: 'img_weizerouter',label: 'WeizeRouter Images', note: 'wzr_live_... (sama seperti WeizeRouter)' },
];

// Config TTS providers untuk settings grid
const SETTINGS_TTS_PROVIDERS = [
  { key: 'elevenlabs',       label: 'ElevenLabs API Key', note: 'Your ElevenLabs API key' },
  { key: 'elevenlabs_voice', label: 'ElevenLabs Voice ID', note: 'e.g. 21m00Tcm4TlvDq8ikWAM' },
];

function buildSettingsGrid(containerId, providers) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = providers.map(({ key, label, note }) => {
    const saved = loadApiKey(key);
    const hasSaved = !!saved;
    return `
      <div class="settings-item">
        <div class="settings-item-label">
          <span class="key-saved-dot ${hasSaved ? 'saved' : ''}" id="dot_${key}"></span>
          ${label}
        </div>
        <div class="key-input-wrap">
          <input
            type="password"
            id="skey_${key}"
            placeholder="${note}"
            value="${saved}"
            autocomplete="new-password"
            oninput="updateDot('${key}')"
          />
          <button class="key-toggle-btn" onclick="toggleKeyVisibility('skey_${key}', this)" title="Show/Hide">👁</button>
          ${key === 'elevenlabs_voice' ? `<button class="key-toggle-btn" onclick="testElevenLabsVoice(this)" title="Test Voice ID" style="margin-left: 4px; background: var(--green); color: var(--white); font-size: 10px; padding: 0 6px;">🔊 Test</button>` : ''}
        </div>
        <div class="settings-note">${note}</div>
      </div>
    `;
  }).join('');
}

async function testElevenLabsVoice(btn) {
  const elApiKey = document.getElementById('skey_elevenlabs')?.value.trim();
  const elVoiceId = document.getElementById('skey_elevenlabs_voice')?.value.trim();

  if (!elApiKey) { showToast('⚠️ Masukkan ElevenLabs API Key terlebih dahulu!'); return; }
  if (!elVoiceId) { showToast('⚠️ Masukkan ElevenLabs Voice ID!'); return; }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Testing...';

  try {
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Testing Voice ID from StoryBOARD Generator',
        elevenlabsApiKey: elApiKey,
        elevenlabsVoiceId: elVoiceId
      })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'TTS generation failed');

    const audio = new Audio(result.audioUrl);
    audio.onended = () => {
      btn.disabled = false;
      btn.textContent = originalText;
    };
    await audio.play();
    showToast('🔊 Memutar preview suara ElevenLabs...');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    showToast(`❌ Gagal test voice: ${err.message}`);
  }
}

function openSettings() {
  buildSettingsGrid('settingsLLMGrid', SETTINGS_LLM_PROVIDERS);
  buildSettingsGrid('settingsImgGrid', SETTINGS_IMG_PROVIDERS);
  buildSettingsGrid('settingsTTSGrid', SETTINGS_TTS_PROVIDERS);
  document.getElementById('settingsOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('settingsOverlay')) closeSettings();
}

function toggleKeyVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.textContent = isPassword ? '🙈' : '👁';
}

function updateDot(providerKey) {
  const input = document.getElementById(`skey_${providerKey}`);
  const dot   = document.getElementById(`dot_${providerKey}`);
  if (!input || !dot) return;
  dot.classList.toggle('saved', !!input.value.trim());
}

function saveAllKeys() {
  const allProviders = [...SETTINGS_LLM_PROVIDERS, ...SETTINGS_IMG_PROVIDERS, ...SETTINGS_TTS_PROVIDERS];
  let savedCount = 0;
  allProviders.forEach(({ key }) => {
    const input = document.getElementById(`skey_${key}`);
    if (!input) return;
    const val = input.value.trim();
    if (val) {
      saveApiKey(key, val);
      savedCount++;
    } else {
      const keys = loadFromStorage(STORAGE.API_KEYS, {});
      delete keys[key];
      saveToStorage(STORAGE.API_KEYS, keys);
    }
  });
  document.getElementById('apikey').value = loadApiKey(currentProvider);
  updateSettingsKeyBadge();
  closeSettings();
  showToast(`✅ ${savedCount} API key tersimpan!`);
}

function clearAllKeys() {
  if (!confirm('Hapus semua API key yang tersimpan?')) return;
  saveToStorage(STORAGE.API_KEYS, {});
  document.getElementById('apikey').value = '';
  updateSettingsKeyBadge();
  [...SETTINGS_LLM_PROVIDERS, ...SETTINGS_IMG_PROVIDERS, ...SETTINGS_TTS_PROVIDERS].forEach(({ key }) => {
    const dot = document.getElementById(`dot_${key}`);
    const input = document.getElementById(`skey_${key}`);
    if (dot) dot.classList.remove('saved');
    if (input) input.value = '';
  });
  showToast('🗑️ Semua API key dihapus!');
}

function updateSettingsKeyBadge() {
  const keys = loadFromStorage(STORAGE.API_KEYS, {});
  const count = Object.values(keys).filter(v => !!v).length;
  const badge = document.getElementById('settingsKeyCount');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = `${count} KEY${count > 1 ? 'S' : ''}`;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// ESC key menutup settings modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('settingsOverlay').classList.contains('open')) {
    closeSettings();
  }
});

// ─── THEME MANAGEMENT (Dark/Light Mode C-01) ─────────────────
function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  saveToStorage('sbgen_theme', newTheme);
  showToast(`🌓 Mode ${newTheme === 'dark' ? 'Gelap' : 'Terang'} aktif`);
}

function initTheme() {
  const savedTheme = loadFromStorage('sbgen_theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

// ─── AUTO-SAVE LISTENERS ──────────────────────────────────────
document.getElementById('apikey').addEventListener('change', () => {
  const key = document.getElementById('apikey').value.trim();
  if (key) saveApiKey(currentProvider, key);
});
['dur', 'ratio', 'plat', 'narr', 'model'].forEach(id => {
  document.getElementById(id).addEventListener('change', savePreferences);
});

// ─── CONTENT CALENDAR (Phase D-04) ───────────────────────────
let calendarJSON = null;

function openCalendar() {
  const currentIdea = document.getElementById('idea').value.trim();
  if (currentIdea) {
    document.getElementById('calendarNiche').value = currentIdea;
  }
  document.getElementById('calendarOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCalendar() {
  document.getElementById('calendarOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleCalendarOverlayClick(e) {
  if (e.target === document.getElementById('calendarOverlay')) closeCalendar();
}

async function generateCalendar() {
  const apiKey = document.getElementById('apikey').value.trim();
  const model  = document.getElementById('model').value;
  const niche  = document.getElementById('calendarNiche').value.trim();
  const days   = document.getElementById('calendarDays').value;

  if (!apiKey) { showToast('⚠️ Masukkan API key!'); return; }
  if (!niche) { showToast('⚠️ Masukkan niche / topik!'); return; }

  const statusEl = document.getElementById('calendarStatus');
  const genBtn = document.getElementById('calendarGenBtn');
  const resultWrap = document.getElementById('calendarResultWrap');

  genBtn.disabled = true;
  genBtn.textContent = '⏳ Generating Content Calendar...';
  statusEl.style.display = 'block';
  statusEl.textContent = 'Menghubungi AI...';
  resultWrap.style.display = 'none';

  const prompt = `You are a viral content calendar planner.
Topik Niche: "${niche}"
Jumlah Hari: ${days} hari.
Return ONLY valid JSON containing a structured content calendar outline with the following format. Do not return markdown fences, do not return explanations:
{"niche":"${niche}","days":[{"day":1,"title":"Topic Title","concept":"Viral hook & concept breakdown","duration":"15-30s","visual_direction":"Visual layout description","audio_theme":"SFX theme suggestion"}]}`;

  try {
    const raw = await callAPI(apiKey, model, prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    calendarJSON = safeParseJSON(clean);
    
    if (!calendarJSON || !calendarJSON.days) {
      throw new Error("Format JSON kalender tidak valid.");
    }

    renderCalendarResults();
    statusEl.style.display = 'none';
    resultWrap.style.display = 'block';
    showToast('📅 Kalender Konten berhasil dibuat!');
  } catch (err) {
    statusEl.textContent = `❌ Error: ${err.message}`;
  } finally {
    genBtn.disabled = false;
    genBtn.textContent = '✨ Generate Calendar Outline';
  }
}

function renderCalendarResults() {
  const listEl = document.getElementById('calendarResultList');
  if (!listEl || !calendarJSON) return;

  listEl.innerHTML = calendarJSON.days.map(d => `
    <div style="background:var(--white); border:var(--border); padding:12px; box-shadow: 2px 2px 0 var(--black); display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid var(--black); padding-bottom:4px;">
        <span style="font-family:'IBM Plex Mono',monospace; font-weight:bold; font-size:11px; background:var(--yellow); padding:2px 6px; border:1px solid var(--black); color:var(--black);">HARI ${d.day}</span>
        <span style="font-family:'IBM Plex Mono',monospace; font-size:10px; color:#555;">Durasi: ${d.duration}</span>
      </div>
      <div style="font-weight:bold; font-size:13px; color:var(--black);">${d.title}</div>
      <div style="font-size:11px; color:#333; line-height:1.4;"><strong>Konsep:</strong> ${d.concept}</div>
      <div style="font-size:11px; color:#333; line-height:1.4;"><strong>Visual:</strong> ${d.visual_direction}</div>
      <div style="font-size:10px; color:#666; font-family:'IBM Plex Mono',monospace;">🎵 Audio: ${d.audio_theme}</div>
      <button onclick="useCalendarIdea('${d.title.replace(/'/g, "\\'")}: ${d.concept.replace(/'/g, "\\'")}')" style="margin-top:6px; font-size:10px; padding:4px 8px; cursor:pointer; background:var(--black); color:var(--white); font-weight:bold; border:var(--border); display:inline-block; align-self:flex-start; box-shadow: 1px 1px 0 var(--black);">🎬 Create Storyboard</button>
    </div>
  `).join('');
}

function useCalendarIdea(ideaText) {
  document.getElementById('idea').value = ideaText;
  closeCalendar();
  showToast('📋 Topik disalin ke Form Ide!');
}

function exportCalendarCSV() {
  if (!calendarJSON || !calendarJSON.days) return;
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Day,Title,Concept,Duration,Visual Direction,Audio Theme\n";
  
  calendarJSON.days.forEach(d => {
    const row = [
      `Day ${d.day}`,
      `"${d.title.replace(/"/g, '""')}"`,
      `"${d.concept.replace(/"/g, '""')}"`,
      `"${d.duration.replace(/"/g, '""')}"`,
      `"${d.visual_direction.replace(/"/g, '""')}"`,
      `"${d.audio_theme.replace(/"/g, '""')}"`
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `content_calendar_${calendarJSON.niche.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📊 CSV berhasil di-download!');
}

function copyCalendarJSON() {
  if (!calendarJSON) return;
  navigator.clipboard.writeText(JSON.stringify(calendarJSON, null, 2))
    .then(() => showToast('📋 JSON disalin ke clipboard!'))
    .catch(() => showToast('❌ Gagal menyalin JSON'));
}

// ─── THUMBNAIL GENERATOR (Phase D-01) ────────────────────────
function openThumbnailGenerator() {
  if (!currentJSON) {
    showToast('⚠️ Generate storyboard terlebih dahulu!');
    return;
  }
  
  const title = currentJSON.title || 'Viral Video';
  const firstSceneVisual = currentJSON.scenes?.[0]?.visual || '';
  const style = currentJSON.visual_style || '';
  
  document.getElementById('thumbText').value = title;
  document.getElementById('thumbPrompt').value = firstSceneVisual ? `${firstSceneVisual}. Visual style: ${style}` : '';
  
  const aspect = currentJSON.aspect_ratio || '9:16';
  document.getElementById('thumbRatio').value = aspect === '9:16' ? '9:16' : '16:9';
  
  document.getElementById('thumbnailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeThumbnailGenerator() {
  document.getElementById('thumbnailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleThumbnailOverlayClick(e) {
  if (e.target === document.getElementById('thumbnailOverlay')) closeThumbnailGenerator();
}

async function generateThumbnail() {
  const apiKey = document.getElementById('apikey').value.trim();
  const promptText = document.getElementById('thumbPrompt').value.trim();
  const overlayText = document.getElementById('thumbText').value.trim();
  const ratio = document.getElementById('thumbRatio').value;
  const overlayColor = document.getElementById('thumbColor').value;
  
  const imgProv = document.getElementById('imgProvider')?.value || 'pollinations';
  const imgModel = document.getElementById('imgModel')?.value || 'flux';
  
  if (!promptText) {
    showToast('⚠️ Masukkan prompt visual thumbnail!');
    return;
  }
  
  const statusEl = document.getElementById('thumbStatus');
  const genBtn = document.getElementById('thumbGenBtn');
  const resultWrap = document.getElementById('thumbResultWrap');
  
  genBtn.disabled = true;
  genBtn.textContent = '⏳ Generating Image...';
  statusEl.style.display = 'block';
  statusEl.textContent = 'Membuat gambar dasar via AI...';
  resultWrap.style.display = 'none';
  
  const sizeMap = { '9:16': '768x1344', '16:9': '1344x768' };
  const size = sizeMap[ratio] || '1024x576';
  const styleLock = document.getElementById('styleLock')?.checked || false;
  const seed = styleLock ? (styleLockSeed || 42) : Math.floor(Math.random() * 999999);
  
  try {
    let imageUrl = '';
    
    if (imgProv === 'pollinations') {
      const encoded = encodeURIComponent(promptText);
      const [w, h] = size.split('x');
      imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&model=${imgModel}&nologo=true&seed=${seed}`;
    } else {
      if (!useBackend) {
        throw new Error('Backend tidak tersedia. Gunakan Pollinations.');
      }
      const provApiKey = loadApiKey(`img_${imgProv}`);
      const response = await fetch(`${backendBase}/image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: imgProv, model: imgModel, prompt: promptText, size, apiKey: provApiKey, seed })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal generate gambar.');
      imageUrl = result.imageUrl;
    }
    
    statusEl.textContent = 'Menggambar teks overlay neobrutalism...';
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const [w, h] = size.split('x').map(Number);
    canvas.width = w;
    canvas.height = h;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      
      if (overlayText) {
        ctx.save();
        
        const fontSize = Math.round(w * 0.07);
        ctx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(overlayText).width;
        const rectWidth = textWidth + 40;
        const rectHeight = fontSize + 30;
        
        const rx = (w - rectWidth) / 2;
        const ry = (h - rectHeight) / 2;
        
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(rx + 8, ry + 8, rectWidth, rectHeight);
        
        ctx.fillStyle = overlayColor;
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 6;
        ctx.fillRect(rx, ry, rectWidth, rectHeight);
        ctx.strokeRect(rx, ry, rectWidth, rectHeight);
        
        ctx.fillStyle = '#0A0A0A';
        ctx.fillText(overlayText, w / 2, h / 2 + 3);
        
        ctx.restore();
      }
      
      const container = document.getElementById('thumbCanvasContainer');
      container.innerHTML = '';
      
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.border = 'var(--border)';
      canvas.id = 'thumbnailCanvas';
      container.appendChild(canvas);
      
      statusEl.style.display = 'none';
      resultWrap.style.display = 'block';
      showToast('🖼️ Thumbnail berhasil dibuat!');
    };
    
    img.onerror = () => {
      throw new Error('Gagal memuat gambar hasil generator.');
    };
    
  } catch (err) {
    statusEl.textContent = `❌ Error: ${err.message}`;
  } finally {
    genBtn.disabled = false;
    genBtn.textContent = '🎨 Generate Thumbnail';
  }
}

function downloadThumbnail() {
  const canvas = document.getElementById('thumbnailCanvas');
  if (!canvas) return;
  
  const link = document.createElement('a');
  link.download = `thumbnail_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 Download thumbnail berhasil!');
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); gen(); }
  if (e.key === 'Escape') { setError(''); document.activeElement.blur(); }
  if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    if (e.key === '1') switchTab('s');
    if (e.key === '2') switchTab('j');
    if (e.key === '3') switchTab('t');
  }
});

// ─── INIT ─────────────────────────────────────────────────────
(async function init() {
  initTheme();
  await detectBackend();
  await loadBgmList();

  const prefs = loadPreferences();
  if (prefs) {
    if (prefs.provider && PROVIDERS[prefs.provider]) setProvider(prefs.provider);
    else setProvider('anthropic');
    if (prefs.model) {
      const ms = document.getElementById('model');
      for (const opt of ms.options) { if (opt.value === prefs.model) { ms.value = prefs.model; break; } }
    }
    if (prefs.dur)   document.getElementById('dur').value  = prefs.dur;
    if (prefs.ratio) document.getElementById('ratio').value = prefs.ratio;
    if (prefs.plat)  document.getElementById('plat').value  = prefs.plat;
    if (prefs.narr)  document.getElementById('narr').value  = prefs.narr;
    if (prefs.genres && prefs.genres.length > 0) {
      selectedGenres = prefs.genres;
      document.querySelectorAll('.chip').forEach(chip =>
        chip.classList.toggle('on', selectedGenres.includes(chip.dataset.v))
      );
    }
  } else {
    setProvider('anthropic');
  }

  await renderHistory();
  updateSettingsKeyBadge();

  // Load shared storyboard if present in URL
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sbParam = urlParams.get('sb');
    if (sbParam) {
      const decodedJson = decodeURIComponent(escape(atob(sbParam)));
      const parsedData = JSON.parse(decodedJson);
      if (parsedData && parsedData.scenes) {
        currentJSON = parsedData;
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('resultArea').style.display = '';
        document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
        render(currentJSON);
        switchTab('s');
        showToast('📂 Storyboard loaded from shared URL!');
      }
    }
  } catch (err) {
    console.warn('[Share] Failed to decode shared storyboard URL:', err);
  }

  console.log('[StoryBOARD] ✅ Initialized — v3.11.0 (WeizeRouter ready)');
})();
