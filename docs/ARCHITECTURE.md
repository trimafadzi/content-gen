# 🏗️ Technical Architecture Document
# StoryBOARD GEN

| Field | Detail |
|---|---|
| **Last Updated** | 2026-07-15 |
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

## 2. Current Architecture (v3.5.2)

### Stack
- **Frontend**: HTML entrypoint (`storyboard_generator_neobrutalism.html`), modularized CSS (`frontend/css/style.css`), and modularized vanilla JS (`frontend/js/app.js`).
- **Backend**: Node.js + Express proxy server (running on port 3456) serving proxy endpoints for LLM (CORS-bypass), Image Generation, and TTS Narration.
- **LLM Providers**: Anthropic, OpenAI, Gemini, OpenRouter, WeizeRouter (`weizerouter` → `wz/gpt-5.5` via `https://weizerouter.web.id/v1/chat/completions`), Groq, DeepSeek, Mistral, and Custom OpenAI-compatible endpoints.
- **Audio/TTS**: Google Translate TTS integration with local MD5-hashed caching.
- **Visuals**: Pollinations AI (free), DALL-E, Stability, and Together AI (Flux) integration with Style presets and Style Lock.
- **State Management**: localStorage (keys, preferences) + in-memory state.

### File Structure (v3.5.2)
```
content-gen/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
│
├── frontend/
│   ├── css/
│   │   └── style.css           # Extracted styles
│   └── js/
│       └── app.js              # Main modular application logic
│
├── backend/
│   ├── server.js               # Express server (Port 3456)
│   ├── package.json
│   └── temp/                   # Cached TTS MP3 files
│
├── PRD.md
├── PROGRESS.md
├── README.md
└── storyboard_generator_neobrutalism.html   # Main HTML entrypoint
```

### Data Flow (v3.5.2)
```
User Input 
   │
   ▼
[1] Frontend (app.js) ──► Express Proxy Server (server.js)
   │                           │
   ├─► /api/llm/generate ──────┼─► Outbound LLM API (CORS Bypass)
   ├─► /api/image/generate ────┼─► Outbound Visual API (DALL-E/Flux)
   └─► /api/tts/generate ──────┼─► Outbound Google TTS API (MP3 Cache)
                               │
   ◄── JSON/Images/MP3 ────────┘
```

---

## 3. Target Architecture (v5.0)

### Stack (Future Additions)
- **Video Assembly**: FFmpeg (server-side) to compile images and audio into final MP4.
- **Subtitles Overlay**: FFmpeg subtitle burn-in.
- **Timeline Editor**: Client-side drag and drop sequence editor.

### File Structure (v5.0 target additions)
```
content-gen/
... (same as current)
├── backend/
│   ├── server.js
│   ├── services/
│   │   └── ffmpeg.js           # FFmpeg wrapper service for video compilation
│   └── temp/                   # Cached TTS MP3 files, generated video outputs
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
Body: { provider, model, apiKey, prompt, customUrl? }
Response: { success, text, meta: { provider, model, chars, elapsed_ms } }
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
