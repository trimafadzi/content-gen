# 📋 Product Requirements Document (PRD)
# StoryBOARD GEN — AI Storyboard-to-Video Generator

| Field | Detail |
|---|---|
| **Product Name** | StoryBOARD GEN |
| **Version** | v3.0 → v4.0 (target) |
| **Author** | Content-Gen Team |
| **Created** | 2026-07-12 |
| **Last Updated** | 2026-07-12 |
| **Status** | 🟡 In Progress |

---

## 1. Ringkasan Eksekutif

StoryBOARD GEN adalah platform berbasis web untuk **membuat storyboard video social media secara otomatis menggunakan AI**, yang kemudian di-*generate* menjadi video siap upload. Platform ini menargetkan content creator yang ingin mempercepat workflow produksi konten short-form video (TikTok, YouTube Shorts, Instagram Reels).

### Problem Statement

Content creator menghadapi bottleneck di tahap **ideation → storyboard → produksi video**. Proses ini biasanya memakan waktu 2-4 jam per video. StoryBOARD GEN memangkas proses ini menjadi **hitungan menit** dengan AI-powered storyboard generation dan automated video assembly.

### Vision

> Dari ide 1 kalimat → storyboard terstruktur → video siap upload, dalam waktu kurang dari 5 menit.

---

## 2. Goals & Success Metrics

### Goals

| # | Goal | Target |
|---|---|---|
| G1 | Generate storyboard terstruktur dari input teks | ✅ Tercapai (v3.0) |
| G2 | Multi-provider LLM support | ✅ Tercapai (v3.0) |
| G3 | Generate visual/image per scene | 🔴 Belum |
| G4 | Generate narasi audio (TTS) | 🔴 Belum |
| G5 | Assembly video otomatis | 🔴 Belum |
| G6 | Export video siap upload | 🔴 Belum |

### Success Metrics (KPI)

| Metric | Target | Current |
|---|---|---|
| Storyboard generation success rate | > 95% | ~80% (CORS issues) |
| Time to generate storyboard | < 30 detik | ~10-15 detik |
| Time to generate full video | < 5 menit | N/A |
| Supported platforms | 4+ | 4 (TikTok, YouTube, IG, Twitter) |
| Supported LLM providers | 8 | 8 |
| User satisfaction (self-assessed) | > 4/5 | N/A |

---

## 3. Target Users

### Primary Persona: Content Creator "Rina"

| Attribute | Detail |
|---|---|
| **Usia** | 22-35 tahun |
| **Profesi** | Content creator / social media manager |
| **Platform** | TikTok, YouTube Shorts, Instagram Reels |
| **Pain Point** | Menghabiskan terlalu banyak waktu dari ide ke video jadi |
| **Tech Savvy** | Menengah — familiar dengan tools AI, punya API key |
| **Goal** | Produksi 5-10 video/minggu dengan effort minimal |

### Secondary Persona: "Budi" — Affiliate Marketer

| Attribute | Detail |
|---|---|
| **Usia** | 25-40 tahun |
| **Profesi** | Affiliate marketer / dropshipper |
| **Platform** | TikTok Shop, Instagram |
| **Pain Point** | Butuh banyak variasi konten cepat untuk promosi produk |
| **Goal** | Batch generate video promosi |

---

## 4. Feature Requirements

### Phase 1: Storyboard Generator (Current — v3.0) ✅

| ID | Feature | Priority | Status |
|---|---|---|---|
| F1.1 | Multi-provider LLM selection (8 providers) | P0 | ✅ Done |
| F1.2 | API key input & management | P0 | ✅ Done |
| F1.3 | Content idea input | P0 | ✅ Done |
| F1.4 | Parameter selection (durasi, rasio, platform, narasi) | P0 | ✅ Done |
| F1.5 | Genre selection (multi-select chips) | P1 | ✅ Done |
| F1.6 | Scene cards visualization | P0 | ✅ Done |
| F1.7 | JSON export & copy | P1 | ✅ Done |
| F1.8 | Tips generation | P2 | ✅ Done |
| F1.9 | Custom provider (OpenAI-compatible endpoint) | P1 | ✅ Done |
| F1.10 | Responsive mobile layout | P1 | ✅ Done |

### Phase 2: Bug Fix & UX Polish (v3.2) 🔧

| ID | Feature | Priority | Status |
|---|---|---|---|
| F2.1 | Fix HTML semantic issues (`<mono>`, missing `<title>`) | P0 | ✅ Done |
| F2.2 | Fix error bar missing CSS class | P0 | ✅ Done |
| F2.3 | Fix CORS issue — tambah backend proxy | P0 | ✅ Done |
| F2.4 | LocalStorage untuk API key & preferences | P1 | ✅ Done |
| F2.5 | Loading skeleton / better loading state | P1 | ✅ Done |
| F2.6 | Storyboard history (localStorage) | P2 | ✅ Done |
| F2.7 | Scene inline editing | P1 | ✅ Done |
| F2.8 | Download storyboard as PDF/PNG | P2 | ✅ Done |
| F2.9 | SEO meta tags | P2 | ✅ Done |

### Phase 3: Visual Generation (v3.3) 🎨

| ID | Feature | Priority | Status |
|---|---|---|---|
| F3.1 | Image generation per scene (DALL-E / Flux / Stable Diffusion) | P0 | ✅ Done |
| F3.2 | Image preview di scene card | P0 | ✅ Done |
| F3.3 | Image regeneration per scene | P1 | ✅ Done |
| F3.4 | Image style presets (realistic, anime, 3D, miniature) | P1 | ✅ Done |
| F3.5 | Image editing / adjustment per scene | P2 | 🔴 Cancelled (Out of Scope) |
| F3.6 | Visual consistency across scenes (style lock via seed mapping) | P1 | ✅ Done |

