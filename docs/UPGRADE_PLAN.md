# 🛠️ Upgrade Plan — StoryBOARD GEN
# Technical Specification for Post-MVP Upgrades

| Field | Detail |
|---|---|
| **Version Target** | v4.0 |
| **Base Version** | v3.6.1 |
| **Author** | Content-Gen Team |
| **Created** | 2026-07-23 |
| **Review Source** | Project Review 2026-07-23 |

---

## Overview Phases

```
Phase 0 — Security Fixes (WAJIB sebelum apapun)
    │
    ▼
Phase A — Quick Wins (Tier 1: 1-3 hari/fitur)
    │
    ▼
Phase B — Medium Features (Tier 2: 1-2 minggu/fitur)
    │
    ▼
Phase C — Game Changers (Tier 3: 2-4 minggu/fitur)
    │
    ▼
Phase D — Strategic (Tier 4: 1+ bulan/fitur)
```

---

## ═══════════════════════════════════════════
## PHASE 0 — SECURITY FIXES 🔴
## (WAJIB dikerjakan sebelum fitur baru)
## ═══════════════════════════════════════════

### SEC-01: Rate Limiting API Routes

**Problem**: Semua endpoint `/api/*` tidak ada rate limiting. Bisa di-spam → API cost drain + server overload.

**Acceptance Criteria**:
- [ ] Max 20 requests/menit per IP untuk `/api/llm/generate`
- [ ] Max 10 requests/menit per IP untuk `/api/image/generate`
- [ ] Max 5 requests/menit per IP untuk `/api/video/assemble`
- [ ] Response `429 Too Many Requests` dengan pesan yang jelas

**Technical Spec**:
```bash
# Install
cd backend && npm install express-rate-limit
```
```javascript
// server.js — setelah const app = express();
const rateLimit = require('express-rate-limit');

const llmLimiter   = rateLimit({ windowMs: 60_000, max: 20, message: { success: false, error: 'Rate limit exceeded. Try again in 1 minute.' } });
const imgLimiter   = rateLimit({ windowMs: 60_000, max: 10, message: { success: false, error: 'Image rate limit: max 10/min.' } });
const videoLimiter = rateLimit({ windowMs: 60_000, max:  5, message: { success: false, error: 'Video assembly limit: max 5/min.' } });

app.use('/api/llm/generate',    llmLimiter);
app.use('/api/image/generate',  imgLimiter);
app.use('/api/video/assemble',  videoLimiter);
```

**Effort**: 1 jam | **Risk**: Low

---

### SEC-02: CORS Whitelist

**Problem**: `app.use(cors())` mengijinkan semua origins. Berbahaya di production.

**Acceptance Criteria**:
- [ ] CORS hanya allow origins yang diwhitelist
- [ ] Allow localhost:3456 untuk development
- [ ] Support env variable `ALLOWED_ORIGINS` untuk production

**Technical Spec**:
```javascript
// server.js
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3456,http://localhost:8080').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blocked: ${origin}`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Effort**: 30 menit | **Risk**: Low

---

### SEC-03: FFmpeg Input Sanitization

**Problem**: `scene.narration` dipakai langsung di FFmpeg `drawtext` command tanpa sanitasi. Shell metacharacters bisa menyebabkan command injection.

**Acceptance Criteria**:
- [ ] Semua user-supplied strings di-sanitize sebelum masuk FFmpeg command
- [ ] Characters berbahaya di-escape atau di-strip
- [ ] Test dengan input mengandung quotes, colons, backslashes

**Technical Spec**:
```javascript
// server.js — tambah helper function
function sanitizeForFFmpeg(text) {
  if (!text) return '';
  return text
    .replace(/[\\':]/g, ' ')         // strip shell-special chars
    .replace(/\n+/g, ' ')             // flatten newlines
    .replace(/[^\w\s.,!?()-]/g, '')   // allow only safe chars
    .trim()
    .substring(0, 500);               // cap length
}

// Ganti di route /api/video/assemble sebelum wrapText:
const safeNarration = sanitizeForFFmpeg(scene.narration.trim().replace(/^"|"$/g, ''));
const wrappedText = wrapText(safeNarration, subtitleMaxChars);
```

**Effort**: 45 menit | **Risk**: Low

---

### SEC-04: Temp File Auto-Cleanup

**Problem**: `/backend/temp/` tidak pernah dibersihkan. Disk penuh setelah banyak video assembly.

