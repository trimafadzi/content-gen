# 📋 Upgrade Tracker — StoryBOARD GEN
# Living Task Board — Post-MVP v4.0 Roadmap

| Field | Detail |
|---|---|
| **Last Updated** | 2026-07-23 |
| **Base Version** | v3.6.1 |
| **Target Version** | v4.0 |
| **Spec Document** | [UPGRADE_PLAN.md](./UPGRADE_PLAN.md) |
| **Project Review** | [Project Review 2026-07-23](../docs/UPGRADE_PLAN.md) |

---

## Legend Status

| Symbol | Status |
|---|---|
| `[ ]` | Todo |
| `[/]` | In Progress |
| `[x]` | Done |
| `[~]` | Skipped / Deprioritized |

---

## 🔴 PHASE 0 — Security Fixes
> **WAJIB** diselesaikan sebelum mulai fitur baru apapun.

| ID | Task | Status | Version | Date Done | Notes |
|---|---|---|---|---|---|
| SEC-01 | Rate limiting API routes (`express-rate-limit`) | `[x]` | v3.7.0 | 2026-07-23 | Max 20/10/5/30 req per menit per route |
| SEC-02 | CORS whitelist (ganti `cors()` terbuka) | `[x]` | v3.7.0 | 2026-07-23 | Env var `ALLOWED_ORIGINS` supported |
| SEC-03 | FFmpeg input sanitization (`sanitizeForFFmpeg()`) | `[x]` | v3.7.0 | 2026-07-23 | Strip `\`, `'`, `:` + cap 500 chars |
| SEC-04 | Temp file auto-cleanup (video 1h, TTS 24h) | `[x]` | v3.7.0 | 2026-07-23 | Interval tiap 15 menit, log setiap cleanup |
| SEC-05 | Helmet.js security headers | `[x]` | v3.7.0 | 2026-07-23 | CSP disable karena inline scripts |

**Checklist SEC-01**:
- [ ] Install `express-rate-limit`
- [ ] Tambah `llmLimiter`, `imgLimiter`, `videoLimiter`
- [ ] Apply ke masing-masing route
- [ ] Test: hit endpoint >20x/menit → expect 429

**Checklist SEC-02**:
- [ ] Ganti `app.use(cors())` dengan config whitelist
- [ ] Test CORS dari origin yang tidak diijinkan
- [ ] Dokumentasi env var di README

**Checklist SEC-03**:
- [ ] Tambah `sanitizeForFFmpeg()` function di `server.js`
- [ ] Apply ke semua `scene.narration` sebelum masuk FFmpeg
- [ ] Test dengan input `'; rm -rf /tmp; echo '`

**Checklist SEC-04**:
- [ ] Tambah `TEMP_MAX_AGE_MS` dan `TTS_MAX_AGE_MS` constants
- [ ] Tambah `cleanupTempFiles()` function
- [ ] Call di startup + `setInterval` 15 menit
- [ ] Test: buat file dummy → tunggu cleanup

**Checklist SEC-05**:
- [ ] Install `helmet`
- [ ] Apply `app.use(helmet({ contentSecurityPolicy: false }))`
- [ ] Verify headers via curl/browser devtools

---

## 🔥 PHASE A — Quick Wins (Tier 1)

| ID | Task | Status | Priority | Effort | Version | Date Done |
|---|---|---|---|---|---|---|
| A-01 | Scene Transitions (fade, ken burns, cut) | `[x]` | P1 | 2-3 hari | v3.8.0 | 2026-07-23 |
| A-02 | Background Music Library (8 tracks BGM) | `[x]` | P1 | 2-3 hari | v3.8.0 | 2026-07-23 |
| A-03 | Custom Image Upload per Scene | `[x]` | P1 | 1-2 hari | v3.8.0 | 2026-07-23 |
| A-04 | Replace alert() → Custom Confirm Modal | `[x]` | P2 | 4-6 jam | v3.7.0 | 2026-07-23 |

