# 🎵 Music Bot Telegram — Versi Lengkap

Bot musik Telegram berbasis Node.js dengan fitur lengkap dan dukungan **5 bahasa**:
🇮🇩 Indonesia · 🇬🇧 English · 🇲🇾 Melayu · 🇸🇦 العربية · 🇹🇷 Türkçe

---

## 📦 Struktur File

```
music-bot/
├── index.js              ← Entry point utama
├── config.js             ← Load environment variables
├── login_userbot.js      ← CLI login userbot musik
├── .env.example          ← Template konfigurasi
├── package.json
├── database/             ← Auto-created saat runtime
│   ├── music_session.json
│   ├── music_settings.json
│   └── playlists.json
└── music/
    ├── music.js          ← Semua command musik
    ├── musicbot.js       ← Userbot manager + admin commands
    ├── queue.js          ← Queue manager per grup
    ├── ui.js             ← Builder UI player & tombol
    ├── ytdl.js           ← YouTube search & download
    ├── streamer.js       ← Stream audio ke Voice Chat
    ├── i18n.js           ← Sistem multi-bahasa (5 bahasa)
    ├── settings.js       ← Pengaturan per grup
    ├── lyrics.js         ← Fetch lirik (lyrics.ovh)
    └── playlist.js       ← Simpan/muat playlist
```

---

## ⚙️ Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Isi `config.js`
Buka file `config.js` dan isi nilai berikut:
```js
global.BOT_TOKEN    = 'TOKEN_BOT_KAMU';   // dari @BotFather
global.API_ID       = 12345678;            // dari my.telegram.org/apps
global.API_HASH     = 'api_hash_kamu';     // dari my.telegram.org/apps
global.RAPIDAPI_KEY = 'rapidapi_key';      // dari rapidapi.com
global.BOT_ADMINS   = '123456789';         // ID Telegram kamu
```

### 3. Login userbot musik
Gunakan `/musiclogin` di private chat dengan bot (tidak perlu CLI lagi).


---

## ⬇️ Setup yt-dlp (Direkomendasikan)

yt-dlp adalah downloader utama. RapidAPI tetap aktif sebagai backup otomatis.

**Bot otomatis install yt-dlp lewat `pip` saat startup kalau belum ada** — gak lagi
download binary langsung dari GitHub. Syaratnya cuma Python3 + pip harus ada di container
(cek egg/image Pterodactyl kamu, atau `apt install python3-pip` di startup command).

Kalau mau install manual duluan (opsional, biar startup pertama gak nunggu proses install):
```bash
# Command yang sama dipakai buat install PERTAMA KALI maupun UPDATE berkala
# (yt-dlp WAJIB sering di-update karena YouTube sering berubah)
pip install --upgrade --user --break-system-packages "yt-dlp[default]"
```
Extra `[default]` penting — itu yang bawa komponen `yt-dlp-ejs` (JS challenge solver) yang
sekarang wajib dipunya yt-dlp buat nembus proteksi YouTube. Tanpa ini kamu bakal ketemu
error `Requested format is not available` walau videonya normal. Bot juga otomatis nyuruh
yt-dlp pakai Node.js (yang pasti udah ada di container ini) sebagai JS runtime-nya, jadi
kamu gak perlu install Deno terpisah.

Kalau container kamu sama sekali gak punya Python3/pip, bot bakal warning di log dan
langsung pakai RapidAPI sebagai fallback.

**Urutan download:**
1. 🥇 **yt-dlp** — gratis, stabil, retry 3x otomatis
2. 🥈 **RapidAPI** — backup jika yt-dlp gagal, retry 2x otomatis

### 4. Jalankan bot
```bash
node index.js
# atau mode development:
npm run dev
```

---

## 🤖 Daftar Perintah Lengkap

### ▶️ Memutar Musik
| Perintah | Deskripsi |
|----------|-----------|
| `/play <judul/URL>` | Putar lagu dari pencarian atau link YouTube |
| `/search <judul>` | Cari 5 lagu, pilih dari tombol |
| `/skipto <no>` | Loncat ke nomor antrian tertentu |

### 🎛 Kontrol
| Perintah | Deskripsi |
|----------|-----------|
| `/pause` | Jeda lagu |
| `/resume` | Lanjutkan lagu |
| `/skip` | Lagu berikutnya |
| `/skip <n>` | Skip sejumlah N lagu |
| `/prev` | Lagu sebelumnya |
| `/stop` | Hentikan musik |
| `/loop` | Ganti mode loop: mati → lagu → antrian |
| `/seek <mm:ss>` | Loncat ke waktu tertentu |

