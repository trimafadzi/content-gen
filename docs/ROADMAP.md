# 🗺️ Development Roadmap
# StoryBOARD GEN

| Field | Detail |
|---|---|
| **Last Updated** | 2026-07-20 |
| **Current Phase** | Phase 6 ✅ Done |

---

## Overview

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5          Phase 6
Storyboard  →  Bug Fix &    →  Visual Gen   →  Audio/TTS    →  Video        →  Settings &
Generator       UX Polish       per Scene       Pipeline        Assembly        Export Image
  ✅ Done       ✅ Done         ✅ Done         ✅ Done         ✅ Done         ✅ Done
```

---

## Phase 1: Storyboard Generator MVP ✅ DONE

**Goal**: Generate storyboard terstruktur dari input teks via AI

| Task | Status |
|---|---|
| Multi-provider LLM support (8 providers) | ✅ |
| Provider-specific API integration | ✅ |
| Neobrutalism UI design | ✅ |
| Content idea input form | ✅ |
| Parameter controls (durasi, rasio, platform, narasi) | ✅ |
| Genre multi-select chips | ✅ |
| Scene card visualization | ✅ |
| JSON export & copy | ✅ |
| Production tips generation | ✅ |
| Custom provider support | ✅ |
| Basic responsive layout | ✅ |

**Deliverable**: `storyboard_generator_neobrutalism.html` (monolith MVP)

---

## Phase 2: Bug Fix & UX Polish ✅ DONE

**Goal**: Fix known bugs, improve UX, add persistence, and modularize code

### 2.1 — Critical Bug Fixes
| Task | Priority | Status |
|---|---|---|
| Fix `<mono>` invalid HTML tag → `<span class="mono">` | P0 | ✅ |
| Add missing `<title>` tag | P0 | ✅ |
| Fix `#erBar` missing `class="err-bar"` | P0 | ✅ |
| Add meta description & SEO tags | P1 | ✅ |

### 2.2 — CORS & Backend Proxy
| Task | Priority | Status |
|---|---|---|
| Setup Node.js + Express backend (port 3456) | P0 | ✅ |
| Create `/api/llm/generate` proxy endpoint | P0 | ✅ |
| Migrate frontend fetch calls to use proxy | P0 | ✅ |
| Add CORS configuration | P0 | ✅ |
| Error handling & retry logic | P1 | ✅ |

### 2.3 — UX Improvements
| Task | Priority | Status |
|---|---|---|
| localStorage for API key persistence | P1 | ✅ |
| localStorage for user preferences | P1 | ✅ |
| Loading skeleton animation | P1 | ✅ |
| Scene inline editing (click to edit) | P1 | ✅ |
| Storyboard history sidebar | P2 | ✅ |
| Download storyboard as PDF (via print media styles) | P2 | ✅ |
| Keyboard shortcuts (Ctrl+Enter, Esc, 1-3 Tab switching) | P2 | ✅ |

### 2.4 — Code Refactor
| Task | Priority | Status |
|---|---|---|
| Extract CSS to separate file (`frontend/css/style.css`) | P1 | ✅ |
| Extract JS to separate modules (`frontend/js/app.js`) | P1 | ✅ |
| Rename variables to clean/descriptive names | P1 | ✅ |
| Add code comments & modular structure | P2 | ✅ |

---

## Phase 3: Visual Generation per Scene ✅ DONE

**Goal**: Generate image/visual preview untuk setiap scene dengan konsistensi gaya

| Task | Priority | Status |
|---|---|---|
| Image provider integration (Pollinations, DALL-E, Stability, Together AI Flux) | P0 | ✅ |
| Backend route `/api/image/generate` | P0 | ✅ |
| Image preview container di scene card | P0 | ✅ |
| Image regeneration button per scene | P1 | ✅ |
| Style presets (Realistic, Anime, 3D Pixar, Cyberpunk, Vector, Miniature) | P1 | ✅ |
| Visual consistency / style lock across scenes (using locked seeds) | P1 | ✅ |
| Image gallery & selection | P2 | 🔴 (Out of Scope for MVP) |
| Custom image upload per scene | P2 | 🔴 (Out of Scope for MVP) |

---

## Phase 4: Audio & TTS Pipeline ✅ DONE