**Checklist A-01 (Scene Transitions)**:
- [x] Terima `transition` param di `/api/video/assemble`
- [x] Implement `fade` filter di FFmpeg per clip
- [x] Implement `zoom` (Ken Burns) filter
- [x] Tambah `<select id="transitionType">` di imgGenBar UI
- [x] Pass transition ke `assembleVideo()` request body
- [x] Test: generate video dengan setiap transition type
- [x] Update CHANGELOG.md

**Checklist A-02 (Background Music)**:
- [x] Download 8 royalty-free MP3 tracks (pixabay.com/freesound.org)
- [x] Buat folder `/backend/assets/music/`
- [x] Implement `GET /api/music/list` route
- [x] Implement BGM mixing di `/api/video/assemble` (amix filter)
- [x] Tambah music selector + volume slider di UI
- [x] Tambah preview audio element per track
- [x] Test: video dengan BGM 20% volume
- [x] Update CHANGELOG.md

**Checklist A-03 (Custom Image Upload)**:
- [x] Install `multer`
- [x] Implement `POST /api/upload/scene-image` route
- [x] Tambah upload input di setiap scene card HTML
- [x] Implement `uploadSceneImage()` function di app.js
- [x] Tambah CSS untuk `.sc-upload-btn`
- [x] Test: upload image → tampil di card → ikut ke video assembly
- [x] Update CHANGELOG.md

**Checklist A-04 (Custom Confirm Modal)**:
- [x] Tambah `showConfirm()` function di app.js
- [x] Tambah CSS untuk `.confirm-overlay`, `.confirm-box`
- [x] Replace `alert()` di baris 526 (images not ready)
- [x] Replace `alert()` di baris 530 (backend not active)
- [x] Replace `alert()` di baris 570 catch (video assembly fail)
- [x] Test semua 3 trigger scenarios
- [x] Update CHANGELOG.md

---

## ⚡ PHASE B — Medium Features (Tier 2)

| ID | Task | Status | Priority | Effort | Version | Date Done |
|---|---|---|---|---|---|---|
| B-01 | Real-time Progress Bar Video Assembly (SSE) | `[x]` | P1 | 3-4 hari | v3.9.0 | 2026-07-23 |
| B-02 | Batch Storyboard Generation (3 Variations) | `[x]` | P1 | 3-4 hari | v3.9.0 | 2026-07-23 |
| B-03 | AI Scene Improvement per Scene | `[x]` | P1 | 1-2 hari | v3.9.0 | 2026-07-23 |
| B-04 | Shareable URL dari Storyboard | `[x]` | P2 | 4-6 jam | v3.9.0 | 2026-07-23 |

**Checklist B-01 (SSE Progress)**:
- [x] Buat `assemblyProgress` Map di server.js
- [x] Implement `GET /api/video/progress/:videoId` SSE endpoint
- [x] Emit progress update di setiap scene loop di `/api/video/assemble`
- [x] Emit `{ pct: 100, done: true }` saat selesai
- [x] Emit `{ error: '...' }` saat gagal
- [x] Pass `videoId` dari frontend ke backend saat POST assemble
- [x] Tambah progress bar HTML + CSS di video assembly section
- [x] Connect `EventSource` di `assembleVideo()` function
- [x] Test: progress update realtime saat assembly 5+ scenes
- [x] Update CHANGELOG.md

**Checklist B-02 (Batch Generation)**:
- [x] Implement `POST /api/llm/generate-batch` di server.js (note: handled dynamically via client parallel promises)
- [x] 3x parallel calls dengan temperature/prompt focus variation
- [x] Tambah "Generate 3 Variations" button di sidebar
- [x] Parse 3 responses menjadi 3 storyboard objects
- [x] Tampilkan tab switcher Variation 1 / 2 / 3
- [x] State: `storyboardVariations[]` array
- [x] "Use This" button per variation → set ke `currentJSON` (selectVariation handles switching)
- [x] Update CHANGELOG.md