### 🔊 Volume & Efek
| Perintah | Deskripsi |
|----------|-----------|
| `/volume <0-200>` | Atur volume (default: 100) |
| `/shuffle` | Acak urutan antrian |

### 📋 Antrian
| Perintah | Deskripsi |
|----------|-----------|
| `/queue` | Lihat antrian (paginasi 10 per halaman) |
| `/np` atau `/nowplaying` | Tampilkan player aktif |
| `/remove <no>` | Hapus lagu dari antrian |
| `/move <dari> <ke>` | Pindah posisi lagu |
| `/history` | Riwayat 15 lagu terakhir diputar |

### 🎤 Lirik
| Perintah | Deskripsi |
|----------|-----------|
| `/lyrics` | Lirik lagu yang sedang diputar |
| `/lyrics <judul>` | Cari lirik berdasarkan judul |

### ⬇️ Download
| Perintah | Deskripsi |
|----------|-----------|
| `/download <judul/URL>` | Unduh sebagai file MP3 |

### 📂 Playlist
| Perintah | Deskripsi |
|----------|-----------|
| `/playlist save <nama>` | Simpan antrian saat ini sebagai playlist |
| `/playlist load <nama>` | Muat playlist ke antrian |
| `/playlist list` | Tampilkan semua playlist tersimpan |
| `/playlist delete <nama>` | Hapus playlist |

### 🌐 Bahasa
| Perintah | Deskripsi |
|----------|-----------|
| `/setlang id` | 🇮🇩 Bahasa Indonesia |
| `/setlang en` | 🇬🇧 English |
| `/setlang ms` | 🇲🇾 Bahasa Melayu |
| `/setlang ar` | 🇸🇦 العربية |
| `/setlang tr` | 🇹🇷 Türkçe |
| `/language` | Tampilkan semua pilihan bahasa |

### ⚙️ Admin Bot
| Perintah | Deskripsi |
|----------|-----------|
| `/musiclogin` | Login userbot musik (di private chat) |
| `/musiclogout` | Logout userbot musik |
| `/musicstatus` | Cek status userbot |
| `/promote @user` | Jadikan user sebagai admin grup |

---

## 🎛 Tombol Player

Player menampilkan tombol interaktif:

```
[ ⏮ ]  [ ⏸ Jeda / ▶️ Lanjut ]  [ ⏭ ]
[ ⏹ Stop ]  [ 📋 Antrian ]  [ 🎤 Lirik ]
[ 🔂 Loop ]  [ 🔁 Loop Q ]  [ 🔀 Acak ]
[ 🔉- ]  [ 🔊+ ]  [ 🗑 Hapus ]
```

---

## 🔧 Alur Otomatis saat `/play`

1. ✅ Cek bot admin di grup
2. ✅ Cek userbot sudah login
3. ✅ Jika userbot belum di grup → **auto join**
4. ✅ Jika userbot belum admin → **auto promote**
5. ✅ Jika Voice Chat belum aktif → **auto start VC**
6. 🎵 Mulai putar lagu

---

## ⏳ Auto-Leave

Userbot keluar otomatis setelah **15 menit** tidak ada lagu di antrian.
Langsung aktif kembali ketika ada `/play` baru.

---

## 📝 Catatan Teknis

- **youtube-sr** — pencarian YouTube tanpa API key
- **RapidAPI youtube-mp310** — konversi YouTube → MP3 URL
- **@arnabxd/ntgcalls-napi** — streaming audio ke Telegram Voice Chat
- **teleproto** — client MTProto untuk userbot
- **lyrics.ovh** — API lirik gratis, tanpa key
- Settings & playlist tersimpan di folder `database/` (JSON)


---

## 🤖 Multi-Userbot (Hingga 4 Userbot)

Bot mendukung hingga **4 userbot** sekaligus. Setiap grup akan otomatis mendapat userbot dengan beban teringan.

### Login Userbot via Telegram (tanpa CLI)

