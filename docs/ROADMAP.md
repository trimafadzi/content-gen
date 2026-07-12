# 🗺️ Development Roadmap
# StoryBOARD GEN

| Field | Detail |
|---|---|
| **Last Updated** | 2026-07-12 |
| **Current Phase** | Phase 1 ✅ → Phase 2 🔄 |

---

## Overview

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
Storyboard  →  Bug Fix &    →  Visual Gen   →  Audio/TTS    →  Video Assembly
Generator       UX Polish       per Scene       Pipeline        & Export
  ✅ Done       🔄 Next         🔴 Planned      🔴 Planned      🔴 Planned
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

**Deliverable**: `storyboard_generator_neobrutalism.html`

---

## Phase 2: Bug Fix & UX Polish 🔄 IN PROGRESS

**Goal**: Fix known bugs, improve UX, add persistence

### 2.1 — Critical Bug Fixes
| Task | Priority | Status |
|---|---|---|
| Fix `<mono>` invalid HTML tag → `<span class="mono">` | P0 | 🔴 |
| Add missing `<title>` tag | P0 | 🔴 |
| Fix `#erBar` missing `class="err-bar"` | P0 | 🔴 |
| Add meta description & SEO tags | P1 | 🔴 |

### 2.2 — CORS & Backend Proxy
| Task | Priority | Status |
|---|---|---|
| Setup Node.js + Express backend | P0 | 🔴 |
| Create `/api/llm/generate` proxy endpoint | P0 | 🔴 |
| Migrate frontend fetch calls to use proxy | P0 | 🔴 |
| Add CORS configuration | P0 | 🔴 |
| Error handling & retry logic | P1 | 🔴 |

### 2.3 — UX Improvements
| Task | Priority | Status |
|---|---|---|
| localStorage for API key persistence | P1 | 🔴 |
| localStorage for user preferences | P1 | 🔴 |
| Loading skeleton animation | P1 | 🔴 |
| Scene inline editing (click to edit) | P1 | 🔴 |
| Storyboard history sidebar | P2 | 🔴 |
| Download storyboard as PDF | P2 | 🔴 |
| Keyboard shortcuts | P2 | 🔴 |

### 2.4 — Code Refactor
| Task | Priority | Status |
|---|---|---|
| Extract CSS to separate file | P1 | 🔴 |
| Extract JS to separate modules | P1 | 🔴 |
| Rename minified variables to descriptive names | P1 | 🔴 |
| Add code comments & documentation | P2 | 🔴 |

---

## Phase 3: Visual Generation per Scene 🔴 PLANNED

**Goal**: Generate image/visual preview untuk setiap scene

| Task | Priority | Status |
|---|---|---|
| Image provider integration (DALL-E / Flux / Stable Diffusion) | P0 | 🔴 |
| Backend route `/api/image/generate` | P0 | 🔴 |
| Image preview di scene card | P0 | 🔴 |
| Image regeneration button per scene | P1 | 🔴 |
| Style presets (realistic, anime, 3D, miniature) | P1 | 🔴 |
| Visual consistency / style lock across scenes | P1 | 🔴 |
| Image gallery & selection | P2 | 🔴 |
| Custom image upload per scene | P2 | 🔴 |

**Dependency**: Phase 2 backend must be ready

---

## Phase 4: Audio & TTS Pipeline 🔴 PLANNED

**Goal**: Generate narration audio dan SFX per scene

| Task | Priority | Status |
|---|---|---|
| Edge-TTS integration | P0 | 🔴 |
| Backend route `/api/tts/generate` | P0 | 🔴 |
| Voice selection UI | P1 | 🔴 |
| Audio preview per scene | P0 | 🔴 |
| ElevenLabs integration (premium option) | P2 | 🔴 |
| Background music selection | P2 | 🔴 |
| SFX library integration | P2 | 🔴 |
| Audio waveform display | P2 | 🔴 |

**Dependency**: Phase 2 backend must be ready

---

## Phase 5: Video Assembly & Export 🔴 PLANNED

**Goal**: Combine images + audio → final video MP4

| Task | Priority | Status |
|---|---|---|
| FFmpeg installation & wrapper service | P0 | 🔴 |
| Backend route `/api/video/assemble` | P0 | 🔴 |
| Scene image → video frame conversion | P0 | 🔴 |
| Audio overlay (narration + BGM) | P0 | 🔴 |
| Scene transitions (fade, cut, zoom) | P1 | 🔴 |
| Text overlay / subtitle burn-in | P1 | 🔴 |
| Video preview player | P0 | 🔴 |
| MP4 download (720p / 1080p) | P0 | 🔴 |
| Progress indicator | P1 | 🔴 |
| Timeline drag & drop editor | P2 | 🔴 |
| Batch generation mode | P2 | 🔴 |
| Watermark / branding | P2 | 🔴 |

**Dependency**: Phase 3 & 4 must be ready

---

## Phase Dependencies

```
Phase 1 (Done)
    │
    ▼
Phase 2 (Bug Fix + Backend Setup)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (Images)   Phase 4 (Audio)   ← Can run in parallel
    │                  │
    └────────┬─────────┘
             ▼
        Phase 5 (Video Assembly)
```

> **Note**: Phase 3 dan 4 bisa dikerjakan paralel setelah Phase 2 selesai.

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-12 | Keep vanilla JS for frontend (no framework) | Minimize complexity for MVP, reconsider at Phase 5 |
| 2026-07-12 | Use Node.js + Express for backend | Lightweight, same language as frontend |
| 2026-07-12 | Edge-TTS as primary TTS | Free, good quality, supports Indonesian |
| 2026-07-12 | FFmpeg for video assembly | Industry standard, open source |