**Acceptance Criteria**:
- [ ] File video (prefix `vid_`) dihapus setelah 1 jam
- [ ] File TTS cache (prefix `tts_`) dihapus setelah 24 jam
- [ ] Cleanup berjalan setiap 15 menit via interval
- [ ] Log setiap cleanup action

**Technical Spec**:
```javascript
// server.js — tambah setelah tempDir setup
const TEMP_MAX_AGE_MS = 60 * 60 * 1000;       // 1 jam untuk video
const TTS_MAX_AGE_MS  = 24 * 60 * 60 * 1000;  // 24 jam untuk TTS cache

function cleanupTempFiles() {
  const now = Date.now();
  let cleaned = 0;
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach(filename => {
      const filePath = path.join(tempDir, filename);
      const stat = fs.statSync(filePath);
      const age = now - stat.mtimeMs;
      if (filename.startsWith('vid_') && age > TEMP_MAX_AGE_MS) {
        fs.unlinkSync(filePath); cleaned++;
      } else if (filename.startsWith('tts_') && age > TTS_MAX_AGE_MS) {
        fs.unlinkSync(filePath); cleaned++;
      }
    });
    if (cleaned > 0) console.log(`[Cleanup] 🗑️ Removed ${cleaned} stale temp files`);
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }
}

cleanupTempFiles(); // run on startup
setInterval(cleanupTempFiles, 15 * 60 * 1000); // every 15 min
```

**Effort**: 1 jam | **Risk**: Low

---

### SEC-05: Security Headers (Helmet.js)

**Problem**: Tidak ada security headers (X-Frame-Options, CSP, HSTS, dll).

**Technical Spec**:
```bash
cd backend && npm install helmet
```
```javascript
const helmet = require('helmet');
app.use(helmet({ contentSecurityPolicy: false })); // CSP false karena inline scripts di frontend
```

**Effort**: 30 menit | **Risk**: Low

---

## ═══════════════════════════════════════════
## PHASE A — QUICK WINS (TIER 1) 🔥
## ═══════════════════════════════════════════

### A-01: Scene Transitions

**Problem**: Semua scene di-cut hard. Video terasa kaku dan tidak cinematic.

**Acceptance Criteria**:
- [ ] User bisa pilih transition type di UI sebelum video assembly
- [ ] Supported: `cut` (default), `fade`, `ken-burns zoom`, `slide-left`
- [ ] Transition duration 0.4s
- [ ] Tidak breaking untuk video yang sudah ada

**Technical Spec**:

*Backend (`server.js`)*:
```javascript
// Terima parameter baru di POST /api/video/assemble:
const { storyboard, images, transition = 'cut', transitionDuration = 0.4 } = req.body;

// Ken Burns zoom (panning zoom effect untuk static images):
function getKenBurnsFilter(width, height) {
  return `zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale=${width}:${height}`;
}

// Fade out per clip:
function getFadeFilter(duration, clipDuration) {
  const fadeStart = Math.max(0, clipDuration - transitionDuration);
  return `,fade=t=out:st=${fadeStart}:d=${transitionDuration},fade=t=in:st=0:d=${transitionDuration}`;
}
```

*Frontend (`app.js`, dalam `render()` → imgGenBar)*:
```javascript
// Tambah di imgGenBar HTML:
`<select id="transitionType" style="min-width:130px">
  <option value="cut">⚡ Hard Cut</option>
  <option value="fade">🌅 Fade</option>
  <option value="zoom">🔍 Ken Burns Zoom</option>
</select>`

// Di assembleVideo(), tambah ke request body:
transition: document.getElementById('transitionType')?.value || 'cut',
```

**Dependencies**: Tidak ada (FFmpeg sudah ada)
**Effort**: 2-3 hari | **Risk**: Medium (FFmpeg filter chaining)

---

### A-02: Background Music Library

**Problem**: Video output tidak ada BGM. Creator harus tambah musik sendiri setelah download.

**Acceptance Criteria**:
- [ ] Minimal 8 royalty-free BGM tracks (lofi, energetic, cinematic, acoustic, dll)
- [ ] Volume BGM bisa diatur via slider (0-50%)
- [ ] BGM di-loop otomatis jika video lebih panjang dari track
- [ ] Preview play per track sebelum pilih
- [ ] Default: "No Music"

**Technical Spec**:

