# ⚙ Settings Panel — API Key Manager

> Dokumentasi fitur Settings Panel yang ditambahkan ke StoryBOARD GEN.
> Versi: v3.6.0 | Tanggal: 2026-07-20

---

## Deskripsi Singkat

Fitur **Settings Panel** memungkinkan user untuk menyimpan API key semua provider sekali saja. Key disimpan secara persisten di browser (`localStorage`) sehingga tidak perlu di-input ulang setiap kali membuka atau me-reload aplikasi.

---

## Cara Menggunakan (Step-by-Step)

### Langkah 1 — Buka Settings

Klik tombol **⚙ API Key Settings** di sidebar kiri, tepat di bawah tombol Generate Storyboard.

```
Sidebar Kiri
├── [Provider Grid]
├── [API Key Input]
├── [Form fields...]
├── [▶ Generate Storyboard]
├── [⚙ API Key Settings]   ← Klik di sini
└── [📂 History]
```

### Langkah 2 — Isi API Key

Modal Settings akan terbuka. Di dalamnya terdapat dua section:

**🤖 LLM Providers** — untuk generate storyboard:
| Provider | Format Key |
|---|---|
| Anthropic | `sk-ant-api03-...` |
| OpenAI | `sk-...` |
| Gemini | `AIza...` |
| OpenRouter | `sk-or-v1-...` |
| WeizeRouter | `wzr_live_...` |
| Groq | `gsk_...` |
| DeepSeek | `sk-...` |
| Mistral | `...` |
| Custom API | Key milik sendiri |

**🎨 Image Providers** — untuk generate gambar scene:
| Provider | Format Key |
|---|---|
| OpenAI (DALL-E) | `sk-...` (sama seperti OpenAI) |
| Stability AI | `sk-...` (dari stability.ai) |
| Together AI | Key dari together.ai |
| WeizeRouter Images | `wzr_live_...` |

> **Note:** Provider **Pollinations** tidak butuh API key (gratis).

### Langkah 3 — Toggle Show/Hide

Klik tombol 👁 di kanan setiap input untuk melihat key yang sudah dimasukkan. Klik 🙈 untuk sembunyikan lagi.

### Langkah 4 — Simpan Key

Klik tombol **💾 Save All Keys** di bagian bawah modal.
- Toast `✅ N API key tersimpan!` akan muncul
- Modal otomatis tertutup
- Badge hijau `N KEYS` muncul di tombol Settings di sidebar

### Langkah 5 — Gunakan Langsung

Setelah disimpan, key langsung aktif. Pilih provider dari grid di sidebar — field API key di sidebar akan otomatis terisi dari key yang sudah tersimpan.

---

## Indikator Visual

| Elemen | Keterangan |
|---|---|
| 🟢 Dot hijau di label | Key sudah tersimpan untuk provider ini |
| ⚪ Dot abu-abu | Belum ada key tersimpan |
| Badge `N KEYS` di tombol Settings | Total key yang sudah tersimpan |

---

## Menghapus API Key

### Hapus Semua Key
Di dalam Settings modal, klik **🗑 Clear All** → konfirmasi → semua key terhapus.

### Hapus Key Satu Provider
Buka Settings → kosongkan input key provider tersebut → klik **Save All Keys**.

---

## Detail Teknis

### Penyimpanan Data

API key disimpan di `localStorage` browser dengan key:

```
sbgen_api_keys = {
  "anthropic": "sk-ant-...",
  "openai": "sk-...",
  "gemini": "AIza...",
  "img_openai": "sk-...",
  "img_stability": "sk-...",
  ...
}
```

### Fungsi-Fungsi Baru di `app.js`

| Fungsi | Deskripsi |
|---|---|
| `openSettings()` | Buka modal, populate grid dari localStorage |
| `closeSettings()` | Tutup modal, restore scroll |
| `handleOverlayClick(e)` | Tutup modal jika klik di luar panel |
| `buildSettingsGrid(id, providers)` | Render grid input key dari config |
| `toggleKeyVisibility(inputId, btn)` | Toggle show/hide password input |
| `updateDot(providerKey)` | Update indikator dot saat user mengetik |
| `saveAllKeys()` | Simpan semua key dari form ke localStorage |
| `clearAllKeys()` | Hapus seluruh API key dari localStorage |
| `updateSettingsKeyBadge()` | Update badge count di tombol Settings |

### Keyboard Shortcut

| Shortcut | Aksi |
|---|---|
| `Esc` | Tutup modal Settings (jika terbuka) |

### Keamanan

- Key **tidak pernah dikirim** ke server selain langsung ke endpoint provider yang dipilih
- Key tersimpan di `localStorage` browser — hanya bisa diakses oleh tab/domain yang sama
- Tidak ada logging atau analytics key

---

## Troubleshooting

**Key tidak tersimpan setelah reload?**
- Pastikan browser mengizinkan `localStorage` (tidak dalam mode Private/Incognito tanpa izin)
- Cek apakah ada extension browser yang memblokir `localStorage`

**Input field tidak muncul?**
- Klik tombol Settings sekali lagi untuk refresh grid
- Pastikan JavaScript tidak ada error di browser console

**Provider lama tidak menggunakan key baru?**
- Klik provider di grid sidebar untuk me-refresh key yang diload
- Atau reload halaman — init akan otomatis load key tersimpan

---

## Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| v3.6.0 | 2026-07-20 | Tambah Settings Panel — Persistent API Key Manager |
