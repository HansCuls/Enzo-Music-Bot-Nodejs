// ==========================================
// FILE: index.js — Entry point
// ==========================================

require('./config');

// Buat folder logs jika belum ada
const fs   = require('fs');
const path = require('path');
const logDir = path.join(__dirname, 'database/logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const { Telegraf }    = require('telegraf');
const { initPool }    = require('./music/userpool');
const { registerAdminCommands } = require('./music/musicbot');
const { setupGlobalHandlers, registerErrorLogCommand, safe } = require('./music/error_handler');
const { startAutoClear, getCacheStats } = require('./music/cache');
const setupStart      = require('./start');
const setupMusic      = require('./music/music');
const setupLogin      = require('./music/loginwizard');
const setupBroadcast  = require('./music/broadcast');
const setupExtras     = require('./music/extras');
const setupSettings   = require('./music/settings_menu');
const setupVideoPlay  = require('./music/videoplay');
const setupChannel    = require('./music/channelplay');
const setupLeave      = require('./music/leavemanager');

const bot = new Telegraf(global.BOT_TOKEN);

// ─── Register all modules ──────────────────
setupStart(bot);
setupLogin(bot);
registerAdminCommands(bot);
setupBroadcast(bot);
setupSettings(bot);
setupVideoPlay(bot);
setupChannel(bot);
  setupLeave(bot);
setupExtras(bot);
setupMusic(bot);

// ─── Error log commands ────────────────────
registerErrorLogCommand(bot);

// ─── Global Telegraf error handler ────────
bot.catch(async (err, ctx) => {
  const { writeLog, notifyAdmin, classifyError, getErrorLocation } = require('./music/error_handler');
  const type     = classifyError(err);
  const location = getErrorLocation(err);
  const chatId   = ctx?.chat?.id;
  const cmd      = ctx?.message?.text?.split(' ')[0] || 'callback';

  console.error(`\n❌ [bot.catch] [${type}] at ${location}`);
  console.error(`   ${err.message}`);
  writeLog(`[bot.catch] [${type}] at ${location} | chat:${chatId} cmd:${cmd} | ${err.message}\n${err.stack?.split('\n').slice(0,5).join('\n')}`);

  // Notify admins
  if (ctx?.telegram) {
    notifyAdmin(ctx.telegram, err, `catch: ${cmd} | chat: ${chatId}`).catch(() => {});
  }

  // Reply to user
  const lang = chatId ? require('./music/settings').getLang(chatId) : 'id';
  const msgs = {
    id: '❌ <b>Terjadi kesalahan.</b>\nAdmin bot sudah diberitahu.',
    en: '❌ <b>An error occurred.</b>\nAdmin has been notified.',
  };
  if (ctx?.replyWithHTML) {
    ctx.replyWithHTML(`<blockquote>${msgs[lang] || msgs.en}</blockquote>`).catch(() => {});
  }
});

// ─── Launch ────────────────────────────────
(async () => {
  console.log('[bot] 🚀 Memulai bot musik...');

  await initPool();
  const { getActiveCount, getPoolCount } = require('./music/userpool');
  console.log(`[bot] ✅ Pool: ${getActiveCount()}/${getPoolCount()} userbot aktif`);

  await bot.launch();
  console.log(`[bot] ✅ Berjalan! @${bot.botInfo?.username}`);

  // Setup global process error handlers AFTER bot is launched
  setupGlobalHandlers(bot.telegram);

  if (getPoolCount() === 0) {
    console.warn('[bot] ⚠️  Belum ada userbot! Gunakan /musiclogin di private chat.');
  }

  // Start cache auto-clear (every 24h, delete files > 7 days)
  startAutoClear(bot.telegram);
  const cacheInfo = getCacheStats();
  console.log(`[cache] 📦 Cache: ${cacheInfo.count} file, ${cacheInfo.sizeMB}MB`);

  // Auto-refresh sesi browser buat cookies YouTube (opsional — no-op kalau belum di-setup)
  require('./music/browser_session').startAutoRefresh(12);

  // Notify admins that bot started
  const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const adminId of admins) {
    bot.telegram.sendMessage(adminId,
      `<blockquote>✅ <b>Bot Musik Dimulai!</b>\n\n🤖 @${bot.botInfo?.username}\n⏱ ${new Date().toLocaleString('id-ID')}\n🎵 Userbot: ${getActiveCount()}/${getPoolCount()} aktif</blockquote>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }
})();

process.once('SIGINT',  () => { console.log('[bot] Shutting down...'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('[bot] Shutting down...'); bot.stop('SIGTERM'); });
