// ==========================================
// FILE: music/ui.js
// Modern player UI — thumbnail + caption
// Progress bar dengan circle indicator
// Inspired by: AnonXMusic, YukkiMusicBot
// ==========================================

const { Markup } = require('telegraf');
const { t }      = require('./i18n');

// ─────────────────────────────────────────
// PROGRESS BAR — moving circle style
// ─────────────────────────────────────────
// Output: ━━━━━●──────────
function progressBar(currentMs, totalMs, length = 15) {
  if (!totalMs || totalMs <= 0 || !currentMs) return '─'.repeat(length);
  const ratio = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const pos   = Math.min(Math.round(ratio * length), length - 1);
  return '━'.repeat(pos) + '●' + '─'.repeat(length - pos - 1);
}

// ─────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────
function fmtMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loopIcon(state) {
  if (state.loop)      return '🔂';
  if (state.loopQueue) return '🔁';
  return '➖';
}

function volIcon(vol) {
  if (!vol || vol === 0) return '🔇';
  if (vol < 50)  return '🔈';
  if (vol < 120) return '🔉';
  return '🔊';
}

// ─────────────────────────────────────────
// PLAYER CAPTION — modern compact style
// ─────────────────────────────────────────
// track.duration is in MILLISECONDS (from youtube-sr)
function buildPlayerCaption(track, state, elapsedMs = 0, lang = 'id') {
  const totalMs   = track.duration || 0;
  const bar       = progressBar(elapsedMs, totalMs);
  const posStr    = fmtMs(elapsedMs);
  const totalStr  = track.durationFmt || fmtMs(totalMs);
  const vol       = state.volume ?? 100;
  const isPaused  = state.isPaused;
  const loop      = loopIcon(state);
  const vIcon     = volIcon(vol);
  const qPos      = `${state.currentIndex + 1}/${state.tracks.length}`;

  const title    = escHtml(track.title.length > 40 ? track.title.slice(0,40)+'…' : track.title);
  const uploader = escHtml((track.uploader||'Unknown').length > 26 ? (track.uploader||'Unknown').slice(0,26)+'…' : (track.uploader||'Unknown'));

  const badge = isPaused
    ? `⏸ <b>${escHtml(t(lang,'ui_paused')).toUpperCase()}</b>`
    : `🎧 <b>${escHtml(t(lang,'ui_now_playing')).toUpperCase()}</b>`;

  return `${badge}
━━━━━━━━━━━━━━━━━━━━
🎵 <b>${title}</b>
👤 <i>${uploader}</i>

${bar}
🕐 <code>${posStr}</code> / <code>${totalStr}</code>

${vIcon} <b>${vol}%</b>  ·  ${loop}  ·  📋 <b>${qPos}</b>  ·  👁 <b>${track.viewsFmt||'0'}</b>`;
}

// ─────────────────────────────────────────
// PLAYER BUTTONS
// ─────────────────────────────────────────

// ─── Colored button helpers (Bot API 9.4) ─
// style: 'primary' (biru), 'success' (hijau), 'danger' (merah)
function btn(text, callback_data, style = null) {
  const b = { text, callback_data };
  if (style) b.style = style;
  return b;
}
function btnUrl(text, url) {
  return { text, url };
}
function row(...buttons) { return buttons; }

function buildPlayerButtons(state, lang = 'id') {
  const c  = state.chatId;
  const ip = state.isPaused;
  // Pakai raw inline_keyboard untuk support colored buttons (Bot API 9.4)
  return {
    reply_markup: {
      inline_keyboard: [
        // Row 1: Kontrol utama
        [
          btn('⏮', `music_prev_${c}`),
          btn(ip ? t(lang,'ui_btn_resume') : t(lang,'ui_btn_pause'), `music_pause_${c}`, ip ? 'success' : 'primary'),
          btn('⏭', `music_skip_${c}`),
        ],
        // Row 2: Loop & Shuffle
        [
          btn(t(lang,'ui_btn_loop'),    `music_loop_${c}`),
          btn(t(lang,'ui_btn_loopq'),   `music_loopq_${c}`),
          btn(t(lang,'ui_btn_shuffle'), `music_shuffle_${c}`),
        ],
        // Row 3: Volume & Info
        [
          btn('🔉', `music_voldn_${c}`),
          btn('🔊', `music_volup_${c}`),
          btn(t(lang,'ui_btn_queue'),  `music_queue_${c}_0`),
          btn(t(lang,'ui_btn_lyrics'), `music_lyrics_${c}`),
        ],
        // Row 4: Playlist (hijau)
        [
          btn(t(lang,'ui_btn_save'), `music_savepl_${c}`, 'success'),
        ],
        // Row 5: Stop (merah) & Settings
        [
          btn(t(lang,'ui_btn_clear'), `music_clear_${c}`, 'danger'),
          btn('⚙️',                  `set_back_${c}`),
          btn(t(lang,'ui_btn_stop'), `music_stop_${c}`, 'danger'),
        ],
      ]
    }
  };
}