**Goal**: Generate narration audio dan SFX per scene

| Task | Priority | Status |
|---|---|---|
| Edge-TTS / Google-TTS integration (zero keys needed) | P0 | ✅ |
| Backend route `/api/tts/generate` with local MD5 caching | P0 | ✅ |
| Voice selection UI (automatic via narration language) | P1 | ✅ |
| Audio preview playback button per scene card | P0 | ✅ |
| ElevenLabs integration (premium option) | P2 | 🔴 (Optional future upgrade) |
| Background music selection | P2 | 🔴 (Out of Scope for MVP) |
| SFX library integration | P2 | 🔴 (Out of Scope for MVP) |
| Audio waveform display | P2 | 🔴 (Out of Scope for MVP) |

---

## Phase 5: Video Assembly & Export 🔄 NEXT

**Goal**: Combine images + audio → final video MP4

| Task | Priority | Status |
|---|---|---|
| FFmpeg installation & wrapper service | P0 | ✅ |
| Backend route `/api/video/assemble` | P0 | ✅ |
| Scene image → video frame conversion | P0 | ✅ |
| Audio overlay (narration + BGM) | P0 | ✅ |
| Scene transitions (fade, cut, zoom) | P1 | 🔴 |
| Text overlay / subtitle burn-in | P1 | ✅ |
| Video preview player | P0 | ✅ |
| MP4 download (720p / 1080p) | P0 | ✅ |
| Progress indicator | P1 | ✅ |
| Timeline drag & drop editor | P2 | 🔴 |
| Batch generation mode | P2 | 🔴 |
| Watermark / branding | P2 | 🔴 |

---

## Phase 6: Settings Panel & Export as Image ✅ DONE

**Goal**: Persistent API key management dan export storyboard sebagai gambar PNG profesional

| Task | Priority | Status |
|---|---|---|
| Settings button di sidebar | P0 | ✅ |
| Settings modal dengan grid semua provider | P0 | ✅ |
| Toggle show/hide per API key | P1 | ✅ |
| Dot indikator key tersimpan | P1 | ✅ |
| Save All Keys / Clear All Keys | P0 | ✅ |
| Badge count di tombol settings | P1 | ✅ |
| Dokumentasi `SETTINGS_FEATURE.md` | P1 | ✅ |
| Export storyboard as PNG (html2canvas) | P0 | ✅ |
| Dark card export template (header + scene grid + tips + footer) | P0 | ✅ |
| Hero image di export header | P1 | ✅ |
| Metadata sidebar di export header | P1 | ✅ |
| Loading overlay saat render | P1 | ✅ |
| Auto-download PNG dengan nama file dinamis | P0 | ✅ |

---

## Phase Dependencies

```
Phase 1 (Done)
    │
    ▼
Phase 2 (Bug Fix + Backend Setup)  [Done]
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (Images)   Phase 4 (Audio)   [Done]
    │                  │
    └────────┬─────────┘
             ▼
        Phase 5 (Video Assembly)     [Done]
             │
             ▼
        Phase 6 (Settings + Export)  [Done]
```

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-12 | Separated CSS & JS into modular structures | Keeps the monolithic HTML file clean and scalable |
| 2026-07-12 | Used Google TTS API via backend proxy with local hash caching | Free, high-quality translation voices, saves network bandwidth |
| 2026-07-12 | Implemented visual presets & style seed lock for Pollinations/Flux | Insures consistent generation outputs across storyboard cards |
| 2026-07-12 | Keep vanilla JS for frontend (no framework) | Minimize complexity for MVP, reconsider at Phase 5 |
| 2026-07-12 | Use Node.js + Express for backend | Lightweight, same language as frontend |
| 2026-07-12 | FFmpeg for video assembly | Industry standard, open source |
| 2026-07-20 | Settings Panel menggunakan modal overlay bukan dedicated page | Lebih cepat diakses, tidak mengganggu main workflow |
| 2026-07-20 | html2canvas untuk Export as Image (frontend-only) | Tidak butuh backend baru, library ringan via CDN |
| 2026-07-20 | Export card menggunakan hidden div yang di-capture html2canvas | Memungkinkan desain template terpisah dari UI utama tanpa konflik style |