*Backend*:
```
/backend/assets/music/
  ├── lofi_chill.mp3
  ├── energetic_upbeat.mp3
  ├── cinematic_epic.mp3
  ├── acoustic_soft.mp3
  ├── electronic_minimal.mp3
  ├── jazz_smooth.mp3
  ├── nature_ambient.mp3
  └── corporate_clean.mp3
```
```javascript
// Route: GET /api/music/list
app.get('/api/music/list', (req, res) => {
  const musicDir = path.join(__dirname, 'assets', 'music');
  const tracks = fs.readdirSync(musicDir)
    .filter(f => f.endsWith('.mp3'))
    .map(f => ({
      id:    f.replace('.mp3', ''),
      url:   `/assets/music/${f}`,
      label: f.replace('.mp3', '').replace(/_/g, ' ').toUpperCase()
    }));
  res.json({ success: true, tracks });
});

// Di /api/video/assemble — setelah concat, tambah BGM mixing:
// const { bgmTrack, bgmVolume = 15 } = req.body;
// if (bgmTrack) {
//   const bgmPath = path.join(__dirname, 'assets', 'music', `${bgmTrack}.mp3`);
//   const vol = bgmVolume / 100;
//   const bgmCmd = `ffmpeg -y -i "${finalVideoPath}" -stream_loop -1 -i "${bgmPath}" `
//     + `-filter_complex "[1:a]volume=${vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]" `
//     + `-map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${finalWithMusicPath}"`;
// }
```

**Dependencies**: Royalty-free MP3 files (pixabay.com / freesound.org)
**Effort**: 2-3 hari | **Risk**: Low

---

### A-03: Custom Image Upload per Scene

**Problem**: User hanya bisa generate AI image. Tidak bisa upload foto product / footage asli.

**Acceptance Criteria**:
- [ ] Upload button di setiap scene card (📁 ikon, di samping ↻ Regenerate)
- [ ] Accepted: JPG, PNG, WEBP, max 5MB per file
- [ ] Image otomatis dipakai di video assembly
- [ ] Bisa di-overwrite lagi dengan AI generate

**Technical Spec**:

*Backend*:
```bash
cd backend && npm install multer
```
```javascript
const multer = require('multer');
const upload = multer({
  dest: tempDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  }
});

app.post('/api/upload/scene-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname) || '.jpg';
  const newPath = `${req.file.path}${ext}`;
  fs.renameSync(req.file.path, newPath);
  res.json({ success: true, imageUrl: `/temp/${path.basename(newPath)}` });
});
```

*Frontend (`app.js`)*:
```javascript
// Tambah di scene card HTML (di dalam sc-image-wrap):
`<label class="sc-upload-btn" title="Upload custom image">
  📁<input type="file" accept="image/*" onchange="uploadSceneImage(${idx}, this)" style="display:none">
</label>`

async function uploadSceneImage(sceneIdx, input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  const res  = await fetch('/api/upload/scene-image', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.success) {
    sceneImages[sceneIdx] = data.imageUrl;
    const card = document.querySelector(`.scene-card[data-idx="${sceneIdx}"]`);
    let img = card.querySelector('.sc-image-wrap img');
    if (!img) { img = document.createElement('img'); card.querySelector('.sc-image-wrap').appendChild(img); }
    img.src = data.imageUrl;
    card.querySelector('.sc-image-placeholder')?.style.setProperty('display', 'none');
    showToast(`📁 Scene ${sceneIdx + 1}: Custom image uploaded!`);
  }
}
```

**Dependencies**: multer
**Effort**: 1-2 hari | **Risk**: Low

---

### A-04: Replace native alert() dengan Custom Confirm Modal

**Problem**: 3 tempat masih pakai `window.alert()` — UX inconsistent dengan design system neobrutalism.

**Files to Change**: `app.js` baris 526, 530, 570

**Technical Spec**:
```javascript
// Tambah di app.js
function showConfirm(message, onConfirm, title = 'Konfirmasi') {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${title}</div>
      <div class="confirm-msg">${message}</div>
      <div class="confirm-actions">
        <button class="confirm-cancel" onclick="this.closest('.confirm-overlay').remove()">Batal</button>
        <button class="confirm-ok" id="confirmOkBtn">Ya, Lanjutkan</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmOkBtn').onclick = () => { overlay.remove(); onConfirm(); };
}
```

**Effort**: 4-6 jam | **Risk**: Very Low

---

## ═══════════════════════════════════════════
## PHASE B — MEDIUM FEATURES (TIER 2) ⚡
## ═══════════════════════════════════════════

### B-01: Real-time Progress Bar Video Assembly (SSE)

**Problem**: Video assembly 30-90 detik tanpa feedback realtime. User tidak tahu sudah di tahap mana.

**Acceptance Criteria**:
- [ ] Progress bar 0-100% update realtime saat assembly
- [ ] Status text: "Scene 1/7: Rendering...", "Concatenating...", "Done!"
- [ ] Jika error, pesan error tampil di progress bar
- [ ] SSE endpoint `GET /api/video/progress/:videoId`

**Technical Spec**:

*Backend*:
```javascript
// Map untuk menyimpan progress sementara
const assemblyProgress = new Map();