// ─────────────────────────────────────────
// SEND PLAYER (photo + caption)
// ─────────────────────────────────────────
async function sendPlayer(telegram, chatId, track, state, elapsedMs = 0, lang = 'id') {
  const caption = buildPlayerCaption(track, state, elapsedMs, lang);
  const buttons = buildPlayerButtons(state, lang);
  const thumb   = track.thumbnail;

  if (thumb) {
    try {
      const msg = await telegram.sendPhoto(chatId, thumb, {
        caption,
        parse_mode: 'HTML',
        ...buttons,
      });
      return { msgId: msg.message_id, isPhoto: true };
    } catch {
      // Fallback to text if photo fails
    }
  }

  // Fallback: text with blockquote
  const msg = await telegram.sendMessage(chatId,
    `<blockquote>${caption}</blockquote>`,
    { parse_mode: 'HTML', ...buttons }
  );
  return { msgId: msg.message_id, isPhoto: false };
}

// ─────────────────────────────────────────
// UPDATE PLAYER (edit caption or text)
// ─────────────────────────────────────────
async function updatePlayer(telegram, chatId, msgId, isPhoto, track, state, elapsedMs = 0, lang = 'id') {
  const caption = buildPlayerCaption(track, state, elapsedMs, lang);
  const buttons = buildPlayerButtons(state, lang);

  try {
    if (isPhoto) {
      await telegram.editMessageCaption(chatId, msgId, null, caption, {
        parse_mode: 'HTML',
        ...buttons,
      });
    } else {
      await telegram.editMessageText(chatId, msgId, null,
        `<blockquote>${caption}</blockquote>`,
        { parse_mode: 'HTML', ...buttons }
      );
    }
    return true;
  } catch (e) {
    if (!e.message?.includes('message is not modified')) {
      return false;
    }
    return true;
  }
}

// ─────────────────────────────────────────
// QUEUE TEXT (paginated)
// ─────────────────────────────────────────
function buildQueueText(state, page = 0, lang = 'id') {
  const perPage = 8;
  const total   = state.tracks.length;
  if (total === 0) return `<blockquote>${t(lang,'queue_empty_view')}</blockquote>`;

  const pages = Math.ceil(total / perPage) || 1;
  const p     = Math.max(0, Math.min(page, pages - 1));
  const start = p * perPage;
  const items = state.tracks.slice(start, start + perPage);
  const loopStatus = state.loop ? '🔂' : state.loopQueue ? '🔁' : '➖';

  let text = `<blockquote>📋 <b>${t(lang,'ui_queue_info')}</b>  <code>${total} ${t(lang,'ui_songs')}</code>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;

  items.forEach((track, i) => {
    const idx       = start + i;
    const isCurrent = idx === state.currentIndex;
    const num       = isCurrent ? '▶️' : `<code>${idx+1}</code>`;
    const dur       = track.durationFmt || fmtMs(track.duration);
    const title     = escHtml(track.title.length > 32 ? track.title.slice(0,32)+'…' : track.title);
    text += isCurrent
      ? `${num} <b>${title}</b> · <code>${dur}</code>\n`
      : `${num} ${title} · <code>${dur}</code>\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `${loopStatus} Loop  `;
  if (pages > 1) text += `📄 ${p+1}/${pages}`;
  text += `</blockquote>`;
  return text;
}

