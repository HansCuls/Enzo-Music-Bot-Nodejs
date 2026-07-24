// ==========================================
// FILE: music/musicbot.js
// Userbot manager — sekarang pakai multi-pool
// ==========================================

require('../config');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { resolveChannelEntity, clarifyTeleprotoError, extractInviteHash } = require('./tgutils');
const { Api }  = require('teleproto');
const { Markup } = require('telegraf');
const { t }      = require('./i18n');
const { getLang, setLang } = require('./settings');
const pool       = require('./userpool');

// ─────────────────────────────────────────
// HELPER: resolve channel entity dengan benar
// ─── AUTO LEAVE TIMER ─────────────────────
const leaveTimers      = new Map();
const LEAVE_TIMEOUT_MS = 15 * 60 * 1000;

function startLeaveTimer(chatId, onLeave) {
  cancelLeaveTimer(chatId);
  const timer = setTimeout(async () => {
    leaveTimers.delete(String(chatId));
    if (onLeave) await onLeave(chatId);
  }, LEAVE_TIMEOUT_MS);
  leaveTimers.set(String(chatId), timer);
}
function cancelLeaveTimer(chatId) {
  const timer = leaveTimers.get(String(chatId));
  if (timer) { clearTimeout(timer); leaveTimers.delete(String(chatId)); }
}

// ─── Get music client for a group ─────────
function getMusicClient(chatId) {
  if (chatId) {
    const result = pool.getClientForGroup(chatId);
    return result?.client || null;
  }
  // Fallback: get any active client
  const bots = pool.getAllBots().filter(b => b.active);
  if (!bots.length) return null;
  return pool.getClientById(bots[0].id);
}

