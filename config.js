// ==========================================
// FILE: config.js
// ==========================================

// Token bot dari @BotFather
global.BOT_TOKEN = '';

// Dari my.telegram.org/apps
global.API_ID   = ;
global.API_HASH = '';

// RapidAPI Key (backup download)
global.RAPIDAPI_KEY = '';

// ID Telegram admin bot (pisahkan koma)
global.BOT_ADMINS = '';

// ─── Saluran / Channel ────────────────────
// Isi username channel (tanpa @) atau link t.me/...
global.CHANNEL_1      = '';   // ganti dengan link channel kamu
global.CHANNEL_1_NAME = '📢 Channel Utama';         // nama tampil di tombol

global.CHANNEL_2      = '';   // ganti dengan link channel ke-2
global.CHANNEL_2_NAME = '📣 Channel Update';        // nama tampil di tombol

// ─── Donasi ───────────────────────────────
// Link Saweria kamu
global.SAWERIA_URL  = ''; // ganti dengan link saweria kamu
global.SAWERIA_NAME = '';                    // nama saweria kamu

// ─── Path ─────────────────────────────────
global.MUSIC_SESSION_FILE = 'database/music_session.json';

// ─── Validasi ─────────────────────────────
if (!global.BOT_TOKEN || global.BOT_TOKEN === 'ISI_TOKEN_BOT_DISINI')
  console.warn('[config] ⚠️  BOT_TOKEN belum diisi!');
if (!global.API_ID || global.API_ID === 0)
  console.warn('[config] ⚠️  API_ID belum diisi!');
if (!global.API_HASH || global.API_HASH === 'ISI_API_HASH_DISINI')
  console.warn('[config] ⚠️  API_HASH belum diisi!');
