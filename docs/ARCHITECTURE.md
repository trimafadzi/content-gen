# 🏗️ Technical Architecture Document
# StoryBOARD GEN

| Field | Detail |
|---|---|
| **Last Updated** | 2026-07-12 |
| **Status** | Draft |

---

## 1. Arsitektur Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                       │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Storyboard│  │ Image Preview │  │ Audio      │  │ Timeline │ │
│  │ Generator │  │ & Editor     │  │ Preview    │  │ Editor   │ │
│  └─────┬─────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│        │               │                │               │       │
│  ┌─────┴───────────────┴────────────────┴───────────────┴─────┐ │
│  │                     API Service Layer                       │ │
│  │   (fetch calls → backend proxy → LLM / Image / TTS APIs)   │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────┴───────────────────────────────────┐ │
│  │                    State Management                          │ │
│  │         (localStorage / IndexedDB / in-memory)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────┴──────────────────────────────────┐
│                      BACKEND (Node.js)                          │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ API Proxy │  │ Image Gen    │  │ TTS        │  │ Video    │ │
│  │ /api/llm  │  │ /api/image   │  │ /api/tts   │  │ Assembly │ │
│  └─────┬─────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│        │               │                │               │       │
│  ┌─────┴───────────────┴────────────────┴───────────────┴─────┐ │
│  │                    FFmpeg Pipeline                           │ │
│  │           (image + audio → video assembly)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    File Storage (temp/)                      │ │
│  │         generated images, audio, video output                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Current Architecture (v3.0)

### Stack
- **Frontend**: Single HTML file (vanilla HTML/CSS/JS)
- **Backend**: None (direct API calls from browser)
- **Styling**: Neobrutalism design system (CSS custom properties)
- **Fonts**: Space Grotesk + IBM Plex Mono (Google Fonts)

### File Structure (Current)
```
content-gen/
├── storyboard_generator_neobrutalism.html   # Single-page app (403 lines)
└── PRD.md                                    # This document
```

### Data Flow (Current)
```
User Input → Browser fetch() → LLM API → JSON response → Render Scene Cards
```

> ⚠️ **Known Issue**: Direct browser → API calls blocked by CORS for most providers.

---

## 3. Target Architecture (v5.0)

### Stack
- **Frontend**: Modular HTML/CSS/JS (atau migrate ke Vite jika disetujui)
- **Backend**: Node.js + Express
- **Video Processing**: FFmpeg (server-side)
- **Storage**: Temporary file storage (server disk)

### File Structure (Target)
```
content-gen/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── base.css            # Reset, variables, typography
│   │   ├── components.css      # Reusable components
│   │   └── layout.css          # Grid, sidebar, content area
│   ├── js/
│   │   ├── app.js              # Main app logic
│   │   ├── providers.js        # LLM provider configs
│   │   ├── api.js              # API service layer
│   │   ├── renderer.js         # Scene card rendering
│   │   ├── storage.js          # localStorage/IndexedDB
│   │   └── timeline.js         # Timeline editor (Phase 5)
│   └── assets/
│       └── icons/
│
├── backend/
│   ├── server.js               # Express server
│   ├── routes/
│   │   ├── llm.js              # LLM proxy routes
│   │   ├── image.js            # Image generation routes
│   │   ├── tts.js              # TTS generation routes
│   │   └── video.js            # Video assembly routes
│   ├── services/
│   │   ├── ffmpeg.js           # FFmpeg wrapper
│   │   ├── imageGen.js         # Image generation service
│   │   └── ttsGen.js           # TTS service
│   ├── temp/                   # Generated files (gitignored)
│   └── package.json
│
├── PROGRESS.md
└── README.md
```

### Data Flow (Target)
```
User Input
    │
    ▼
[1] Frontend → POST /api/llm → Backend Proxy → LLM API
    │                                              │
    ▼                                              ▼
[2] Storyboard JSON ◄─────────────────────── AI Response
    │
    ▼
[3] Per Scene → POST /api/image → Image Gen API → Scene Images
    │
    ▼
[4] Narration → POST /api/tts → TTS API → Audio Files
    │
    ▼
[5] Assembly → POST /api/video → FFmpeg Pipeline → MP4 Output
    │
    ▼
[6] Download Video ◄──────────────────────── GET /api/video/:id
```

---

## 4. API Endpoints (Backend — Target)

### LLM Proxy
```
POST /api/llm/generate
Body: { provider, model, apiKey, prompt }
Response: { success, data: { storyboard JSON } }
```

### Image Generation
```
POST /api/image/generate
Body: { provider, prompt, style, ratio, apiKey }
Response: { success, imageUrl, imageId }
```

### Text-to-Speech
```
POST /api/tts/generate
Body: { text, voice, language, speed }
Response: { success, audioUrl, audioId }
```

### Video Assembly
```
POST /api/video/assemble
Body: { storyboardId, scenes: [{ imageId, audioId, duration, transition }] }
Response: { success, jobId }

GET /api/video/status/:jobId
Response: { status: "processing"|"done"|"error", progress, videoUrl }

GET /api/video/download/:jobId
Response: MP4 file stream
```

---

## 5. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | Vanilla JS (for now) | Simplicity, no build step needed |
| Backend framework | Express.js | Lightweight, well-documented |
| Video processing | FFmpeg | Industry standard, free, powerful |
| TTS engine | Edge-TTS (primary) | Free, good quality, multi-language |
| Image gen | Multi-provider | Flexibility — user picks based on their API key |
| State management | localStorage + in-memory | No database needed for MVP |

---

## 6. Security Considerations

| Area | Approach |
|---|---|
| API keys | Passed per-request from frontend, never stored on backend |
| CORS | Backend configured with whitelist origin |
| Rate limiting | Express rate-limit middleware (100 req/min) |
| File cleanup | Temp files auto-deleted after 1 hour |
| Input validation | Sanitize all user inputs, limit prompt length |

---

## 7. Performance Targets

| Metric | Target |
|---|---|
| Storyboard generation | < 30 seconds |
| Image generation (per scene) | < 15 seconds |
| TTS generation (per scene) | < 10 seconds |
| Video assembly (30s video) | < 60 seconds |
| Total pipeline (30s video, 6 scenes) | < 5 minutes |
| Max concurrent video jobs | 3 |
