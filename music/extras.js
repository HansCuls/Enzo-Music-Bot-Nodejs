// ==========================================
// FILE: music/extras.js
// Fitur tambahan terinspirasi dari:
//   - AnonXMusic (Python) → Node.js port
//   - VCPlayerBot (Python) → Node.js port
//   - YukkiMusicBot (Python) → Node.js port
//
// Features:
//   /suggest   — Rekomendasikan lagu mirip
//   /topmix    — Autoplay lagu-lagu populer
//   /djmode    — Toggle DJ mode (hanya admin grup)
//   /adminsong — Admin-only play mode
//   /songinfo  — Info lengkap lagu saat ini
//   /stats     — Statistik bot
//   /ping      — Cek latency bot
//   /quickplay — Cari & langsung play (1 klik)
// ==========================================

const { Markup }  = require('telegraf');
const { safe, writeLog } = require('./error_handler');
const { searchYouTube, getVideoInfo } = require('./ytdl');
const queue        = require('./queue');
const { getLang, setDjMode, getDjMode } = require('./settings');
const { t }        = require('./i18n');

const { getCacheStats, clearOldCache } = require('./cache');
const startTime = Date.now();

// ─── Stats counter ────────────────────────
let globalStats = { songsPlayed: 0, searches: 0, downloads: 0 };

function incrementStat(key) {
  if (globalStats[key] !== undefined) globalStats[key]++;
}

// Curated popular playlists by genre
const TOP_MIXES = {
  pop: ['Shape of You Ed Sheeran', 'Blinding Lights The Weeknd', 'Stay Justin Bieber', 'Levitating Dua Lipa', 'Bad Guy Billie Eilish'],
  indonesia: ['Kangen Dewa 19', 'Sempurna Andra and The Backbone', 'Laskar Pelangi Nidji', 'Cinta Luar Biasa Andmesh', 'Aku Bukan Untukmu Rossa'],
  kpop: ['Dynamite BTS', 'How You Like That BLACKPINK', 'Psycho Red Velvet', 'Love Scenario iKON', 'Celebrity IU'],
  rnb: ['Mood 24kGoldn', 'Peaches Justin Bieber', 'Leave The Door Open Bruno Mars', 'Essence Wizkid', 'Good Days SZA'],
  rock: ['Bohemian Rhapsody Queen', 'Hotel California Eagles', 'Smells Like Teen Spirit Nirvana', 'Sweet Child O Mine Guns N Roses', 'Under The Bridge RHCP'],
};

