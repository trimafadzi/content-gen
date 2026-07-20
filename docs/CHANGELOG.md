# 📝 Changelog
# StoryBOARD GEN

Semua perubahan penting pada proyek ini didokumentasikan di file ini.

Format: [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`

---

## [Unreleased]

### Planned
- Custom transition effects between scenes (fade, blur, cross-zoom)
- Multi-track background music mixer
- Premium ElevenLabs integration for high quality voice models

---

## [3.6.1] — 2026-07-20

### Added
- ✨ **Backend Connect Button**: Tombol `⚡ Connect` muncul di header kanan saat backend tidak tersambung (DIRECT MODE). Sekali klik → otomatis retry koneksi ke `/api/health` & `/storyboard-api/health` dengan feedback visual animasi pulse & toast notifikasi.
- ✨ **Auto Show/Hide Connect Button**: Tombol disembunyikan otomatis saat backend berhasil terhubung, muncul kembali jika koneksi gagal.
- ✨ **Connecting State**: Saat retry berlangsung, tombol menampilkan `⏳ Connecting...` (disabled) dan badge berubah warna amber dengan animasi pulse.
- ✨ **Reconnect Feedback Toast**: Toast `✅ Backend berhasil terhubung!` atau `❌ Backend tidak ditemukan` setelah proses retry selesai.
- 🎨 **Connect Button CSS**: Style neobrutalism kuning dengan animasi `connectPulse` dua detik sekali dan hover effect geser shadow.

---

## [3.6.0] — 2026-07-20

### Added
- ✨ **Settings Panel — Persistent API Key Manager**: Tombol ⚙ API Key Settings di sidebar kiri membuka modal yang berisi input API key untuk semua provider (9 LLM + 4 Image providers) sekaligus, disimpan ke `localStorage`.
- ✨ **Settings Modal UX**: Toggle show/hide per key (👁/🙈), indikator dot hijau jika key sudah tersimpan, badge count di tombol Settings.
- ✨ **Save All Keys / Clear All**: Tombol simpan semua key sekaligus atau hapus semua key dengan konfirmasi.
- ✨ **Export Storyboard as Image (PNG)**: Tombol 📸 Export Image di tab bar mengekspor storyboard ke gambar PNG berformat dark storyboard card — header judul besar + hero image, metadata sidebar, 2-kolom grid scene dengan image/timecode/fields, Tips Creator section, dan footer metadata bar.
- ✨ **html2canvas Integration**: Menggunakan library `html2canvas@1.4.1` (CDN) untuk capture hidden export card div ke canvas lalu download sebagai PNG.
- ✨ **Dark Card Export Template**: Template CSS khusus untuk export card (`#exportCard`) dengan dark background `#0D0D0D`, yellow accent `#FFE500`, orange scene badges `#FF6B35`, tipografi Space Grotesk + IBM Plex Mono.
- ✨ **Loading Overlay saat Export**: Overlay animasi saat html2canvas sedang render.
- 📝 Dokumentasi `docs/SETTINGS_FEATURE.md` — step-by-step penggunaan Settings Panel.

### Fixed
- 🐛 API key di sidebar kini otomatis terisi dari Settings setelah `saveAllKeys()` dipanggil.
- 🐛 Export PDF dan Export Image sekarang tersedia bersamaan di tab bar (bukan saling mengganti).

---

## [3.5.3] — 2026-07-16

### Added
- ✨ Added image generation provider option `weizerouter` labeled `GPT-5.5 Prompt → Image`.
- ✨ Added backend image route support that uses WeizeRouter `wz/gpt-5.5` to enhance scene prompts, then renders via Pollinations because WeizeRouter does not expose `/v1/images/generations`.

### Fixed
- ✅ Image generation now uses the detected backend base path (`/storyboard-api`) instead of hardcoded `/api`, matching the public `/storyboard/` deployment.

---

## [3.5.2] — 2026-07-15

### Added
- ✨ Added WeizeRouter LLM provider (`weizerouter`) to the StoryBOARD GEN provider selector.
- ✨ Added GPT-5.5 model option `wz/gpt-5.5`.
- ✨ Added backend OpenAI-compatible route for WeizeRouter via `https://weizerouter.web.id/v1/chat/completions`.

### Verified
- ✅ `node --check backend/server.js` and `node --check frontend/js/app.js`.
- ✅ Restarted backend on port `3456` with PID `961932`.
- ✅ Verified `http://127.0.0.1:3456/api/health`, `http://103.59.161.81/storyboard/`, and `http://103.59.161.81/storyboard-api/health` returned HTTP 200.
- ✅ Added cache-busting script query `app.js?v=3.5.2-weizerouter` so mobile browsers load the latest provider config.
- ✅ Fixed public subpath backend detection by trying `/storyboard-api/health` and routing LLM calls to `/storyboard-api/llm/generate` when served from `/storyboard/`.

---

## [3.5.1] — 2026-07-12

### Fixed
- 🐛 Resilient JSON parsing in frontend (`safeParseJSON`): implemented robust regex-based JSON repair logic to automatically handle common LLM output syntax errors such as missing commas between scene objects/properties, trailing commas, and unescaped control characters (newlines, tabs, backslashes) inside string values.

---

## [3.5.0] — 2026-07-12

### Added
- ✨ FFmpeg Video Assembler Pipeline: server-side image-to-video compilation.
- ✨ Post endpoint `/api/video/assemble` to process scene visual frames and synchronize narration audio tracks.
- ✨ Comic-inspired Neobrutalism subtitles burned directly into video frames (DejaVuSans-Bold, yellow text `#FFE500`, thick black outline `borderw=4`).
- ✨ Center-crop scale logic (`force_original_aspect_ratio=increase,crop=720:1280`) ensuring vertical/horizontal clips fit screen canvas seamlessly without black bars.
- ✨ Interactive client-side Video Preview Player (styled neobrutalism widget) with auto-resizing aspect ratio bounds.
- ✨ Integrated direct MP4 video downloads.

---

## [3.4.0] — 2026-07-12

### Added
- ✨ Speech synthesis pipeline: integrated `google-tts-api` in Node.js backend.
- ✨ Post endpoint `/api/tts/generate` for speech generation.
- ✨ MD5-hash based static caching for speech files to optimize API load and speed.
- ✨ Interactive TTS audio preview speaker buttons per scene card in the storyboard UI.
- ✨ Automatic audio URL caching in state JSON.

---

## [3.3.0] — 2026-07-12

### Added
- ✨ Multi-provider visual generation support (Pollinations, DALL-E, Stability AI, Together AI Flux).
- ✨ Visual style presets (Cinematic Photo, Anime, 3D Pixar, Cyberpunk, Vector Art, Miniature).
- ✨ Style Lock / Visual Consistency feature using unified generation seeds.
- ✨ Post endpoint `/api/image/generate` for server-side visual rendering proxy.
- ✨ Modular refactor: extracted styles into `frontend/css/style.css` and modules into `frontend/js/app.js`.

---

## [3.2.0] — 2026-07-12

### Added
- ✨ Local Node.js Express server setup on port 3456 acting as a CORS proxy.
- ✨ LocalStorage integration for API keys and input parameter preferences persistence.
- ✨ Storyboard History panel in the sidebar storing up to 20 storyboards locally.
- ✨ Interactive scene inline-editing directly on card visual, narration, camera, and sfx fields.
- ✨ Custom media print stylesheet enabling clean PDF printing and saving directly from browser.
- ✨ Keyboard shortcuts (Ctrl+Enter to generate, Esc to dismiss, 1-3 to switch tabs).

---

## [3.1.0] — 2026-07-12

### Fixed
- 🐛 Replaced invalid `<mono>` HTML tag with `<span class="mono">`
- 🐛 Added missing `<title>` tag in `<head>`
- 🐛 Added missing `class="err-bar"` to error bar element — styling now applied correctly

### Added
- 📝 SEO meta tags: `description`, `keywords`, `author`
- 📝 Open Graph tags: `og:title`, `og:description`, `og:type`
- 📝 Project documentation: PRD, Architecture, Roadmap, Changelog, Progress, README

---

## [3.0.0] — 2026-07-12

### Added
- ✨ Multi-provider LLM support (8 providers: Anthropic, OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Custom)
- ✨ Neobrutalism UI design system
- ✨ Provider-specific model selection
- ✨ Content idea textarea input
- ✨ Parameter controls: durasi (10/15/30/60 dtk), rasio (9:16, 16:9, 1:1), platform, narasi language
- ✨ Genre multi-select chips (ASMR, Tiny World, Tutorial, Comedy, Edukasi, Crypto, Aesthetic, Affiliate)
- ✨ Scene card grid visualization with timing, visual, camera, SFX, narration, micro action
- ✨ JSON view with syntax highlighting
- ✨ Copy JSON to clipboard
- ✨ Production tips display
- ✨ Custom provider with OpenAI-compatible endpoint support
- ✨ Status bar with spinner animation
- ✨ Error display bar
- ✨ Meta info row (durasi, scenes, rasio, genre, provider)
- ✨ Tab switching (Scenes / JSON / Tips)
- ✨ Responsive layout for mobile (breakpoint 700px)
- ✨ Custom scrollbar styling
- ✨ Google Fonts: Space Grotesk + IBM Plex Mono

### Known Issues
- 🐛 `<mono>` used as HTML tag (invalid — should be `<span>`)
- 🐛 Missing `<title>` tag in `<head>`
- 🐛 `#erBar` element missing `class="err-bar"` — error styling not applied
- 🐛 CORS blocking direct browser API calls for most providers
- 🐛 API key not persisted across page reloads
- 🐛 No input validation beyond empty checks

---

## [2.0.0] — Pre-history

> Previous versions not documented. v3.0 is the first documented version.

---

## Legend

| Emoji | Meaning |
|---|---|
| ✨ | New feature |
| 🐛 | Bug fix |
| 🔧 | Maintenance / refactor |
| 💥 | Breaking change |
| 📝 | Documentation |
| 🎨 | UI/UX improvement |
| ⚡ | Performance improvement |
| 🗑️ | Removed feature |