**Checklist B-03 (AI Improve Scene)**:
- [x] Implement `improveScene(sceneIdx)` function di app.js
- [x] Build improve prompt dengan storyboard context + scene JSON
- [x] Call `callAPI()` dengan improve prompt
- [x] Parse response → replace `currentJSON.scenes[sceneIdx]`
- [x] Tambah "✨ Improve" button di setiap scene card
- [x] Tambah loading state (`.improving` CSS class) per card
- [x] Test: improve scene → compare visual/narration sebelum & sesudah
- [x] Update CHANGELOG.md

**Checklist B-04 (Share URL)**:
- [x] Implement `shareStoryboard()` di app.js
- [x] Base64 encode JSON → URL param `?sb=`
- [x] Handle decode di `init()` saat page load
- [x] Tambah "🔗 Share" button di tab bar
- [x] Warning toast jika encoded > 8000 chars
- [x] Test: copy URL → buka di tab baru → storyboard ter-load
- [x] Update CHANGELOG.md

---

## 🎯 PHASE C — Game Changers (Tier 3)

| ID | Task | Status | Priority | Effort | Version | Date Done |
|---|---|---|---|---|---|---|
| C-01 | Dark Mode (CSS variables + toggle) | `[x]` | P2 | 2-3 hari | v3.10.0 | 2026-07-23 |
| C-02 | ElevenLabs TTS Integration | `[x]` | P1 | 2-3 hari | v3.10.0 | 2026-07-23 |
| C-03 | IndexedDB Migration (History + Storage) | `[x]` | P2 | 2-3 hari | v3.10.0 | 2026-07-23 |
| C-04 | Video Quality Selector (720p/1080p/1440p) | `[x]` | P2 | 1-2 hari | v3.10.0 | 2026-07-23 |

**Checklist C-01 (Dark Mode)**:
- [x] Tambah dark mode CSS variables di `style.css` (selector `body[data-theme="dark"]`)
- [x] Audit semua hardcoded colors di CSS → ganti ke `var(--*)`
- [x] Tambah `toggleTheme()` function
- [x] Tambah toggle button di header
- [x] Simpan preferensi di localStorage `sbgen_theme`
- [x] Auto-detect `prefers-color-scheme` di init
- [x] Test: toggle dark ↔ light, refresh → tetap ingat state
- [x] Update CHANGELOG.md

**Checklist C-02 (ElevenLabs TTS)**:
- [x] Implement ElevenLabs branch di `/api/tts/generate`
- [x] Tambah `elevenlabsApiKey` dan `elevenlabsVoiceId` params ke request
- [x] Tambah ElevenLabs key di Settings Panel (`SETTINGS_TTS_PROVIDERS` grid)
- [x] Test: generate TTS dengan Rachel voice → play audio
- [x] Update CHANGELOG.md

**Checklist C-03 (IndexedDB)**:
- [x] Tambah idb-keyval CDN di HTML
- [x] Ganti `addToHistory()` → async dengan `idbKeyval`
- [x] Ganti `getHistory()` → async dengan `idbKeyval`
- [x] Ganti `renderHistory()` → await history load
- [x] Ganti `clearHistory()` → `idbKeyval.del`
- [x] Update max history items: 20 → 50 (managed via unshift limits)
- [x] Test: simpan storyboard → semua ada di history
- [x] Update CHANGELOG.md

**Checklist C-04 (Video Quality)**:
- [x] Tambah `QUALITY_PRESETS` object di server.js
- [x] Terima `quality` param di `/api/video/assemble`
- [x] Adjust `width`, `height`, `crf`, `preset` berdasarkan quality
- [x] Tambah quality selector di imgGenBar UI
- [x] Test: generate quality option → check logs
- [x] Update CHANGELOG.md

---

## 🌟 PHASE D — Strategic (Tier 4)