1. **Buka private chat** dengan bot
2. Pastikan ID Telegram kamu sudah di `BOT_ADMINS` di file `.env`
3. Ketik `/musiclogin`
4. Ikuti wizard:
   - Masukkan nomor telepon: `+628xxx`
   - Masukkan kode OTP yang dikirim Telegram
   - (Jika ada 2FA) Masukkan password 2FA
5. Selesai! Userbot langsung aktif.

### Perintah Multi-Userbot
| Perintah | Deskripsi |
|----------|-----------|
| `/musiclogin` | Login userbot baru (private chat) |
| `/adduserbot` | Alias untuk /musiclogin |
| `/listuserbot` | Daftar semua userbot + status |
| `/deluserbot <id>` | Hapus userbot |
| `/musicstatus` | Status semua userbot |

---

## 📢 Broadcast ke Semua Grup

Khusus untuk **admin bot** (ID di `BOT_ADMINS`).

**Cara pakai:**
1. Buka private chat dengan bot
2. **Forward** pesan yang ingin di-broadcast ke bot
3. Bot tampilkan preview + konfirmasi
4. Klik **✅ Kirim ke N Grup**
5. Bot forward pesan ke semua grup terdaftar

**Perintah broadcast:**
| Perintah | Deskripsi |
|----------|-----------|
| `/broadcast` | Instruksi & info broadcast |
| `/broadcastlist` | Daftar semua grup terdaftar |

---

## ⚙️ Setup BOT_ADMINS

Di file `.env`:
```
BOT_ADMINS=123456789,987654321
```
Dapatkan ID Telegram kamu dari [@userinfobot](https://t.me/userinfobot).

---

## 🎵 Fitur Tambahan

| Perintah | Deskripsi |
|----------|-----------|
| `/suggest <artis>` | Rekomendasi 5 lagu dari artis |
| `/topmix <genre>` | Tambah 5 lagu populer (pop/indonesia/kpop/rnb/rock) |
| `/djmode` | Toggle DJ mode — hanya admin grup yang bisa kontrol |
| `/songinfo` | Info lengkap lagu yang sedang diputar |
| `/stats` | Statistik penggunaan bot |
| `/ping` | Cek latency bot |

---

## 🖥️ Deploy di VPS dengan PM2

### 1. Cek OS dan GLIBC (penting!)
```bash
ldd --version
cat /etc/os-release
```
Butuh minimal **GLIBC 2.32**. Kalau masih 2.31 (Debian Bullseye), upgrade OS:
```bash
# Ubuntu 22.04 / Debian Bookworm sudah punya GLIBC 2.35+
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js (minimal v18)
```bash
# Pakai NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cek versi
node --version  # v20.x.x
```

### 3. Install PM2
```bash
npm install -g pm2
```

### 4. Clone / upload project
```bash
# Upload via SCP, SFTP, atau git clone
scp -r music-bot/ user@vps-ip:/home/user/
```

### 5. Install dependencies
```bash
cd music-bot
npm install
pip install --upgrade --user --break-system-packages "yt-dlp[default]"   # opsional, bot bisa auto-install ini sendiri saat start
```

### 6. Isi config.js
```bash
nano config.js
# Isi BOT_TOKEN, API_ID, API_HASH, RAPIDAPI_KEY, BOT_ADMINS
```

### 7. Login userbot musik
```bash
# Jalankan bot dulu sekali untuk setup
node index.js
# Lalu di Telegram, kirim /musiclogin ke bot (private chat)
# Setelah login berhasil, stop bot (Ctrl+C) dan lanjut ke PM2
```

### 8. Jalankan dengan PM2
```bash
# Start bot
pm2 start ecosystem.config.js

# Lihat status
pm2 status

# Lihat logs realtime
pm2 logs music-bot

# Lihat logs error
pm2 logs music-bot --err

# Restart bot
pm2 restart music-bot

# Stop bot
pm2 stop music-bot

# Delete dari PM2
pm2 delete music-bot
```

### 9. Auto-start saat VPS reboot
```bash
pm2 startup
# Jalankan perintah yang muncul (sudo env ...)
pm2 save
```

### Struktur logs
```
database/
└── logs/
    ├── out.log      ← output normal
    └── error.log    ← error saja
```

### Tips PM2
```bash
# Monitor resource usage
pm2 monit

# Lihat info detail
pm2 show music-bot

# Reload tanpa downtime (kalau ada perubahan kode)
pm2 reload music-bot

# Clear logs
pm2 flush music-bot
```