// GET /api/video/progress/:videoId — SSE
app.get('/api/video/progress/:videoId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const interval = setInterval(() => {
    const progress = assemblyProgress.get(req.params.videoId);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      if (progress.done || progress.error) {
        clearInterval(interval);
        res.end();
        assemblyProgress.delete(req.params.videoId);
      }
    }
  }, 500);
  
  req.on('close', () => clearInterval(interval));
});

// Di /api/video/assemble — emit progress di setiap scene loop:
// assemblyProgress.set(videoId, {
//   scene: i + 1, total: scenes.length,
//   pct: Math.round(((i + 1) / scenes.length) * 85),
//   status: `Scene ${i+1}/${scenes.length}: Rendering...`
// });
```

*Frontend*:
```javascript
// Di assembleVideo() — mulai EventSource sebelum POST:
const videoId = `vid_${Date.now()}`;
const evtSrc  = new EventSource(`/api/video/progress/${videoId}`);
evtSrc.onmessage = (e) => {
  const d = JSON.parse(e.data);
  document.getElementById('assemblyProgress').style.width = `${d.pct}%`;
  document.getElementById('assemblyStatusText').textContent = d.status;
  if (d.done || d.error) evtSrc.close();
};
```

**Effort**: 3-4 hari | **Risk**: Medium (SSE state management)

---

### B-02: Batch Storyboard Generation (3 Variasi)

**Problem**: User generate satu storyboard per request. Butuh trial & error untuk dapat yang terbaik.

**Acceptance Criteria**:
- [ ] Tombol "Generate 3 Variations" di sidebar (di bawah Generate Storyboard)
- [ ] 3 LLM request parallel dengan temperature berbeda (0.7, 0.9, 1.1)
- [ ] Tab switcher Variation 1 / 2 / 3 di result area
- [ ] Bisa pilih satu variasi untuk lanjut ke image gen & video

**Technical Spec**:

*Backend*:
```javascript
app.post('/api/llm/generate-batch', async (req, res) => {
  const { provider, model, apiKey, prompt, count = 3, customUrl } = req.body;
  const temperatures = [0.7, 0.9, 1.1];
  
  const promises = Array.from({ length: count }, (_, i) => {
    const { url, options, extractText } = buildProviderRequest(provider, model, apiKey, prompt, customUrl);
    const body = JSON.parse(options.body);
    body.temperature = temperatures[i];
    options.body = JSON.stringify(body);
    return fetch(url, options)
      .then(r => r.json())
      .then(data => extractText(data))
      .catch(err => null);
  });
  
  const results = await Promise.allSettled(promises);
  const texts = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
  res.json({ success: true, variations: texts });
});
```

**Effort**: 3-4 hari | **Risk**: Low (biaya 3x API calls)

---

### B-03: AI Scene Improvement ("✨ Improve" per Scene)

**Problem**: Setelah generate storyboard, tidak bisa refine 1 scene saja tanpa re-generate semua.

**Acceptance Criteria**:
- [ ] Tombol "✨ Improve" di setiap scene card
- [ ] Kirim ke LLM: context storyboard + scene saat ini + instruksi improve
- [ ] Scene di-replace dengan versi yang lebih baik
- [ ] Loading state di scene card saat improving

**Technical Spec**:
```javascript
// app.js
async function improveScene(sceneIdx) {
  const scene   = currentJSON.scenes[sceneIdx];
  const apiKey  = document.getElementById('apikey').value.trim();
  const model   = document.getElementById('model').value;
  
  const prompt = `You are a viral short-form video expert.
Storyboard context: Title="${currentJSON.title}", Platform="${currentJSON.platform}", Genre="${currentJSON.genre}"

Improve this scene to be MORE viral, engaging, and visually specific:
${JSON.stringify(scene, null, 2)}

Return ONLY the improved JSON scene object with same keys. No markdown, no explanation.`;

  const card = document.querySelector(`.scene-card[data-idx="${sceneIdx}"]`);
  card.classList.add('improving');

  try {
    const raw      = await callAPI(apiKey, model, prompt);
    const improved = safeParseJSON(raw);
    currentJSON.scenes[sceneIdx] = improved;
    document.getElementById('jp').textContent = JSON.stringify(currentJSON, null, 2);
    render(currentJSON);
    showToast(`✨ Scene ${sceneIdx + 1} improved!`);
  } catch (err) {
    showToast(`❌ Improve failed: ${err.message}`);
  } finally {
    card.classList.remove('improving');
  }
}
```

**Effort**: 1-2 hari | **Risk**: Low

---

### B-04: Shareable URL dari Storyboard

**Problem**: Tidak ada cara share storyboard ke klien/tim kecuali export JSON atau PNG.

**Acceptance Criteria**:
- [ ] Tombol "🔗 Share" di tab bar (sebelah Export Image)
- [ ] URL format: `?sb=BASE64_ENCODED_JSON` 
- [ ] Saat buka URL dengan `?sb=`, auto-load storyboard
- [ ] Warning jika storyboard terlalu besar (>8KB encoded)

**Technical Spec**:
```javascript
// app.js
function shareStoryboard() {
  if (!currentJSON) { showToast('⚠️ Belum ada storyboard!'); return; }
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(currentJSON))));
    if (encoded.length > 8000) {
      showToast('⚠️ Storyboard terlalu besar untuk URL. Gunakan Export JSON.');
      return;
    }
    const url = `${location.origin}${location.pathname}?sb=${encoded}`;
    navigator.clipboard.writeText(url);
    showToast('🔗 Share URL copied to clipboard!');
  } catch (e) { showToast('❌ Gagal generate share URL'); }
}

