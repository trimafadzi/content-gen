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
3. Masukkan API key, ketik ide konten, lalu klik **Generate Storyboard**.
4. Setelah storyboard muncul, klik **Generate All Images** untuk merender visual tiap scene, dan klik tombol speaker di kolom Narasi untuk mendengarkan suaranya.

---

## 📁 Project Structure

```
content-gen/
├── storyboard_generator_neobrutalism.html   # Main HTML entrypoint (refactored)
├── frontend/
│   ├── css/
│   │   └── style.css                         # Modular CSS styles
│   └── js/
│       └── app.js                            # Modular JS application logic
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
    └── CHANGELOG.md                          # Version history
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

---

## 🗺️ Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Storyboard Generator MVP | ✅ Done |
| 2 | Bug Fix & UX Polish + Backend | ✅ Done |
| 3 | Visual/Image Generation per Scene | ✅ Done |
| 4 | Audio/TTS Pipeline | ✅ Done |
| 5 | Video Assembly & Export | 🔄 Next |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS (Neobrutalism), Vanilla JS |
| Fonts | Space Grotesk, IBM Plex Mono |
| AI Providers | Anthropic, OpenAI, Gemini, OpenRouter, WeizeRouter (`wz/gpt-5.5`), Groq, DeepSeek, Mistral |
| Backend | Node.js + Express |
| Audio/TTS | google-tts-api |
| Video (planned) | FFmpeg |

---

## 📊 Current Status

**Version**: v3.5.2
**Overall Progress**: 100% MVP + provider maintenance
**Current Phase**: MVP complete — provider maintenance
