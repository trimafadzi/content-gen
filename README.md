# StoryBOARD GEN 🎬

> AI-powered storyboard-to-video generator untuk social media content creators.

Dari ide 1 kalimat → storyboard terstruktur → visual gambar per scene → narasi suara → video siap upload.

---

## ⚡ Quick Start

1. Jalankan backend server:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. Buka `http://localhost:3456` di browser Anda.
3. Klik **⚙ API Key Settings** di sidebar kiri → isi API key semua provider yang dibutuhkan → klik **Save All Keys**.
4. Ketik ide konten, pilih provider & parameter, lalu klik **Generate Storyboard**.
5. Setelah storyboard muncul, klik **Generate All Images** untuk merender visual tiap scene.
6. Klik tombol speaker untuk preview narasi audio per scene.
7. Klik **📸 Export Image** untuk mengekspor storyboard ke PNG bergaya dark card profesional.

---

## 📁 Project Structure

```
content-gen/
├── storyboard_generator_neobrutalism.html   # Main HTML entrypoint
├── frontend/
│   ├── css/
│   │   └── style.css                         # Modular CSS styles + export card dark theme
│   └── js/
│       └── app.js                            # Modular JS — generator, settings, export
├── backend/
│   ├── server.js                             # Express proxy API server (port 3456)
│   ├── package.json
│   └── temp/                                 # Saved TTS mp3 files & outputs (gitignored)
├── PRD.md                                    # Product Requirements Document
├── PROGRESS.md                               # Live progress tracker & checklists
├── README.md                                 # This file
└── docs/
    ├── ARCHITECTURE.md                       # Technical architecture & API design
    ├── ROADMAP.md                            # Development roadmap (5 phases)
    ├── CHANGELOG.md                          # Version history
    └── SETTINGS_FEATURE.md                   # Settings Panel — API Key Manager guide
```

---

## 📋 Documentation

| Document | Description |
|---|---|
| [PRD.md](./PRD.md) | Product requirements, features, user stories, success metrics |
| [PROGRESS.md](./PROGRESS.md) | Live progress tracker dengan task checklist |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture, API design, file structure |
| [ROADMAP.md](./docs/ROADMAP.md) | Development phases, dependencies, decision log |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Version history & release notes |
| [SETTINGS_FEATURE.md](./docs/SETTINGS_FEATURE.md) | Settings Panel — Persistent API Key Manager guide |

---

## 🗺️ Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Storyboard Generator MVP | ✅ Done |
| 2 | Bug Fix & UX Polish + Backend | ✅ Done |
| 3 | Visual/Image Generation per Scene | ✅ Done |
| 4 | Audio/TTS Pipeline | ✅ Done |
| 5 | Video Assembly & Export | ✅ Done |
| 6 | Settings Panel + Export as Image | ✅ Done |
| 6.1 | Backend Connect Button & UX Polish | ✅ Done |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS (Neobrutalism), Vanilla JS |
| Fonts | Space Grotesk, IBM Plex Mono |
| AI Providers | Anthropic, OpenAI, Gemini, OpenRouter, WeizeRouter (`wz/gpt-5.5`), Groq, DeepSeek, Mistral |
| Image Export | html2canvas@1.4.1 (CDN) |
| Backend | Node.js + Express |
| Audio/TTS | google-tts-api |
| Video | FFmpeg |

---

## ✨ Key Features (v3.6.1)

| Feature | Description |
|---|---|
| 🤖 Multi-provider LLM | 9 providers: Anthropic, OpenAI, Gemini, OpenRouter, WeizeRouter, Groq, DeepSeek, Mistral, Custom |
| 🎨 Image Generation | Pollinations (free), DALL-E, Stability AI, Together AI Flux, WeizeRouter |
| 🔊 Text-to-Speech | Google TTS via backend proxy, preview per scene |
| 🎬 Video Assembly | FFmpeg — scene images + audio → MP4 dengan subtitle |
| ⚙ Settings Panel | Persistent API key manager — simpan semua key sekali, berlaku selamanya |
| 📸 Export as Image | Ekspor storyboard ke PNG dark card profesional (html2canvas) |
| ⚡ Connect Button | Tombol reconnect backend otomatis muncul di header saat DIRECT MODE |
| 📂 History | Auto-simpan 20 storyboard terakhir di localStorage |
| ✏️ Inline Edit | Klik langsung di scene card untuk edit visual, camera, SFX, narasi |
| 🖨️ Export PDF | Print/save storyboard sebagai PDF via browser |

---

## 📊 Current Status

**Version**: v3.6.1
**Overall Progress**: MVP Complete + Settings Panel + Export as Image + Backend Connect Button
**Current Phase**: Maintenance & Feature Enhancements