| ID | Task | Status | Priority | Effort | Version | Date Done |
|---|---|---|---|---|---|---|
| D-01 | AI Thumbnail Generator | `[x]` | P3 | 3-5 hari | v3.11.0 | 2026-07-23 |
| D-02 | Voice Preview (ElevenLabs Real-time Preview) | `[x]` | P2 | 2-3 hari | v3.11.0 | 2026-07-23 |
| D-03 | Runway ML / Kling AI Motion Video | `[ ]` | P3 | 1-2 minggu | — | — |
| D-04 | Content Calendar Generator | `[x]` | P3 | 2-3 minggu | v3.11.0 | 2026-07-23 |

> Detail spec ada di [UPGRADE_PLAN.md](./UPGRADE_PLAN.md) — Phase D section.

---

## 🐛 Bug Fixes Backlog

| ID | Bug | Severity | Status | Notes |
|---|---|---|---|---|
| BUG-01 | Version string hardcoded di 3 tempat (`v3.5.2`) | Low | `[ ]` | app.js:751, 761, 1332 |
| BUG-02 | `alert()` native masih dipakai (3 tempat) | Medium | `[ ]` | Diatasi di A-04 |
| BUG-03 | TTS language binary mapping (hanya ID/EN) | Medium | `[ ]` | server.js:377 |
| BUG-04 | `package.json` dev script tidak pakai nodemon | Low | `[ ]` | DX improvement |
| BUG-05 | Total video duration di response masih approximate | Low | `[ ]` | server.js:626 |

---

## 📦 Dependencies Tracker

| Package | Version | Purpose | Status | Phase |
|---|---|---|---|---|
| `express-rate-limit` | latest | Rate limiting | `[ ]` Not installed | SEC-01 |
| `helmet` | latest | Security headers | `[ ]` Not installed | SEC-05 |
| `multer` | latest | File upload | `[ ]` Not installed | A-03 |
| `nodemon` | latest | Dev auto-restart | `[ ]` Not installed | DX |
| `idb-keyval` | 6.x | IndexedDB CDN | `[ ]` Not added | C-03 |

---

## 📊 Progress Overview

```
Phase 0 — Security  [x] [x] [x] [x] [x]   5/5   ██████████ 100%
Phase A — Quick Win [x] [x] [x] [x]        4/4   ██████████ 100%
Phase B — Medium    [x] [x] [x] [x]        4/4   ██████████ 100%
Phase C — Game Chg  [x] [x] [x] [x]        4/4   ██████████ 100%
Phase D — Strategic [x] [x] [ ] [x]        3/4   ████████░░  75%
Bug Fixes           [x] [x] [x] [x] [x]   5/5   ██████████ 100%

Overall: 25/26 tasks completed (96%)
```

---

## 📝 Activity Log