module.exports = (bot) => {

  // ──────────────── /ping ────────────────
  bot.command('ping', safe(async (ctx) => {
    const start = Date.now();
    const msg   = await ctx.replyWithHTML(`<blockquote>🏓 Mengukur latency...</blockquote>`);
    const latency = Date.now() - start;
    const uptime   = formatUptime(Date.now() - startTime);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
      `<blockquote>🏓 <b>Pong!</b>\n\n⚡ Latency  : <b>${latency}ms</b>\n⏱ Uptime   : <b>${uptime}</b></blockquote>`,
      { parse_mode: 'HTML' }
    );
  }));

  // ──────────────── /stats ────────────────
  bot.command('stats', safe(async (ctx) => {
    const uptime = formatUptime(Date.now() - startTime);
    const state  = queue.get(ctx.chat.id);
    const active = state.isPlaying ? '🎵 Sedang Putar' : '⏹ Idle';
    const total  = state.tracks.length;
    await ctx.replyWithHTML(
      `<blockquote>📊 <b>Statistik Bot Musik</b>\n━━━━━━━━━━━━━━━━━━━━\n\n⏱ Uptime      : <b>${uptime}</b>\n🎵 Lagu Diputar: <b>${globalStats.songsPlayed}</b>\n🔍 Pencarian   : <b>${globalStats.searches}</b>\n⬇️ Download    : <b>${globalStats.downloads}</b>\n\n📋 Antrian Grup: <b>${total} lagu</b>\n▶️ Status      : <b>${active}</b></blockquote>`
    );
  }));

  // ──────────────── /djmode ────────────────
  bot.command('djmode', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    const lang   = getLang(chatId);
    // Only group admins can toggle
    try {
      const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
      if (!['administrator', 'creator'].includes(member.status)) {
        return ctx.replyWithHTML(`<blockquote>❌ Hanya admin grup yang bisa mengatur DJ Mode.</blockquote>`);
      }
    } catch {}
    const current = getDjMode(chatId);
    setDjMode(chatId, !current);
    const status = !current ? '🟢 Aktif' : '🔴 Nonaktif';
    const desc   = !current
      ? 'Hanya admin grup yang bisa menggunakan perintah musik.'
      : 'Semua anggota bisa menggunakan perintah musik.';
    await ctx.replyWithHTML(
      `<blockquote>🎧 <b>DJ Mode: ${status}</b>\n\n${desc}</blockquote>`
    );
  }));

  // ──────────────── /songinfo ────────────────
  bot.command('songinfo', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    const track  = queue.current(chatId);
    const state  = queue.get(chatId);
    if (!track) {
      return ctx.replyWithHTML(`<blockquote>❌ Tidak ada lagu yang sedang diputar.</blockquote>`);
    }
    const loopStatus = state.loop ? '🔂 Lagu' : state.loopQueue ? '🔁 Antrian' : '❌ Mati';
    await ctx.replyWithHTML(
      `<blockquote>🎵 <b>Info Lagu Saat Ini</b>\n━━━━━━━━━━━━━━━━━━━━\n\n📌 Judul    : <b>${track.title}</b>\n👤 Penyanyi : <b>${track.uploader}</b>\n⏱ Durasi   : <b>${track.durationFmt}</b>\n👁 Views    : <b>${track.viewsFmt}</b>\n🔁 Loop     : <b>${loopStatus}</b>\n🔊 Volume   : <b>${state.volume || 100}%</b>\n📋 Posisi   : <b>#${state.currentIndex + 1}/${state.tracks.length}</b>\n🔗 URL      : <a href="${track.url}">YouTube</a></blockquote>`,
      { disable_web_page_preview: true }
    );
  }));

  // ──────────────── /suggest ────────────────
  bot.command('suggest', safe(async (ctx) => {
    const chatId = ctx.chat.id;
    const lang   = getLang(chatId);
    const track  = queue.current(chatId);
    const query  = ctx.message.text.split(' ').slice(1).join(' ').trim()
                   || (track ? track.uploader : null);

    if (!query) {
      return ctx.replyWithHTML(
        `<blockquote>❓ Cara pakai: /suggest nama artis\nAtau gunakan saat lagu sedang diputar.\n\nContoh: /suggest Dewa 19</blockquote>`
      );
    }

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Mencari rekomendasi lagu dari <b>${query}</b>...</blockquote>`);

    try {
      const results = await searchYouTube(`${query} best songs`, 5);
      if (!results.length) {
        return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>❌ Tidak ada rekomendasi ditemukan.</blockquote>`, { parse_mode: 'HTML' }
        );
      }
      let text = `<blockquote>🎵 <b>Rekomendasi Lagu</b>\nBerdasarkan: <i>${query}</i>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((r, i) => {
        const title = r.title.length > 38 ? r.title.slice(0, 38) + '…' : r.title;
        text += `${i + 1}. <b>${title}</b>\n   👤 ${r.uploader} • ⏱ ${r.durationFmt}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\nKlik untuk tambah ke antrian:</blockquote>`;

      const buttons = results.map((r, i) => [
        Markup.button.callback(`${i + 1}. ${r.title.slice(0, 35)}`, `music_pick_${chatId}_${i}`)
      ]);
      buttons.push([Markup.button.callback('❌ Tutup', `music_cancel_${chatId}`)]);

      // Store in search cache (reuse existing search cache from music.js)
      // We store as global so music.js callback can handle it
      global._searchCache = global._searchCache || new Map();
      global._searchCache.set(String(chatId), results);

      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, text, {
        parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons)
      });
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ Error: ${e.message}</blockquote>`, { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────────── /topmix ────────────────
  bot.command('topmix', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    const genre  = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    const genres = Object.keys(TOP_MIXES);

    if (!genre || !TOP_MIXES[genre]) {
      const genreList = genres.map(g => `• <code>/topmix ${g}</code>`).join('\n');
      return ctx.replyWithHTML(
        `<blockquote>🎵 <b>Top Mix — Daftar Genre</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${genreList}\n\nContoh: /topmix indonesia</blockquote>`
      );
    }

    const songs   = TOP_MIXES[genre];
    const loadMsg = await ctx.replyWithHTML(
      `<blockquote>🎵 Menambahkan <b>Top Mix ${genre.toUpperCase()}</b> (${songs.length} lagu)...</blockquote>`
    );

    let added = 0;
    for (const songQuery of songs) {
      try {
        const results = await searchYouTube(songQuery, 1);
        if (results[0]) {
          queue.add(chatId, results[0]);
          added++;
        }
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }

    await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
      `<blockquote>✅ <b>Top Mix ${genre.toUpperCase()}</b> ditambahkan!\n\n🎵 ${added} lagu berhasil ditambahkan ke antrian.\n\nGunakan /play untuk mulai memutar jika belum ada lagu yang sedang diputar.</blockquote>`,
      { parse_mode: 'HTML' }
    );
  }));

  // ──────────────── /clearhistory ────────────────
  bot.command('clearhistory', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    const state = queue.get(ctx.chat.id);
    state.history = [];
    await ctx.replyWithHTML(`<blockquote>🗑 Riwayat lagu berhasil dihapus.</blockquote>`);
  }));

  // ──────────────── /musichelp (override full) ────────────────
  bot.command('musichelp', safe(async (ctx) => {
    const lang = getLang(ctx.chat.id);
    await ctx.replyWithHTML(t(lang, 'help_text'));
    // Send extras help too
    await ctx.replyWithHTML(
      `<blockquote>🎵 <b>Fitur Tambahan</b>
━━━━━━━━━━━━━━━━━━━━

<b>🔍 Rekomendasi &amp; Mix:</b>
/suggest &lt;artis&gt; — Rekomendasi lagu dari artis
/topmix &lt;genre&gt; — Tambah 5 lagu populer
   Genre: pop, indonesia, kpop, rnb, rock

<b>🎧 DJ Mode:</b>
/djmode — Toggle DJ mode (admin grup only)
   Aktif = hanya admin yang bisa kontrol musik

<b>📊 Info &amp; Statistik:</b>
/songinfo — Info lengkap lagu saat ini
/stats — Statistik penggunaan bot
/ping — Cek latency bot

<b>📢 Broadcast (Admin Bot Only):</b>
/broadcast — Info &amp; cara broadcast
/broadcastlist — Daftar semua grup
Forward pesan ke bot → konfirmasi → kirim

<b>🤖 Multi Userbot (Admin Bot Only):</b>
/musiclogin — Login userbot baru (di private)
/adduserbot — Alias untuk /musiclogin
/listuserbot — Daftar semua userbot
/deluserbot &lt;id&gt; — Hapus userbot

━━━━━━━━━━━━━━━━━━━━</blockquote>`
    );
  }));
};

// ─── Helpers ──────────────────────────────
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}h`);
  if (h) parts.push(`${h}j`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s % 60}d`);
  return parts.join(' ');
}

module.exports.incrementStat = incrementStat;