// Di init() — cek URL params:
const sbParam = new URLSearchParams(location.search).get('sb');
if (sbParam) {
  try {
    currentJSON = JSON.parse(decodeURIComponent(escape(atob(sbParam))));
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultArea').style.display = '';
    render(currentJSON);
    showToast('📂 Storyboard loaded from shared URL!');
  } catch (e) { console.warn('[Share] Invalid URL param'); }
}
```

**Effort**: 4-6 jam | **Risk**: Very Low

---

## ═══════════════════════════════════════════
## PHASE C — GAME CHANGERS (TIER 3) 🎯
## ═══════════════════════════════════════════

### C-01: Dark Mode

**Problem**: UI only white/neobrutalism. Creator sering kerja malam, prefer dark.

**Acceptance Criteria**:
- [ ] Toggle button 🌙/☀️ di header kanan
- [ ] Preferensi tersimpan di localStorage
- [ ] Auto-detect `prefers-color-scheme` saat pertama buka
- [ ] Smooth CSS transition 300ms

**Technical Spec**:
```css
/* style.css */
[data-theme="dark"] {
  --black:  #E8E8E8;
  --white:  #0D0D0D;
  --gray:   #1A1A1A;
  --dgray:  #2A2A2A;
  --yellow: #FFE500;
  --border: 2.5px solid #333;
  --shadow: 4px 4px 0 #333;
}
body { transition: background .3s, color .3s; }
```

**Effort**: 2-3 hari | **Risk**: Medium (banyak color overrides)

---

### C-02: ElevenLabs TTS Integration

**Problem**: Google TTS kualitas robotic. Creator konten premium butuh suara lebih natural.

**Acceptance Criteria**:
- [ ] TTS provider selector: Google (free) | ElevenLabs (premium)
- [ ] Voice selection: Rachel, Josh, Bella, Antoni (5 voices)
- [ ] ElevenLabs API key via Settings Panel
- [ ] Fallback ke Google TTS jika key tidak ada

**Technical Spec**:

*Backend (`server.js`)*:
```javascript
const ELEVENLABS_VOICES = {
  rachel: 'EXAVITQu4vr4xnSDxMaL',
  josh:   'TxGEqnHWrfWFTfGW9XjX',
  bella:  'EXAVITQu4vr4xnSDxMaL',
  adam:   'pNInz6obpgDQGcFmaJgB',
  elli:   'MF3mGyEYCl7XYWbV9V6O'
};