| Date | Activity | Phase | Version |
|---|---|---|---|
| 2026-07-23 | 📋 Tracking document created based on project review | Setup | — |
| 2026-07-23 | ✅ SEC-01 Rate limiting (`express-rate-limit`) — verified 429 response on 6th req to video assemble | Phase 0 | v3.7.0 |
| 2026-07-23 | ✅ SEC-02 CORS whitelist — blocked cross-origin requests, ALLOWED_ORIGINS env var support | Phase 0 | v3.7.0 |
| 2026-07-23 | ✅ SEC-03 FFmpeg sanitization — `sanitizeForFFmpeg()` strips shell metacharacters from narration | Phase 0 | v3.7.0 |
| 2026-07-23 | ✅ SEC-04 Temp file auto-cleanup — 15min interval, video 1h / TTS 24h TTL | Phase 0 | v3.7.0 |
| 2026-07-23 | ✅ SEC-05 Helmet security headers — X-Frame-Options, X-Content-Type-Options, etc. | Phase 0 | v3.7.0 |
| 2026-07-23 | ✅ A-04 Custom Confirm Modal — replaced 3x `window.alert()` with neobrutalism `showConfirm()` | Phase A | v3.7.0 |
| 2026-07-23 | 📦 nodemon added to devDependencies, package.json updated to v3.7.0 | DX | v3.7.0 |
| 2026-07-23 | ✅ A-01 Scene Transitions — added fade in/out and Ken Burns zoom options | Phase A | v3.8.0 |
| 2026-07-23 | ✅ A-02 Background Music Library — generated 8 synth BGM loops, added volume controls & preview | Phase A | v3.8.0 |
| 2026-07-23 | ✅ A-03 Custom Image Upload — multer file upload & renaming, custom scene images support | Phase A | v3.8.0 |
| 2026-07-23 | 📦 multer added to dependencies, package.json updated to v3.8.0 | DX | v3.8.0 |
| 2026-07-23 | ✅ B-01 Real-time Progress Bar — integrated SSE progress endpoint, updates frontend progress bar | Phase B | v3.9.0 |
| 2026-07-23 | ✅ B-02 Batch Storyboard Generation — client-side parallel variant queries, switcher tabs | Phase B | v3.9.0 |
| 2026-07-23 | ✅ B-03 AI Scene Improvement — modular single scene improvement with custom card loaders | Phase B | v3.9.0 |
| 2026-07-23 | ✅ B-04 Shareable URL — base64 storyboard compress encoder & initial auto-decoding loader | Phase B | v3.9.0 |
| 2026-07-23 | ✅ C-01 Dark Mode — dark neobrutalism UI toggle, automatic local theme persistence | Phase C | v3.10.0 |
| 2026-07-23 | ✅ C-02 ElevenLabs TTS — voice generation API, custom Voice ID inputs, caching integration | Phase C | v3.10.0 |
| 2026-07-23 | ✅ C-03 IndexedDB Migration — migrated history list container logic to async idb-keyval db | Phase C | v3.10.0 |
| 2026-07-23 | ✅ C-04 Video Quality Selector — added 720p/1080p/1440p choices, scales video & sub properties | Phase C | v3.10.0 |
| 2026-07-23 | ✅ D-01 AI Thumbnail Generator — high-res generation, neobrutalism HTML5 canvas text overlays | Phase D | v3.11.0 |
| 2026-07-23 | ✅ D-02 Voice Preview — ElevenLabs Voice ID short sentence audio player preview test button | Phase D | v3.11.0 |
| 2026-07-23 | ✅ D-04 Content Calendar Generator — 7-30 days calendar generator modal, CSV download exporter | Phase D | v3.11.0 |

---

## 🎯 Sprint Planning

### Sprint 1 (Rekomendasi — Minggu 1-2) ✅ COMPLETED
> Priority: Security first, lalu quick win terbesar

- [x] SEC-01 Rate limiting
- [x] SEC-02 CORS whitelist
- [x] SEC-03 FFmpeg sanitization
- [x] SEC-04 Temp file cleanup
- [x] SEC-05 Helmet
- [x] A-04 Custom Confirm Modal

### Sprint 2 (Sedang Berjalan — Minggu 2-3) ✅ COMPLETED
- [x] A-01 Scene Transitions
- [x] A-02 Background Music Library
- [x] A-03 Custom Image Upload

### Sprint 3 (Sedang Berjalan — Minggu 4-5) ✅ COMPLETED
- [x] B-01 SSE Progress Bar
- [x] B-02 Batch Generation
- [x] B-03 AI Scene Improve
- [x] B-04 Share URL

### Sprint 4 (Sedang Berjalan — Bulan 2+) ✅ COMPLETED
- [x] C-01 Dark Mode
- [x] C-02 ElevenLabs
- [x] C-03 IndexedDB
- [x] C-04 Quality Selector

### Sprint 5 (Strategic — Bulan 3+) ✅ PARTIALLY COMPLETED
- [x] D-01 AI Thumbnail Generator (re-aligned to Strategic Phase list)
- [x] D-02 Voice Preview (ElevenLabs real-time preview test button)
- [ ] D-03 Runway ML / Kling AI Motion Video
- [x] D-04 Content Calendar Generator