### Phase 4: Audio & TTS (v3.4) 🔊

| ID | Feature | Priority | Status |
|---|---|---|---|
| F4.1 | Text-to-Speech narration (Google-TTS proxy) | P0 | ✅ Done |
| F4.2 | Voice selection & preview | P1 | ✅ Done |
| F4.3 | Background music library | P2 | 🔴 Cancelled (Out of Scope) |
| F4.4 | SFX auto-matching per scene | P2 | 🔴 Cancelled (Out of Scope) |
| F4.5 | Audio timeline / waveform editor | P2 | 🔴 Cancelled (Out of Scope) |

### Phase 5: Video Assembly & Export (v5.0) 🎬

| ID | Feature | Priority | Status |
|---|---|---|---|
| F5.1 | Backend server (Node.js + Express) | P0 | 🔴 Todo |
| F5.2 | FFmpeg video assembly pipeline | P0 | 🔴 Todo |
| F5.3 | Scene transitions (fade, cut, zoom) | P1 | 🔴 Todo |
| F5.4 | Text overlay / subtitle burn-in | P1 | 🔴 Todo |
| F5.5 | Video preview player | P0 | 🔴 Todo |
| F5.6 | Export ke MP4 (720p/1080p) | P0 | 🔴 Todo |
| F5.7 | Timeline editor (drag & drop scenes) | P2 | 🔴 Todo |
| F5.8 | Batch video generation | P2 | 🔴 Todo |
| F5.9 | Watermark / branding option | P2 | 🔴 Todo |

---

## 5. User Stories

### Phase 1 (Current)
- **US-001**: Sebagai creator, saya ingin memilih provider AI agar bisa pakai API key yang sudah saya punya.
- **US-002**: Sebagai creator, saya ingin mengetik ide konten dan mendapat storyboard scene-by-scene agar tidak perlu menulis manual.
- **US-003**: Sebagai creator, saya ingin melihat breakdown per scene (visual, camera, SFX, narasi) agar bisa langsung syuting.
- **US-004**: Sebagai creator, saya ingin copy JSON output agar bisa diproses oleh tool lain.

### Phase 2
- **US-005**: Sebagai creator, saya ingin API key tersimpan agar tidak perlu input ulang setiap kali buka halaman.
- **US-006**: Sebagai creator, saya ingin bisa edit scene setelah generate agar bisa fine-tune storyboard.
- **US-007**: Sebagai creator, saya ingin melihat history storyboard sebelumnya agar bisa reuse atau compare.

### Phase 3-5
- **US-008**: Sebagai creator, saya ingin melihat preview visual per scene agar bisa bayangkan hasil akhir video.
- **US-009**: Sebagai creator, saya ingin mendengar preview narasi sebelum generate video.
- **US-010**: Sebagai creator, saya ingin download video final dalam format MP4 siap upload ke platform.

---

## 6. Non-Functional Requirements

| Requirement | Spec |
|---|---|
| **Performance** | Storyboard generation < 30 detik, video generation < 5 menit |
| **Browser Support** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **Responsive** | Usable di desktop (primary) dan mobile (secondary) |
| **Security** | API key tidak disimpan di server, hanya browser localStorage |
| **Scalability** | Stateless frontend, backend hanya untuk proxy & video assembly |
| **Accessibility** | Keyboard navigation, proper ARIA labels, minimum AA contrast |

---

## 7. Technical Constraints

| Constraint | Impact |
|---|---|
| CORS policy | API calls harus melalui backend proxy |
| FFmpeg | Video assembly harus di server-side |
| File size | Generated video harus < 500MB |
| API rate limits | Perlu implement retry & queue system |
| Browser storage | LocalStorage limit ~5MB, IndexedDB untuk data besar |

---

## 8. Out of Scope (v4.0)

- ❌ User authentication / login system
- ❌ Cloud storage untuk video
- ❌ Collaboration / multi-user editing
- ❌ Mobile native app
- ❌ Direct upload ke social media platform
- ❌ AI avatar / talking head generation

---

## 9. Milestones & Timeline

| Milestone | Target | Status |
|---|---|---|
| **M1** — Storyboard Generator MVP | Done | ✅ |
| **M2** — Bug Fix & UX Polish | TBD | 🔴 |
| **M3** — Backend Proxy Server | TBD | 🔴 |
| **M4** — Image Generation Integration | TBD | 🔴 |
| **M5** — TTS & Audio Pipeline | TBD | 🔴 |
| **M6** — Video Assembly & Export | TBD | 🔴 |
| **M7** — Final Polish & Launch | TBD | 🔴 |

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CORS blocking API calls | Tinggi | Tinggi | Buat backend proxy server |
| API cost tinggi untuk image gen | Sedang | Sedang | Support multiple image gen providers, fallback ke free tier |
| FFmpeg processing time lama | Sedang | Sedang | Implement queue system, progress indicator |
| Model output inconsistent | Sedang | Sedang | Structured output / JSON schema enforcement |
| API key security concern | Sedang | Tinggi | Encrypt localStorage, warning banner |

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **Storyboard** | Breakdown scene-by-scene dari sebuah video |
| **TTS** | Text-to-Speech — konversi teks ke suara |
| **FFmpeg** | Open-source tool untuk video processing |
| **SFX** | Sound effects |
| **CORS** | Cross-Origin Resource Sharing — browser security policy |
| **LLM** | Large Language Model — AI model untuk generate teks |