// Di /api/tts/generate — tambah elabs branch:
if (ttsProvider === 'elevenlabs' && elevenLabsKey) {
  const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES.rachel;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    })
  });
  const audioBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(audioBuffer));
  return res.json({ success: true, audioUrl: `/temp/${fileName}` });
}
```

**Effort**: 2-3 hari | **Risk**: Low

---

### C-03: IndexedDB Migration untuk History & Storage

**Problem**: localStorage 5MB limit. Storyboard dengan banyak scene image bisa exceed limit.

**Acceptance Criteria**:
- [ ] History (storyboard data) pindah ke IndexedDB
- [ ] Max history items naik dari 20 → 50
- [ ] API keys & preferences tetap localStorage
- [ ] Migration otomatis dari localStorage lama → IndexedDB

**Technical Spec**:
```html
<!-- HTML: tambah CDN before app.js -->
<script src="https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js"></script>
```
```javascript
// app.js — replace history functions dengan async IndexedDB version
const { get: idbGet, set: idbSet } = idbKeyval;

async function addToHistory(data) {
  const entry = { id: Date.now(), title: data.title || 'Untitled', timestamp: new Date().toLocaleString('id-ID'), provider: currentProvider, data };
  const history = await idbGet('sbgen_history') || [];
  history.unshift(entry);
  if (history.length > 50) history.pop();
  await idbSet('sbgen_history', history);
  renderHistory();
}
```

**Dependencies**: idb-keyval (CDN, 5KB)
**Effort**: 2-3 hari | **Risk**: Medium (migration)

---

### C-04: Video Quality Selector

**Problem**: Output video fixed resolution. Tidak ada pilihan quality.

**Acceptance Criteria**:
- [ ] Quality selector: 720p (Fast) | 1080p (Standard) | 1440p (High)
- [ ] Estimated processing time info per quality
- [ ] Quality preference tersimpan di localStorage

**Technical Spec**:
```javascript
// server.js
const QUALITY_PRESETS = {
  '720p':  { multiplier: 1.0, crf: 23, preset: 'fast',   label: '720p — Fast (~30s)' },
  '1080p': { multiplier: 1.5, crf: 20, preset: 'medium', label: '1080p — Standard (~60s)' },
  '1440p': { multiplier: 2.0, crf: 18, preset: 'slow',   label: '1440p — High (~120s)' }
};

// Di /api/video/assemble:
const quality = QUALITY_PRESETS[req.body.quality || '720p'];
const finalWidth  = Math.round(width  * quality.multiplier);
const finalHeight = Math.round(height * quality.multiplier);
```

**Effort**: 1-2 hari | **Risk**: Low

---

## ═══════════════════════════════════════════
## PHASE D — STRATEGIC (TIER 4) 🌟
## ═══════════════════════════════════════════

### D-01: AI Thumbnail Generator

**Effort**: 3-5 hari | **Risk**: Low
**Note**: Generate YouTube/IG thumbnail otomatis setelah video selesai. Menggunakan DALL-E 3 / Flux dengan prompt dari storyboard title + genre.

---

### D-02: Watermark / Branding System

**Effort**: 2-3 hari | **Risk**: Low
**Note**: Upload logo PNG → FFmpeg overlay filter → pilih posisi corner & opacity. Sudah ada di roadmap.

---

### D-03: Runway ML / Kling AI Motion Video per Scene

**Effort**: 1-2 minggu | **Risk**: High (API cost)
**Note**: True motion video generation per scene (bukan static image slideshow). Premium feature, butuh API access berbayar.

---

### D-04: Content Calendar Generator

**Effort**: 2-3 minggu | **Risk**: Medium
**Note**: Generate 7-30 storyboard outline sekaligus. Export ke CSV / Google Sheets format.

---

## Dependencies Summary

| Package | Used For | Phase | Command |
|---|---|---|---|
| `express-rate-limit` | Rate limiting | SEC-01 | `npm i express-rate-limit` |
| `helmet` | Security headers | SEC-05 | `npm i helmet` |
| `multer` | File upload | A-03 | `npm i multer` |
| `nodemon` | Auto-restart (dev) | DX | `npm i -D nodemon` |
| `idb-keyval` | IndexedDB wrapper | C-03 | CDN only |

---

## Estimasi Effort Total

| Phase | Items | Estimasi Waktu |
|---|---|---|
| Phase 0 — Security | 5 fixes | 1-2 hari |
| Phase A — Quick Wins | 4 fitur | 1-2 minggu |
| Phase B — Medium | 4 fitur | 2-3 minggu |
| Phase C — Game Changers | 4 fitur | 1-2 bulan |
| Phase D — Strategic | 4 fitur | 2-4 bulan |
| **Total** | **21 items** | **~3-6 bulan** |
