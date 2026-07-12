# 📝 Changelog
# StoryBOARD GEN

Semua perubahan penting pada proyek ini didokumentasikan di file ini.

Format: [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`

---

## [Unreleased]

### Planned
- Backend proxy server setup
- localStorage persistence
- Loading UX improvements
- Scene inline editing
- Code refactor (separate CSS/JS)

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
