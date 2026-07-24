// ==========================================
// FILE: music/loginwizard.js
// Login userbot via Telegram chat (no CLI)
// Supports: /musiclogin, /adduserbot
// Wizard steps: phone → OTP → (2FA) → done
// ==========================================

const { TelegramClient, Api } = require('teleproto');
const { safe, writeLog } = require('./error_handler');
const { StringSession }       = require('teleproto/sessions');
const { Markup }              = require('telegraf');
const pool                    = require('./userpool');
const { t }                   = require('./i18n');
const { getLang }             = require('./settings');

// ─── Wizard session store (in-memory) ─────
// key: userId  value: { step, client, phone, phoneCodeHash }
const sessions = new Map();

const STEPS = { IDLE: 0, PHONE: 1, OTP: 2, PASSWORD: 3 };

function getSession(userId) {
  return sessions.get(String(userId)) || null;
}
function setSession(userId, data) {
  sessions.set(String(userId), data);
}
function clearSession(userId) {
  sessions.delete(String(userId));
}

// ─── Check if user is bot owner/admin ─────
function isBotAdmin(userId) {
  const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return admins.includes(String(userId));
}

// ─── Register wizard handlers ──────────────
module.exports = (bot) => {

  // /musiclogin — start login wizard (private only, admin only)
  bot.command('musiclogin', safe(async (ctx) => {
    const userId = ctx.from.id;
    const lang   = getLang(ctx.chat.id);

    if (ctx.chat.type !== 'private') {
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan perintah ini di <b>private chat</b> dengan bot.</blockquote>`);
    }
    if (!isBotAdmin(userId)) {
      return ctx.replyWithHTML(`<blockquote>❌ Hanya admin bot yang bisa menggunakan perintah ini.</blockquote>`);
    }
    if (!global.API_ID || !global.API_HASH) {
      return ctx.replyWithHTML(`<blockquote>❌ <b>API_ID / API_HASH belum diisi di config.js!</b>\n\nIsi dulu di file <code>config.js</code> lalu restart bot.</blockquote>`);
    }
    if (!pool.hasSlot()) {
      return ctx.replyWithHTML(`<blockquote>❌ Sudah mencapai batas maksimal <b>${pool.MAX_BOTS} userbot</b>.\n\nHapus salah satu userbot dulu dengan /deluserbot.</blockquote>`);
    }

    // Clear any previous session
    const prev = getSession(userId);
    if (prev?.client) { try { await prev.client.disconnect(); } catch {} }
    clearSession(userId);

    setSession(userId, { step: STEPS.PHONE });

    await ctx.replyWithHTML(
      `<blockquote>🎵 <b>Login Userbot Musik</b>\n━━━━━━━━━━━━━━━━━━━━\n\n📱 Masukkan <b>nomor telepon</b> akun Telegram yang akan dijadikan userbot musik:\n\nFormat: <code>+628xxxxxxxxxx</code>\n\n/cancel untuk membatalkan</blockquote>`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Batal', 'login_cancel')]])
    );
  }));

  // /adduserbot — alias for /musiclogin
  bot.command('adduserbot', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di <b>private chat</b> dengan bot.</blockquote>`);
    }
    // Redirect to musiclogin flow
    ctx.message.text = '/musiclogin';
    return bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/musiclogin' } });
  }));

  // /listuserbot — list all userbots
  bot.command('listuserbot', safe(async (ctx) => {
    const userId = ctx.from.id;
    if (!isBotAdmin(userId)) return ctx.replyWithHTML(`<blockquote>❌ Hanya admin bot.</blockquote>`);

    const bots = pool.getAllBots();
    if (!bots.length) {
      return ctx.replyWithHTML(`<blockquote>📭 <b>Belum ada userbot terdaftar.</b>\n\nGunakan /musiclogin untuk menambahkan.</blockquote>`);
    }

    let text = `<blockquote>🤖 <b>Daftar Userbot Musik</b> (${pool.getActiveCount()}/${pool.getPoolCount()} aktif)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const b of bots) {
      const icon    = b.active ? '🟢' : '🔴';
      const groups  = b.assignedGroups?.length || 0;
      text += `${icon} <b>#${b.id}</b> — ${b.name || 'Unknown'}\n`;
      text += `   📱 ${b.phone || '?'} • 👥 ${groups} grup\n\n`;
    }
    text += `Slot tersisa: <b>${pool.MAX_BOTS - pool.getPoolCount()}/${pool.MAX_BOTS}</b>\n</blockquote>`;

    const rows = bots.map(b => [
      Markup.button.callback(`🗑 Hapus #${b.id} (${b.name || '?'})`, `del_userbot_${b.id}`)
    ]);
    rows.push([Markup.button.callback('➕ Tambah Userbot', 'add_userbot_btn')]);

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(rows));
  }));

  // /deluserbot <id>
  bot.command('deluserbot', safe(async (ctx) => {
    const userId = ctx.from.id;
    if (!isBotAdmin(userId)) return ctx.replyWithHTML(`<blockquote>❌ Hanya admin bot.</blockquote>`);
    const id = parseInt(ctx.message.text.split(' ')[1]);
    if (!id) return ctx.replyWithHTML(`<blockquote>❓ Cara pakai: /deluserbot &lt;id&gt;\nContoh: /deluserbot 2</blockquote>`);
    await pool.removeBot(id);
    await ctx.replyWithHTML(`<blockquote>✅ Userbot #${id} berhasil dihapus.</blockquote>`);
  }));

  // /cancel — cancel login wizard
  bot.command('cancel', safe(async (ctx) => {
    const userId = ctx.from.id;
    const sess   = getSession(userId);
    if (!sess || sess.step === STEPS.IDLE) {
      return ctx.replyWithHTML(`<blockquote>ℹ️ Tidak ada proses yang sedang berjalan.</blockquote>`);
    }
    if (sess.client) { try { await sess.client.disconnect(); } catch {} }
    clearSession(userId);
    await ctx.replyWithHTML(`<blockquote>❌ Login dibatalkan.</blockquote>`);
  }));

  // ── Callback: cancel button ──
  bot.action('login_cancel', async (ctx) => {
    const userId = ctx.from.id;
    const sess   = getSession(userId);
    if (sess?.client) { try { await sess.client.disconnect(); } catch {} }
    clearSession(userId);
    await ctx.answerCbQuery('❌ Dibatalkan');
    await ctx.editMessageText('<blockquote>❌ Login dibatalkan.</blockquote>', { parse_mode: 'HTML' });
  });

  // ── Callback: add userbot button ──
  bot.action('add_userbot_btn', async (ctx) => {
    await ctx.answerCbQuery();
    if (!pool.hasSlot()) {
      return ctx.replyWithHTML(`<blockquote>❌ Sudah mencapai batas <b>${pool.MAX_BOTS} userbot</b>.</blockquote>`);
    }
    const userId = ctx.from.id;
    clearSession(userId);
    setSession(userId, { step: STEPS.PHONE });
    await ctx.replyWithHTML(
      `<blockquote>📱 Masukkan <b>nomor telepon</b> userbot baru:\n\nFormat: <code>+628xxxxxxxxxx</code>\n\n/cancel untuk batal</blockquote>`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Batal', 'login_cancel')]])
    );
  });

  // ── Callback: delete userbot ──
  bot.action(/^del_userbot_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;
    if (!isBotAdmin(userId)) return ctx.answerCbQuery('❌ Bukan admin', { show_alert: true });
    const id = parseInt(ctx.match[1]);
    await ctx.answerCbQuery(`🗑 Menghapus #${id}...`);
    await pool.removeBot(id);
    // Refresh list
    const bots = pool.getAllBots();
    if (!bots.length) {
      return ctx.editMessageText(
        '<blockquote>📭 <b>Semua userbot telah dihapus.</b>\n\nGunakan /musiclogin untuk menambahkan.</blockquote>',
        { parse_mode: 'HTML' }
      );
    }
    let text = `<blockquote>🤖 <b>Daftar Userbot Musik</b> (${pool.getActiveCount()}/${pool.getPoolCount()} aktif)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const b of bots) {
      const icon   = b.active ? '🟢' : '🔴';
      const groups = b.assignedGroups?.length || 0;
      text += `${icon} <b>#${b.id}</b> — ${b.name || 'Unknown'}\n   📱 ${b.phone || '?'} • 👥 ${groups} grup\n\n`;
    }
    text += `</blockquote>`;
    const rows = bots.map(b => [Markup.button.callback(`🗑 Hapus #${b.id} (${b.name || '?'})`, `del_userbot_${b.id}`)]);
    rows.push([Markup.button.callback('➕ Tambah Userbot', 'add_userbot_btn')]);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
  });

  // ─── Text handler — catches wizard inputs ──
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const sess   = getSession(userId);

    // Not in wizard or not private
    if (!sess || sess.step === STEPS.IDLE || ctx.chat.type !== 'private') {
      return next();
    }

    const text = ctx.message.text.trim();

    // ── STEP 1: Phone number input ──
    if (sess.step === STEPS.PHONE) {
      const phone = text.startsWith('+') ? text : `+${text}`;
      if (!/^\+\d{7,15}$/.test(phone)) {
        return ctx.replyWithHTML(
          `<blockquote>❌ Format nomor tidak valid.\n\nGunakan format: <code>+628xxxxxxxxxx</code></blockquote>`
        );
      }

      const loadMsg = await ctx.replyWithHTML(`<blockquote>⏳ Menghubungkan ke Telegram...</blockquote>`);

      try {
        const client = new TelegramClient(
          new StringSession(''),
          global.API_ID, global.API_HASH,
          { connectionRetries: 5, useWSS: false }
        );
        await client.connect();

        const result = await client.invoke(new Api.auth.SendCode({
          phoneNumber:   phone,
          apiId:         global.API_ID,
          apiHash:       global.API_HASH,
          settings:      new Api.CodeSettings({}),
        }));

        setSession(userId, { step: STEPS.OTP, client, phone, phoneCodeHash: result.phoneCodeHash });

        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>📨 <b>Kode OTP telah dikirim!</b>\n\nCek pesan Telegram dari <b>+42777</b> atau notifikasi Telegram kamu.\n\nMasukkan kode OTP (5 digit):\n\n/cancel untuk batal</blockquote>`,
          { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Batal', 'login_cancel')]]) }
        );
      } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>❌ <b>Gagal mengirim OTP:</b> ${e.message}\n\nCoba lagi atau /cancel</blockquote>`,
          { parse_mode: 'HTML' }
        );
        clearSession(userId);
      }
      return;
    }

    // ── STEP 2: OTP input ──
    if (sess.step === STEPS.OTP) {
      const code = text.replace(/\s/g, '');
      if (!/^\d{5,6}$/.test(code)) {
        return ctx.replyWithHTML(`<blockquote>❌ Kode OTP harus 5-6 digit angka.</blockquote>`);
      }

      const loadMsg = await ctx.replyWithHTML(`<blockquote>⏳ Memverifikasi OTP...</blockquote>`);

      try {
        const result = await sess.client.invoke(new Api.auth.SignIn({
          phoneNumber:   sess.phone,
          phoneCodeHash: sess.phoneCodeHash,
          phoneCode:     code,
        }));

        // Success!
        await onLoginSuccess(ctx, userId, sess, loadMsg.message_id);
      } catch (e) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          // 2FA required
          setSession(userId, { ...sess, step: STEPS.PASSWORD });
          await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
            `<blockquote>🔒 <b>Akun ini menggunakan 2FA (Two-Factor Authentication).</b>\n\nMasukkan <b>password 2FA</b> kamu:\n\n/cancel untuk batal</blockquote>`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Batal', 'login_cancel')]]) }
          );
        } else {
          await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
            `<blockquote>❌ <b>Kode OTP salah atau expired:</b> ${e.message}\n\nCoba lagi:</blockquote>`,
            { parse_mode: 'HTML' }
          );
        }
      }
      return;
    }

    // ── STEP 3: 2FA Password ──
    if (sess.step === STEPS.PASSWORD) {
      const loadMsg = await ctx.replyWithHTML(`<blockquote>⏳ Memverifikasi password...</blockquote>`);
      try {
        const pwdInfo = await sess.client.invoke(new Api.account.GetPassword());
        await sess.client.invoke(
          new Api.auth.CheckPassword({
            password: await computeCheck(pwdInfo, text),
          })
        );
        await onLoginSuccess(ctx, userId, sess, loadMsg.message_id);
      } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>❌ <b>Password salah:</b> ${e.message}\n\nCoba lagi:</blockquote>`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    return next();
  });

  // ─── On login success ──────────────────────
  async function onLoginSuccess(ctx, userId, sess, editMsgId) {
    try {
      const me      = await sess.client.getMe();
      const name    = `${me.firstName || ''} ${me.lastName || ''}`.trim();
      const session = sess.client.session.save();

      // Add to pool
      const entry = pool.addBotToPool(session, sess.phone, name);
      await pool.connectBot(entry.id);

      clearSession(userId);

      const bots  = pool.getAllBots();
      const count = pool.getActiveCount();

      await ctx.telegram.editMessageText(ctx.chat.id, editMsgId, null,
        `<blockquote>✅ <b>Userbot #${entry.id} berhasil login!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n👤 Nama  : <b>${name}</b>\n📱 Nomor : <code>${sess.phone}</code>\n🤖 ID Pool: <b>#${entry.id}</b>\n\n📊 Total userbot aktif: <b>${count}/${pool.MAX_BOTS}</b>\n\nGunakan /listuserbot untuk melihat semua.</blockquote>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      clearSession(userId);
      await ctx.telegram.editMessageText(ctx.chat.id, editMsgId, null,
        `<blockquote>❌ <b>Gagal menyimpan session:</b> ${e.message}</blockquote>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  // 2FA compute check (simplified — uses SRP if needed)
  async function computeCheck(pwdInfo, password) {
    const { computePasswordCheck } = require('teleproto/dist/client/2fa');
    return computePasswordCheck(pwdInfo, password);
  }
};