// ─── Admin checks ──────────────────────────
async function checkBotIsAdmin(ctx, chatId) {
  try {
    const botInfo = await ctx.telegram.getMe();
    const member  = await ctx.telegram.getChatMember(chatId, botInfo.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch { return false; }
}

async function checkUserbotIsAdmin(ctx, chatId) {
  const client = getMusicClient(chatId);
  if (!client) return false;
  try {
    const me     = await client.getMe();
    const member = await ctx.telegram.getChatMember(chatId, me.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch { return false; }
}

async function checkUserbotInGroup(chatId) {
  const client = getMusicClient(chatId);
  if (!client) return false;
  try {
    const me     = await client.getMe();
    const entity = await resolveChannelEntity(client, chatId);
    await client.invoke(new Api.channels.GetParticipant({ channel: entity, participant: me }));
    return true;
  } catch { return false; }
}

// ─── Auto join & promote ──────────────────
async function autoJoinGroup(ctx, chatId) {
  const client = getMusicClient(chatId);
  if (!client) throw new Error('Tidak ada userbot aktif.');

  // Error yang artinya "udah jadi member" itu OK, bukan kegagalan beneran.
  const isAlreadyJoined = (e) => /ALREADY_PARTICIPANT/i.test(e?.message || '');

  try {
    const invite = await ctx.telegram.exportChatInviteLink(chatId).catch(() => null);
    if (invite) {
      try {
        await client.invoke(new Api.messages.ImportChatInvite({ hash: extractInviteHash(invite) }));
      } catch (e) {
        if (!isAlreadyJoined(e)) throw e;
      }
    } else {
      const entity = await resolveChannelEntity(client, chatId);
      try {
        await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
      } catch (e) {
        if (!isAlreadyJoined(e)) throw e;
      }
    }
  } catch (e) {
    throw new Error(`Gagal join grup: ${clarifyTeleprotoError(e)}`);
  }
}

async function promoteUserbot(ctx, chatId) {
  const client = getMusicClient(chatId);
  if (!client) throw new Error('Tidak ada userbot aktif.');
  const me = await client.getMe();

  // Coba Bot API dulu
  try {
    await ctx.telegram.promoteChatMember(chatId, me.id, {
      can_manage_chat:        true,
      can_manage_voice_chats: true,
      can_invite_users:       true,
      can_restrict_members:   false,
      can_delete_messages:    false,
      can_pin_messages:       false,
      can_change_info:        false,
    });
    return; // berhasil
  } catch (e) {
    // Kalau error karena Bot API belum "kenal" peer ini (baru saja join via MTProto)
    // atau butuh privilege lain, coba MTProto langsung sebagai fallback
    if (!e.message?.includes('USER_NOT_MUTUAL_CONTACT') &&
        !e.message?.includes('CHAT_ADMIN_REQUIRED') &&
        !e.message?.includes('USER_PRIVACY_RESTRICTED') &&
        !e.message?.includes('PEER_ID_INVALID') &&
        !e.message?.includes('USER_ID_INVALID')) {
      throw e;
    }
  }

  // Fallback: pakai MTProto channels.EditAdmin via main bot client
  // (membutuhkan bot sebagai admin dengan can_add_admins)
  try {
    const entity = await resolveChannelEntity(client, chatId);
    // Gunakan inputUser dari userbot sendiri
    const userEntity = await client.getEntity(new Api.PeerUser({ userId: BigInt(me.id) }));

    await client.invoke(new Api.channels.EditAdmin({
      channel: entity,
      userId:  userEntity,
      adminRights: new Api.ChatAdminRights({
        manageCall:    true,
        other:         true,
        inviteUsers:   true,
        changeInfo:    false,
        deleteMessages:false,
        banUsers:      false,
        pinMessages:   false,
        addAdmins:     false,
        anonymous:     false,
        manageTopics:  false,
      }),
      rank: 'Music Bot',
    }));
  } catch (e2) {
    // Jika masih gagal, berikan instruksi manual
    throw new Error(
      `Tidak bisa auto-promote userbot.\n\n` +
      `Silakan promote secara manual:\n` +
      `Buka Anggota Grup → cari userbot → Jadikan Admin\n` +
      `Centang: ✅ Kelola Voice Chat\n\n` +
      `Error: ${clarifyTeleprotoError(e2)}`
    );
  }
}

// ─── Voice chat ───────────────────────────
async function isVoiceChatActive(chatId) {
  const client = getMusicClient(chatId);
  if (!client) return false;
  try {
    const entity = await resolveChannelEntity(client, chatId);
    const full   = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
    return !!full.fullChat?.call;
  } catch { return false; }
}

async function startVoiceChat(chatId) {
  const client = getMusicClient(chatId);
  if (!client) throw new Error('Tidak ada userbot aktif.');
  const entity = await resolveChannelEntity(client, chatId);
  await client.invoke(new Api.phone.CreateGroupCall({
    peer: entity, randomId: Math.floor(Math.random() * 1e9),
  }));
}

async function userbotLeaveGroup(chatId) {
  const client = getMusicClient(chatId);
  if (!client) return;
  try {
    const entity = await resolveChannelEntity(client, chatId);
    const me     = await client.getMe();

    // Jangan pernah keluar kalau userbot adalah OWNER/creator channel ini.
    try {
      const p = await client.invoke(new Api.channels.GetParticipant({ channel: entity, participant: me }));
      if (p?.participant?.className === 'ChannelParticipantCreator') return;
    } catch {}

    await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
  } catch {}
}

// ─── Admin commands (setlang, status, promote) ──
module.exports.registerAdminCommands = (bot) => {
  bot.command('musicstatus', async (ctx) => {
    const lang  = getLang(ctx.chat.id);
    const total  = pool.getPoolCount();
    const active = pool.getActiveCount();
    if (!active) {
      return ctx.replyWithHTML(`<blockquote>${t(lang,'status_offline')}\n\nGunakan /musiclogin untuk login.</blockquote>`);
    }
    const bots = pool.getAllBots();
    let text = `<blockquote>✅ <b>Status Userbot Musik</b>\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 Aktif: <b>${active}/${total}</b>\n\n`;
    for (const b of bots) {
      const icon = b.active ? '🟢' : '🔴';
      text += `${icon} #${b.id} — ${b.name || '?'} (<code>${b.phone || '?'}</code>)\n`;
    }
    text += `\n/listuserbot untuk manajemen lengkap.</blockquote>`;
    await ctx.replyWithHTML(text);
  });

  bot.command('cookiestatus', async (ctx) => {
    const { sessionStatus } = require('./browser_session');
    const s = sessionStatus();
    const icon = s.active ? '🟢' : '⚪';
    await ctx.replyWithHTML(
      `<blockquote>${icon} <b>Status Sesi Cookies YouTube</b>\n━━━━━━━━━━━━━━━━━━━━\n${s.message}\n\n` +
      `<i>Cuma dipakai buat video age-restricted. Fitur lain jalan normal tanpa ini.</i></blockquote>`
    );
  });

  bot.command('cookierefresh', async (ctx) => {
    const { profileExists, refreshSession } = require('./browser_session');
    if (!profileExists()) {
      return ctx.replyWithHTML(`<blockquote>⚪ Belum ada sesi browser tersimpan. Kirim file cookies.txt ke chat ini dengan caption /cookieimport buat setup.</blockquote>`);
    }
    const msg = await ctx.replyWithHTML(`<blockquote>⏳ Me-refresh sesi browser...</blockquote>`);
    const ok = await refreshSession();
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
      `<blockquote>${ok ? '✅ Sesi berhasil di-refresh.' : '❌ Refresh gagal, cek log console untuk detail.'}</blockquote>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  // Kirim file cookies.txt (caption /cookieimport) atau reply file itu dengan /cookieimport
  bot.command('cookieimport', async (ctx) => {
    const doc = ctx.message.document || ctx.message.reply_to_message?.document;
    if (!doc) {
      return ctx.replyWithHTML(
        `<blockquote>❌ Kirim file <code>cookies.txt</code> ke chat ini dengan caption <code>/cookieimport</code>, atau reply file yang udah dikirim dengan <code>/cookieimport</code>.\n\n` +
        `Cookies-nya diambil dari ekstensi "cookies.txt" resmi (addons.mozilla.org) di Firefox — bukan otomasi login, cuma "nitip" sesi yang udah sah.</blockquote>`
      );
    }
    const msg = await ctx.replyWithHTML(`<blockquote>⏳ Mengunduh & mengimpor cookies...</blockquote>`);
    let tmpPath;
    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      tmpPath = path.join(os.tmpdir(), `cookies_${Date.now()}.txt`);
      const res = await fetch(fileLink.href);
      fs.writeFileSync(tmpPath, Buffer.from(await res.arrayBuffer()));

      const { importCookies } = require('./browser_session');
      const result = await importCookies(tmpPath);

      const loginNote = result.loggedIn === false
        ? '\n⚠️ Belum yakin ke-detect status login-nya, tapi cookies udah tersimpan — coba tes /play video age-restricted buat mastiin.'
        : result.loggedIn === true ? '\n✅ Terdeteksi sudah login.' : '';

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        `<blockquote>✅ ${result.cookieCount} cookies berhasil diimpor.${loginNote}</blockquote>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        `<blockquote>❌ Gagal import: ${e.message}</blockquote>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    } finally {
      if (tmpPath) fs.unlink(tmpPath, () => {});
    }
  });

  bot.command('promote', async (ctx) => {
    const lang   = getLang(ctx.chat.id);
    const chatId = ctx.chat.id;
    let targetId, targetName;
    if (ctx.message.reply_to_message) {
      targetId   = ctx.message.reply_to_message.from.id;
      targetName = ctx.message.reply_to_message.from.first_name;
    } else {
      const args = ctx.message.text.split(' ').slice(1);
      if (!args[0]) return ctx.replyWithHTML(`<blockquote>${t(lang,'promote_usage')}</blockquote>`);
      try {
        const user = await ctx.telegram.getChatMember(chatId, args[0].replace('@',''));
        targetId   = user.user.id;
        targetName = user.user.first_name;
      } catch { return ctx.replyWithHTML(`<blockquote>❌ User tidak ditemukan.</blockquote>`); }
    }
    try {
      await ctx.telegram.promoteChatMember(chatId, targetId, {
        can_manage_chat: true, can_delete_messages: true,
        can_restrict_members: true, can_invite_users: true,
        can_pin_messages: true, can_manage_voice_chats: true,
      });
      await ctx.replyWithHTML(`<blockquote>${t(lang,'promote_done',targetName)}</blockquote>`);
    } catch (e) {
      await ctx.replyWithHTML(`<blockquote>${t(lang,'promote_failed_msg',e.message)}</blockquote>`);
    }
  });

  bot.command('setlang', async (ctx) => {
    const chatId = ctx.chat.id;
    const lang   = getLang(chatId);
    const code   = ctx.message.text.split(' ')[1]?.toLowerCase();
    const { SUPPORTED_LANGS } = require('./i18n');
    if (!code || !SUPPORTED_LANGS.includes(code)) {
      return ctx.replyWithHTML(`<blockquote>${t(lang,'lang_list')}</blockquote>`);
    }
    setLang(chatId, code);
    const names = {
      id:'🇮🇩 Bahasa Indonesia', en:'🇬🇧 English', ms:'🇲🇾 Bahasa Melayu',
      ar:'🇸🇦 العربية', tr:'🇹🇷 Türkçe', ru:'🇷🇺 Русский'
    };
    await ctx.replyWithHTML(`<blockquote>${t(code,'lang_set',names[code])}</blockquote>`);
  });

  bot.command('language', async (ctx) => {
    const lang = getLang(ctx.chat.id);
    await ctx.replyWithHTML(`<blockquote>${t(lang,'lang_list')}</blockquote>`);
  });
};

module.exports = {
  ...module.exports,
  getMusicClient,
  checkBotIsAdmin, checkUserbotIsAdmin, checkUserbotInGroup,
  autoJoinGroup, promoteUserbot,
  isVoiceChatActive, startVoiceChat, userbotLeaveGroup,
  startLeaveTimer, cancelLeaveTimer,
};
