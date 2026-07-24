// ==========================================
// FILE: music/error_handler.js
// Centralized error handler dengan:
// - Stack trace lengkap
// - Nama file + line number
// - Pesan ke admin bot
// - Error type classification
// ==========================================

const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../database/error.log');

// ─── Error categories ─────────────────────
const ERROR_TYPES = {
  NETWORK:   ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','fetch failed','network','socket'],
  TELEGRAM:  ['ETELEGRAM','Too Many Requests','message is not modified','Bad Request','Forbidden','bot was blocked','chat not found','USER_NOT_PARTICIPANT'],
  STREAM:    ['ntgcalls','NtgCalls','ffmpeg','stream','Voice Chat','VCG','Answer SDP','Offer SDP'],
  USERBOT:   ['SESSION','AUTH','FloodWait','teleproto','TelegramClient','getEntity','invoke'],
  YOUTUBE:   ['youtube','ytdl','RapidAPI','HTTP 4','HTTP 5','download'],
  PERMISSION:['not admin','not a member','kicked','CHAT_WRITE_FORBIDDEN','PEER_ID_INVALID'],
};

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  for (const [type, keywords] of Object.entries(ERROR_TYPES)) {
    if (keywords.some(k => msg.includes(k.toLowerCase()))) return type;
  }
  return 'UNKNOWN';
}

function getErrorLocation(err) {
  if (!err.stack) return 'unknown location';
  const lines = err.stack.split('\n');
  // Skip first line (error message), find first relevant file
  for (const line of lines.slice(1)) {
    if (line.includes('music-bot') && !line.includes('node_modules')) {
      const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
      if (match) {
        const file = path.basename(match[1]);
        return `${file}:${match[2]}`;
      }
    }
  }
  // Fallback: first line with a file path
  for (const line of lines.slice(1)) {
    const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
    if (match) {
      const file = path.basename(match[1]);
      return `${file}:${match[2]}`;
    }
  }
  return lines[1]?.trim() || 'unknown';
}

function formatStack(err) {
  if (!err.stack) return err.message || 'No stack trace';
  return err.stack
    .split('\n')
    .slice(0, 8)
    .map(l => l.trim())
    .join('\n');
}