function buildQueueButtons(chatId, page = 0, totalPages = 1, lang = 'id') {
  const rows = [];
  if (totalPages > 1) {
    const navRow = [];
    if (page > 0)       navRow.push(btn('◀️', `music_queue_${chatId}_${page - 1}`));
    navRow.push(btn(`${page + 1}/${totalPages}`, 'noop'));
    if (page < totalPages - 1) navRow.push(btn('▶️', `music_queue_${chatId}_${page + 1}`));
    if (navRow.length) rows.push(navRow);
  }
  rows.push([btn(t(lang, 'ui_btn_back'), `music_player_${chatId}`, 'primary')]);
  return { reply_markup: { inline_keyboard: rows } };
}

// ─────────────────────────────────────────
// SEARCH RESULTS
// ─────────────────────────────────────────
function buildSearchText(results, query, lang = 'id') {
  let text = `<blockquote>${t(lang, 'search_results', escHtml(query))}`;
  results.forEach((r, i) => {
    const title = escHtml(r.title.length > 42 ? r.title.slice(0, 42) + '…' : r.title);
    text += `${i + 1}. <b>${title}</b>\n`;
    text += `   👤 ${escHtml(r.uploader)} · ⏱ ${r.durationFmt} · 👁 ${r.viewsFmt}\n`;
  });
  text += t(lang, 'search_pick_hint');
  text += `</blockquote>`;
  return text;
}

function buildSearchButtons(results, chatId, lang = 'id') {
  const rows = results.map((r, i) => [
    btn(`${i + 1}. ${sanitizeBtn(r.title)}`, `music_pick_${chatId}_${i}`, 'primary')
  ]);
  rows.push([btn('❌ ' + (lang === 'id' ? 'Batal' : 'Cancel'), `music_cancel_${chatId}`, 'danger')]);
  return { reply_markup: { inline_keyboard: rows } };
}

// ─────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────
function buildHistoryText(history, lang = 'id') {
  if (!history || history.length === 0) {
    return `<blockquote>${t(lang, 'history_empty')}</blockquote>`;
  }
  let text = `<blockquote>${t(lang, 'history_header')}`;
  history.slice(0, 15).forEach((track, i) => {
    const title = escHtml(
      track.title.length > 37 ? track.title.slice(0, 37) + '…' : track.title
    );
    const ago = timeAgo(track.playedAt);
    text += `${i + 1}. <b>${title}</b>\n   👤 ${escHtml(track.uploader)} · 🕐 ${ago}\n`;
  });
  text += `</blockquote>`;
  return text;
}

function timeAgo(ts) {
  if (!ts) return '?';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  return `${Math.floor(diff / 3600)}j lalu`;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function sanitizeBtn(str, maxLen = 38) {
  if (!str) return 'Unknown';
  return str
    .replace(/[^\x20-\x7E\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen) || 'Unknown';
}


// ─────────────────────────────────────────
// SAFE EDIT — handles both photo and text messages
// Automatically uses editMessageCaption for photos
// ─────────────────────────────────────────
async function safeEdit(ctx, text, extra = {}) {
  const msg  = ctx.callbackQuery?.message;
  const isPhoto = msg && (msg.photo || msg.animation || msg.video || msg.document);
  try {
    if (isPhoto) {
      await ctx.editMessageCaption(text, { parse_mode: 'HTML', ...extra });
    } else {
      await ctx.editMessageText(
        text.startsWith('<blockquote>') ? text : `<blockquote>${text}</blockquote>`,
        { parse_mode: 'HTML', ...extra }
      );
    }
  } catch (e) {
    if (!e.message?.includes('message is not modified') &&
        !e.message?.includes('no text in the message')) {
      throw e;
    }
  }
}

// DELETE message then SEND new player (for when song changes)
async function deleteAndSendPlayer(telegram, chatId, oldMsgId, track, state, lang) {
  // Delete old player message
  if (oldMsgId) {
    try { await telegram.deleteMessage(chatId, oldMsgId); } catch {}
  }
  // Send fresh new player
  return sendPlayer(telegram, chatId, track, state, 0, lang);
}

module.exports = {
  progressBar,
  buildPlayerCaption,
  buildPlayerButtons,
  sendPlayer,
  updatePlayer,
  safeEdit,
  deleteAndSendPlayer,
  buildQueueText,
  buildQueueButtons,
  buildSearchText,
  buildSearchButtons,
  buildHistoryText,
  fmtMs,
  escHtml,
};
