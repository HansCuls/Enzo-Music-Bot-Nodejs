// ==========================================
// FILE: music/broadcast.js
// Broadcast via forward message ke semua grup
// Khusus BOT_ADMINS saja
// Usage:
//   1. Forward pesan ke bot (private)
//   2. Bot tanya konfirmasi
//   3. Konfirmasi → forward ke semua grup
// ==========================================

const { Markup } = require('telegraf');
const { safe, writeLog } = require('./error_handler');
const fs         = require('fs');
const path       = require('path');

const GROUPS_FILE = path.join(__dirname, '../database/groups.json');

// ─── Track active groups ──────────────────
let knownGroups = loadGroups();

function loadGroups() {
  try {
    if (!fs.existsSync(GROUPS_FILE)) return {};
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveGroups() {
  const dir = path.dirname(GROUPS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(knownGroups, null, 2));
}

function registerGroup(chatId, title) {
  const key = String(chatId);
  if (!knownGroups[key]) {
    knownGroups[key] = { id: chatId, title: title || 'Unknown', joinedAt: Date.now() };
    saveGroups();
  }
}

function removeGroup(chatId) {
  delete knownGroups[String(chatId)];
  saveGroups();
}

function getGroups() {
  return Object.values(knownGroups);
}

// ─── Pending broadcast store ──────────────
const pendingBroadcast = new Map(); // userId => { fromChatId, messageId }

// ─── Check bot admin ──────────────────────
function isBotAdmin(userId) {
  const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return admins.includes(String(userId));
}

// ─── Module ───────────────────────────────
module.exports = (bot) => {

  // Track every group bot joins
  bot.on('my_chat_member', (ctx) => {
    const chat   = ctx.chat;
    const update = ctx.myChatMember;
    if (!chat) return;
    const isGroup = ['group', 'supergroup'].includes(chat.type);
    const newStatus = update?.new_chat_member?.status;
    if (isGroup && ['member', 'administrator'].includes(newStatus)) {
      registerGroup(chat.id, chat.title);
    }
    if (isGroup && ['left', 'kicked'].includes(newStatus)) {
      removeGroup(chat.id);
    }
  });

  // Also track from any message in group
  bot.use((ctx, next) => {
    const chat = ctx.chat;
    if (chat && ['group', 'supergroup'].includes(chat.type)) {
      registerGroup(chat.id, chat.title);
    }
    return next();
  });

  // /broadcast — show instructions
  bot.command('broadcast', safe(async (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.type !== 'private') {
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan perintah ini di <b>private chat</b> dengan bot.</blockquote>`);
    }
    if (!isBotAdmin(userId)) {
      return ctx.replyWithHTML(`<blockquote>❌ Hanya admin bot yang bisa broadcast.</blockquote>`);
    }

    const total = getGroups().length;
    await ctx.replyWithHTML(
      `<blockquote>📢 <b>Menu Broadcast</b>\n━━━━━━━━━━━━━━━━━━━━\n\n👥 Grup terdaftar: <b>${total} grup</b>\n\n<b>Cara pakai:</b>\n1. <b>Forward</b> pesan yang ingin di-broadcast ke sini\n2. Bot akan menampilkan preview\n3. Klik <b>✅ Kirim</b> untuk broadcast ke semua grup\n\n⚠️ Broadcast menggunakan <b>forward</b> — pesan asli akan diteruskan ke semua grup.\n\n/broadcastlist — lihat daftar grup\n/broadcaststats — statistik broadcast</blockquote>`,
      Markup.inlineKeyboard([[Markup.button.callback('📋 Lihat Daftar Grup', 'bc_list')]])
    );
  }));

  // /broadcastlist — list all groups
  bot.command('broadcastlist', safe(async (ctx) => {
    const userId = ctx.from.id;
    if (!isBotAdmin(userId)) return;
    if (ctx.chat.type !== 'private') return;

    const groups = getGroups();
    if (!groups.length) {
      return ctx.replyWithHTML(`<blockquote>📭 <b>Belum ada grup terdaftar.</b>\n\nBot akan otomatis mendaftar grup saat ada anggota yang menggunakan /play.</blockquote>`);
    }

    const LIMIT = 30;
    let text = `<blockquote>👥 <b>Daftar Grup</b> (${groups.length} grup)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    groups.slice(0, LIMIT).forEach((g, i) => {
      text += `${i + 1}. ${g.title || 'Unknown'} (<code>${g.id}</code>)\n`;
    });
    if (groups.length > LIMIT) text += `\n<i>... dan ${groups.length - LIMIT} grup lainnya</i>`;
    text += `</blockquote>`;
    await ctx.replyWithHTML(text);
  }));

  // Callback: bc_list
  bot.action('bc_list', async (ctx) => {
    await ctx.answerCbQuery();
    const groups = getGroups();
    const text = `<blockquote>👥 <b>Grup Terdaftar:</b> ${groups.length} grup\n\nGunakan /broadcastlist untuk daftar lengkap.</blockquote>`;
    await ctx.replyWithHTML(text);
  });

  // Callback: confirm send
  bot.action(/^bc_confirm_(\d+)_(-?\d+)$/, async (ctx) => {
    const userId    = ctx.from.id;
    const fromChat  = parseInt(ctx.match[1]);
    const messageId = parseInt(ctx.match[2]);

    if (!isBotAdmin(userId)) return ctx.answerCbQuery('❌', { show_alert: true });
    await ctx.answerCbQuery('📤 Mengirim...');

    const groups = getGroups();
    let sent = 0, failed = 0;

    const statusMsg = await ctx.replyWithHTML(
      `<blockquote>📤 <b>Broadcast dimulai...</b>\n\n⏳ Mengirim ke <b>${groups.length} grup</b>...</blockquote>`
    );

    for (const group of groups) {
      try {
        await ctx.telegram.forwardMessage(group.id, fromChat, messageId);
        sent++;
        // Update progress every 10
        if (sent % 10 === 0) {
          await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
            `<blockquote>📤 <b>Sedang broadcast...</b>\n\n✅ Terkirim: ${sent}\n❌ Gagal: ${failed}\n⏳ Sisa: ${groups.length - sent - failed}</blockquote>`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
        // Anti-flood delay
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        failed++;
        // Remove group if bot was kicked
        if (e.message?.includes('kicked') || e.message?.includes('not a member') || e.message?.includes('CHAT_WRITE_FORBIDDEN')) {
          removeGroup(group.id);
        }
      }
    }

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
      `<blockquote>✅ <b>Broadcast selesai!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Terkirim  : <b>${sent} grup</b>\n❌ Gagal     : <b>${failed} grup</b>\n📊 Total     : <b>${groups.length} grup</b></blockquote>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

    pendingBroadcast.delete(String(userId));
  });

  // Callback: cancel broadcast
  bot.action('bc_cancel', async (ctx) => {
    const userId = ctx.from.id;
    pendingBroadcast.delete(String(userId));
    await ctx.answerCbQuery('❌ Dibatalkan');
    await ctx.editMessageText('<blockquote>❌ Broadcast dibatalkan.</blockquote>', { parse_mode: 'HTML' });
  });

  // Forward handler — detect forward in private chat from admin
  bot.on('message', async (ctx, next) => {
    const userId = ctx.from.id;
    const chat   = ctx.chat;

    if (chat.type !== 'private') return next();
    if (!isBotAdmin(userId)) return next();

    const msg = ctx.message;

    // Must be a forwarded message
    const isForwarded = msg.forward_from || msg.forward_from_chat ||
                        msg.forward_sender_name || msg.forward_date;
    if (!isForwarded) return next();

    const groups = getGroups();
    const total  = groups.length;

    // Preview
    await ctx.replyWithHTML(
      `<blockquote>📢 <b>Preview Broadcast</b>\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Pesan siap di-broadcast!\n👥 Target: <b>${total} grup</b>\n\nPesan di atas akan diteruskan ke semua grup.\n\n⚠️ Pastikan pesan sudah benar sebelum mengirim!</blockquote>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(`✅ Kirim ke ${total} Grup`, `bc_confirm_${chat.id}_${msg.message_id}`),
          Markup.button.callback('❌ Batal', 'bc_cancel'),
        ],
      ])
    );
    return;
  });

  // Expose registerGroup for use in other modules
  module.exports.registerGroup = registerGroup;
  module.exports.getGroups     = getGroups;
};