// ─── Write to log file ─────────────────────
function writeLog(entry) {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${entry}\n`;
    fs.appendFileSync(LOG_FILE, line);
    // Keep log under 1MB
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 1024 * 1024) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const half    = content.slice(content.length / 2);
      fs.writeFileSync(LOG_FILE, half);
    }
  } catch {}
}

// ─── Notify admin ──────────────────────────
async function notifyAdmin(telegram, err, context = '') {
  const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!admins.length) return;

  const type     = classifyError(err);
  const location = getErrorLocation(err);
  const msg      = err.message || 'Unknown error';
  const icons    = { NETWORK:'🌐', TELEGRAM:'📱', STREAM:'🎵', USERBOT:'🤖', YOUTUBE:'📺', PERMISSION:'🔒', UNKNOWN:'❓' };

  const text = `<blockquote>${icons[type] || '❓'} <b>Error [${type}]</b>
━━━━━━━━━━━━━━━━━━━━
📍 <b>Lokasi:</b> <code>${location}</code>
💬 <b>Pesan:</b> ${msg.slice(0, 200)}
${context ? `📋 <b>Context:</b> ${context}` : ''}
🕐 <b>Waktu:</b> ${new Date().toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━
<i>Lihat error.log untuk detail lengkap.</i></blockquote>`;

  for (const adminId of admins) {
    try {
      await telegram.sendMessage(adminId, text, { parse_mode: 'HTML' });
    } catch {}
  }
}

// ─── Main safe-wrapper ─────────────────────
/**
 * Wrap an async handler with full error handling
 * @param {Function} fn - async (ctx) => {}
 * @param {string}   label - command/handler name for logging
 */
function safe(fn, label = 'handler') {
  return async (ctx, next) => {
    try {
      await fn(ctx, next);
    } catch (err) {
      const type     = classifyError(err);
      const location = getErrorLocation(err);
      const chatId   = ctx?.chat?.id;
      const userId   = ctx?.from?.id;
      const cmd      = ctx?.message?.text?.split(' ')[0] || label;

      // Log to console with colors
      console.error(`\n❌ [${label}] Error at ${location}`);
      console.error(`   Type   : ${type}`);
      console.error(`   Message: ${err.message}`);
      console.error(`   Chat   : ${chatId || 'N/A'}  User: ${userId || 'N/A'}`);
      if (global.NODE_ENV !== 'production') {
        console.error(`   Stack:\n${formatStack(err)}\n`);
      }

      // Write to log file
      writeLog(`[${label}] [${type}] at ${location} | chat:${chatId} user:${userId} | ${err.message}\n${formatStack(err)}`);

      // Notify admins (non-blocking)
      if (ctx?.telegram) {
        notifyAdmin(ctx.telegram, err, `cmd: ${cmd} | chat: ${chatId}`).catch(() => {});
      }

      // Reply to user with friendly message (if possible)
      if (ctx?.replyWithHTML) {
        const lang = chatId ? require('./settings').getLang(chatId) : 'id';
        const userMsg = getUserFriendlyMessage(type, err, lang);
        try {
          await ctx.replyWithHTML(`<blockquote>${userMsg}</blockquote>`);
        } catch {}
      }

      // Don't propagate - error handled
    }
  };
}

// ─── User-friendly error messages ─────────
function getUserFriendlyMessage(type, err, lang = 'id') {
  const messages = {
    id: {
      NETWORK:    '❌ <b>Koneksi bermasalah.</b>\nCoba lagi dalam beberapa detik.',
      TELEGRAM:   '❌ <b>Gagal mengirim pesan Telegram.</b>\nBot mungkin tidak punya izin.',
      STREAM:     '❌ <b>Gagal stream audio/video.</b>\nPastikan Voice Chat aktif dan userbot sudah jadi admin.',
      USERBOT:    '❌ <b>Userbot bermasalah.</b>\nCoba /musicstatus untuk cek status.',
      YOUTUBE:    '❌ <b>Gagal mengambil data YouTube.</b>\nCoba lagu lain atau cek RAPIDAPI_KEY.',
      PERMISSION: '❌ <b>Tidak ada izin.</b>\nPastikan bot dan userbot sudah jadi admin.',
      UNKNOWN:    '❌ <b>Terjadi kesalahan.</b>\nAdmin bot sudah diberitahu.',
    },
    en: {
      NETWORK:    '❌ <b>Connection issue.</b>\nPlease try again.',
      TELEGRAM:   '❌ <b>Telegram message failed.</b>\nBot may lack permissions.',
      STREAM:     '❌ <b>Stream failed.</b>\nMake sure Voice Chat is active.',
      USERBOT:    '❌ <b>Userbot issue.</b>\nCheck /musicstatus.',
      YOUTUBE:    '❌ <b>YouTube fetch failed.</b>\nTry another song.',
      PERMISSION: '❌ <b>No permission.</b>\nMake bot and userbot admin.',
      UNKNOWN:    '❌ <b>An error occurred.</b>\nAdmin has been notified.',
    },
  };
  const msgs = messages[lang] || messages.en;
  return msgs[type] || msgs.UNKNOWN;
}

// ─── Global uncaught handler setup ────────
function setupGlobalHandlers(telegram) {
  process.on('unhandledRejection', (reason, promise) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error('\n🔴 [UNHANDLED REJECTION]', err.message);
    console.error('   Location:', getErrorLocation(err));
    writeLog(`[UNHANDLED_REJECTION] ${err.message}\n${formatStack(err)}`);
    if (telegram) notifyAdmin(telegram, err, 'unhandledRejection').catch(() => {});
  });

  process.on('uncaughtException', (err) => {
    console.error('\n🔴 [UNCAUGHT EXCEPTION]', err.message);
    console.error('   Location:', getErrorLocation(err));
    writeLog(`[UNCAUGHT_EXCEPTION] ${err.message}\n${formatStack(err)}`);
    if (telegram) notifyAdmin(telegram, err, 'uncaughtException').catch(() => {});
    // Don't exit — keep bot running
  });
}

// ─── /errorlog command ─────────────────────
function registerErrorLogCommand(bot) {
  bot.command('errorlog', async (ctx) => {
    const userId = ctx.from.id;
    const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!admins.includes(String(userId))) return;

    try {
      if (!fs.existsSync(LOG_FILE)) {
        return ctx.replyWithHTML(`<blockquote>✅ Belum ada error tercatat.</blockquote>`);
      }
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const lines   = content.trim().split('\n').filter(Boolean);
      const last20  = lines.slice(-20).join('\n');
      const size    = (fs.statSync(LOG_FILE).size / 1024).toFixed(1);

      if (last20.length < 3500) {
        await ctx.replyWithHTML(
          `<blockquote>📋 <b>Error Log</b> (${lines.length} entri, ${size}KB)\n━━━━━━━━━━━━━━━━━━━━\n<pre>${last20.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></blockquote>`
        );
      } else {
        // Send as file
        await ctx.replyWithDocument(
          { source: LOG_FILE, filename: 'error.log' },
          { caption: `📋 Error log — ${lines.length} entri, ${size}KB` }
        );
      }
    } catch (e) {
      await ctx.replyWithHTML(`<blockquote>❌ Gagal baca log: ${e.message}</blockquote>`);
    }
  });

  bot.command('clearlog', async (ctx) => {
    const userId = ctx.from.id;
    const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!admins.includes(String(userId))) return;
    try {
      fs.writeFileSync(LOG_FILE, '');
      await ctx.replyWithHTML(`<blockquote>✅ Error log berhasil dikosongkan.</blockquote>`);
    } catch (e) {
      await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`);
    }
  });
}

module.exports = { safe, notifyAdmin, writeLog, setupGlobalHandlers, registerErrorLogCommand, classifyError, getErrorLocation };
