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
  groq:      { note: 'gsk_...',          models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  deepseek:  { note: 'sk-...',           models: ['deepseek-chat', 'deepseek-reasoner'] },
  mistral:   { note: '...',              models: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'] },
  custom:    { note: 'Your API key',     models: ['custom-model'] }
};

// Image generation provider config
const IMAGE_PROVIDERS = {
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
function copyJSON() {
  if (!currentJSON) return;
  navigator.clipboard.writeText(JSON.stringify(currentJSON, null, 2));
  const btn = document.querySelector('.copy-btn');
  btn.textContent = 'Copied!';
  showToast('📋 JSON copied!');
  setTimeout(() => btn.textContent = 'Copy JSON', 1500);
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
    const response = await fetch('/api/image/generate', {
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
      body: JSON.stringify({ text, lang })
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

// ─── PHASE 5: VIDEO ASSEMBLY ──────────────────────────────────
async function assembleVideo() {
  if (!currentJSON) return;
  
  // Validate that all images are generated
  const scenesCount = currentJSON.scenes.length;
  const generatedCount = Object.keys(sceneImages).length;
  if (generatedCount < scenesCount) {
    alert(`⚠️ Silakan generate gambar untuk semua scene terlebih dahulu!\nBaru ${generatedCount}/${scenesCount} gambar yang siap.`);
    return;
  }

  if (!useBackend) {
    alert('⚠️ Backend server tidak aktif. Silakan jalankan backend server Node.js untuk menggunakan fitur FFmpeg Video Assembly.');
    return;
  }

  const btn = document.getElementById('assembleVideoBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Assembling...';
  setStatus('🎬 FFmpeg sedang merakit klip video, menggabungkan audio, dan menempelkan subtitle...');

  try {
    const response = await fetch('/api/video/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyboard: currentJSON,
        images: Object.values(sceneImages)
      })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Video assembly failed');

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
    alert(`❌ Gagal merakit video: ${err.message}`);
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
    <button class="gen-all-btn" id="assembleVideoBtn" onclick="assembleVideo()" style="background: var(--red); color: var(--white); margin-left: 8px;">🎬 Assemble Video (MP4)</button>
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
        <button class="sc-img-btn" onclick="event.stopPropagation(); genImageForScene(${idx})">↻ Regenerate</button>
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
        <div class="sc-edit-hint">✏️ Click to edit</div>
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

// ─── HISTORY MANAGEMENT ───────────────────────────────────────
function getHistory() { return loadFromStorage(STORAGE.HISTORY, []); }
function addToHistory(data) {
  const history = getHistory();
  history.unshift({
    id:        Date.now(),
    title:     data.title || data.concept || 'Untitled',
    timestamp: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    provider:  currentProvider,
    data
  });
  if (history.length > 20) history.pop();
  saveToStorage(STORAGE.HISTORY, history);
  renderHistory();
}
function renderHistory() {
  const history   = getHistory();
  const container = document.getElementById('histList');
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
function loadHistory(id) {
  const entry = getHistory().find(h => h.id === id);
  if (!entry) return;
  currentJSON = entry.data;
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('resultArea').style.display  = '';
  document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
  render(currentJSON);
  switchTab('s');
  showToast('📂 Loaded from history');
}
function clearHistory() {
  if (!confirm('Hapus semua history?')) return;
  saveToStorage(STORAGE.HISTORY, []);
  renderHistory();
  showToast('🗑️ History cleared');
}

// ─── BACKEND DETECTION ────────────────────────────────────────
async function detectBackend() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      useBackend = true;
      document.getElementById('verBadge').innerHTML = '<span class="conn-dot ok"></span>v3.3 — BACKEND CONNECTED';
    }
  } catch {
    useBackend = false;
    document.getElementById('verBadge').innerHTML = '<span class="conn-dot err"></span>v3.3 — DIRECT MODE';
  }
}

// ─── LLM API CALL (Proxy or Direct) ──────────────────────────
async function callAPI(apiKey, model, prompt) {
  if (useBackend) {
    const res = await fetch('/api/llm/generate', {
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

// ─── AUTO-SAVE LISTENERS ──────────────────────────────────────
document.getElementById('apikey').addEventListener('change', () => {
  const key = document.getElementById('apikey').value.trim();
  if (key) saveApiKey(currentProvider, key);
});
['dur', 'ratio', 'plat', 'narr', 'model'].forEach(id => {
  document.getElementById(id).addEventListener('change', savePreferences);
});

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
  await detectBackend();

  const prefs = loadPreferences();
  if (prefs) {
    if (prefs.provider && PROVIDERS[prefs.provider]) setProvider(prefs.provider);
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

  renderHistory();
  console.log('[StoryBOARD] ✅ Initialized — v3.3 (Phase 3 ready)');
})();
