// ==========================================
// FILE: music/leavemanager.js
// Admin commands untuk kelola grup/channel
//   /outallgroup    — userbot keluar semua grup
//   /setskipgroup   — atur grup yang di-skip
//   /outallchannel  — userbot keluar semua channel
//   /setskipchannel — atur channel yang di-skip
// ==========================================

const { Api }  = require('teleproto');
const fs       = require('fs');
const path     = require('path');
const { getMusicClients } = require('./userpool');
const { safe } = require('./error_handler');

// ─── Skip list database ───────────────────
const DB_PATH = path.join(__dirname, '../database/skip_list.json');

function loadSkipList() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {}
  return { groups: [], channels: [] };
}

function saveSkipList(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function isAdmin(ctx) {
  const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim());
  return admins.includes(String(ctx.from.id));
}

// ─── Colored button helper ─────────────────
function btn(text, cb, style = null) {
  const b = { text, callback_data: cb };
  if (style) b.style = style;
  return b;
}
function btnUrl(text, url, style = null) {
  const b = { text, url };
  if (style) b.style = style;
  return b;
}
function kbd(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

// ─── Get all dialogs from userbot ──────────
async function getAllDialogs(client) {
  const dialogs = await client.getDialogs({ limit: 500 });
  const groups   = [];
  const channels = [];

  for (const d of dialogs) {
    const e = d.entity;
    if (!e) continue;

    if (e.className === 'Chat' || (e.className === 'Channel' && e.megagroup)) {
      // Group / Supergroup
      const id = e.className === 'Chat'
        ? -Number(e.id)
        : -Number(`100${e.id}`);
      groups.push({
        id:    id,
        title: e.title || 'Unknown',
        type:  e.className === 'Chat' ? 'group' : 'supergroup',
      });
    } else if (e.className === 'Channel' && !e.megagroup) {
      // Channel
      const id = -Number(`100${e.id}`);
      channels.push({
        id:    id,
        title: e.title || 'Unknown',
        type:  'channel',
      });
    }
  }

  return { groups, channels };
}

// ─── Leave a dialog ─────────────────────────
// Return: 'left' | 'owner' (di-skip karena userbot pemiliknya) | 'failed'
async function leaveDialog(client, dialog) {
  try {
    if (dialog.type === 'group') {
      // Regular group
      const chatId = Math.abs(dialog.id);
      await client.invoke(new Api.messages.LeaveChat({ chatId: BigInt(chatId) }));
    } else {
      // Supergroup or Channel
      const id = String(dialog.id);
      const chanId = BigInt(id.replace('-100', '').replace('-', ''));
      const entity = await client.getEntity(new Api.PeerChannel({ channelId: chanId }));

      // Jangan pernah keluar kalau userbot adalah OWNER/creator channel ini.
      try {
        const me = await client.getMe();
        const p  = await client.invoke(new Api.channels.GetParticipant({ channel: entity, participant: me }));
        if (p?.participant?.className === 'ChannelParticipantCreator') {
          return 'owner';
        }
      } catch {}

      await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
    }
    return 'left';
  } catch (e) {
    console.warn(`[leave] Gagal keluar dari ${dialog.title}: ${e.message}`);
    return 'failed';
  }
}

// ─── Register commands ─────────────────────
module.exports = (bot) => {

  // ══════════════════════════════════════════
  // /outallgroup — keluar semua grup
  // ══════════════════════════════════════════
  bot.command('outallgroup', safe(async (ctx) => {
    if (!isAdmin(ctx)) return;
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);

    await ctx.replyWithHTML(
      `<blockquote>⚠️ <b>Konfirmasi Keluar Semua Grup</b>
━━━━━━━━━━━━━━━━━━━━
Semua userbot musik akan keluar dari <b>semua grup</b> (kecuali yang di skip list).

Lanjutkan?</blockquote>`,
      kbd([
        [btn('✅ Ya, Keluar Semua', 'outallgroup_confirm', 'danger')],
        [btn('❌ Batal', 'outallgroup_cancel', 'primary')],
      ])
    );
  }));

  bot.action('outallgroup_confirm', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `<blockquote>⏳ <b>Sedang memproses...</b>\n\nMengambil daftar grup dari semua userbot...</blockquote>`,
      { parse_mode: 'HTML' }
    );

    const skip  = loadSkipList();
    const skipIds = new Set(skip.groups.map(g => String(g.id)));
    const clients = getMusicClients();

    if (!clients.length) {
      return ctx.editMessageText(
        `<blockquote>❌ Tidak ada userbot aktif.</blockquote>`,
        { parse_mode: 'HTML' }
      );
    }

    let totalLeft = 0, totalSkipped = 0, totalFailed = 0, totalOwner = 0;
    const results = [];

    for (const { client, name } of clients) {
      try {
        const { groups } = await getAllDialogs(client);
        let left = 0, skipped = 0, failed = 0, owner = 0;

        for (const g of groups) {
          if (skipIds.has(String(g.id))) {
            skipped++;
            totalSkipped++;
            continue;
          }
          const result = await leaveDialog(client, g);
          if (result === 'left') { left++; totalLeft++; }
          else if (result === 'owner') { owner++; totalOwner++; }
          else { failed++; totalFailed++; }
          await new Promise(r => setTimeout(r, 500)); // delay anti-flood
        }

        results.push(`👤 <b>${name}</b>: ✅ ${left} keluar · 👑 ${owner} owner (di-skip) · ⏭ ${skipped} skip · ❌ ${failed} gagal`);
      } catch (e) {
        results.push(`👤 <b>${name}</b>: Error — ${e.message}`);
      }
    }

    await ctx.editMessageText(
      `<blockquote>✅ <b>Selesai Keluar Dari Semua Grup</b>
━━━━━━━━━━━━━━━━━━━━
${results.join('\n')}
━━━━━━━━━━━━━━━━━━━━
📊 Total: ✅ ${totalLeft} keluar · 👑 ${totalOwner} owner · ⏭ ${totalSkipped} skip · ❌ ${totalFailed} gagal</blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('📋 Lihat Skip List', 'skipgroup_list', 'primary')]]) }
    );
  });

  bot.action('outallgroup_cancel', async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    await ctx.editMessageText(`<blockquote>❌ <b>Dibatalkan.</b></blockquote>`, { parse_mode: 'HTML' });
  });

  // ══════════════════════════════════════════
  // /setskipgroup — kelola skip list grup
  // ══════════════════════════════════════════
  bot.command('setskipgroup', safe(async (ctx) => {
    if (!isAdmin(ctx)) return;
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);

    const parts = ctx.message.text.split(/\s+/).slice(1);
    const sub   = parts[0]?.toLowerCase();
    const skip  = loadSkipList();

    // /setskipgroup list
    if (!sub || sub === 'list') {
      const list = skip.groups;
      let text = `<blockquote>📋 <b>Skip List Grup</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (!list.length) text += `<i>Kosong — semua grup akan ditinggalkan saat /outallgroup</i>`;
      else list.forEach((g, i) => { text += `${i+1}. ${g.title}\n   <code>${g.id}</code>\n`; });
      text += `\n━━━━━━━━━━━━━━━━━━━━\nGunakan:\n/setskipgroup add &lt;id/username&gt;\n/setskipgroup remove &lt;id&gt;</blockquote>`;

      return ctx.replyWithHTML(text, kbd([
        [btn('➕ Tambah dari Daftar', 'skipgroup_pick', 'success')],
        [btn('🗑 Hapus Semua Skip', 'skipgroup_clearall', 'danger')],
      ]));
    }

    // /setskipgroup add <id>
    if (sub === 'add') {
      const idStr = parts[1];
      if (!idStr) return ctx.replyWithHTML(`<blockquote>❓ Format: /setskipgroup add &lt;id atau @username&gt;</blockquote>`);

      // Try to resolve
      const clients = getMusicClients();
      if (!clients.length) return ctx.replyWithHTML(`<blockquote>❌ Tidak ada userbot aktif.</blockquote>`);
      const client = clients[0].client;

      try {
        let entity, id, title;
        if (/^-?\d+$/.test(idStr)) {
          id    = parseInt(idStr);
          const idS = String(id);
          const chanId = BigInt(idS.replace('-100','').replace('-',''));
          entity = idS.startsWith('-100')
            ? await client.getEntity(new Api.PeerChannel({ channelId: chanId }))
            : await client.getEntity(new Api.PeerChat({ chatId: chanId }));
          title = entity.title || 'Unknown';
        } else {
          entity = await client.getEntity(idStr.replace('@',''));
          id     = entity.id ? -Number(`100${entity.id}`) : 0;
          title  = entity.title || 'Unknown';
        }

        // Check if already in skip list
        if (skip.groups.some(g => g.id === id)) {
          return ctx.replyWithHTML(`<blockquote>⚠️ <b>${title}</b> sudah ada di skip list.</blockquote>`);
        }

        skip.groups.push({ id, title });
        saveSkipList(skip);
        return ctx.replyWithHTML(
          `<blockquote>✅ <b>Ditambahkan ke Skip List</b>\n\n📋 ${title}\n<code>${id}</code></blockquote>`,
          kbd([[btn('📋 Lihat Skip List', 'skipgroup_list', 'primary')]])
        );
      } catch (e) {
        return ctx.replyWithHTML(`<blockquote>❌ Gagal: ${e.message}</blockquote>`);
      }
    }

    // /setskipgroup remove <id>
    if (sub === 'remove') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) return ctx.replyWithHTML(`<blockquote>❓ Format: /setskipgroup remove &lt;id&gt;</blockquote>`);

      const before = skip.groups.length;
      const removed = skip.groups.find(g => g.id === id);
      skip.groups = skip.groups.filter(g => g.id !== id);
      saveSkipList(skip);

      if (skip.groups.length < before) {
        return ctx.replyWithHTML(`<blockquote>🗑 <b>${removed?.title || id}</b> dihapus dari skip list.</blockquote>`);
      }
      return ctx.replyWithHTML(`<blockquote>❌ ID tidak ditemukan di skip list.</blockquote>`);
    }

    ctx.replyWithHTML(`<blockquote>❓ Sub-command tidak dikenal.\n\nGunakan: list · add · remove</blockquote>`);
  }));

  // Callback: tampilkan skip list
  bot.action('skipgroup_list', async (ctx) => {
    await ctx.answerCbQuery();
    const skip = loadSkipList();
    const list = skip.groups;
    let text = `<blockquote>📋 <b>Skip List Grup</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (!list.length) text += `<i>Kosong</i>`;
    else list.forEach((g, i) => { text += `${i+1}. ${g.title} — <code>${g.id}</code>\n`; });
    text += `</blockquote>`;
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...kbd([
        [btn('➕ Tambah', 'skipgroup_pick', 'success'), btn('🗑 Hapus Semua', 'skipgroup_clearall', 'danger')],
        [btn('◀️ Kembali', 'outallgroup_cancel', 'primary')],
      ])
    });
  });

  // Callback: pick grup dari daftar aktif
  bot.action('skipgroup_pick', async (ctx) => {
    await ctx.answerCbQuery();
    const clients = getMusicClients();
    if (!clients.length) return ctx.editMessageText(`<blockquote>❌ Tidak ada userbot aktif.</blockquote>`, { parse_mode: 'HTML' });

    const { groups } = await getAllDialogs(clients[0].client);
    const skip = loadSkipList();
    const skipIds = new Set(skip.groups.map(g => String(g.id)));

    const available = groups.filter(g => !skipIds.has(String(g.id))).slice(0, 20);
    if (!available.length) return ctx.editMessageText(`<blockquote>✅ Semua grup sudah di skip list.</blockquote>`, { parse_mode: 'HTML' });

    const rows = available.map(g => [btn(`📋 ${g.title.slice(0,35)}`, `skipgroup_add_${g.id}`, 'primary')]);
    rows.push([btn('❌ Batal', 'skipgroup_list', 'danger')]);

    await ctx.editMessageText(
      `<blockquote>➕ <b>Pilih grup untuk di-skip:</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd(rows) }
    );
  });

  bot.action(/^skipgroup_add_(-?\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    const id = parseInt(ctx.match[1]);
    const clients = getMusicClients();
    if (!clients.length) return ctx.answerCbQuery('❌ Tidak ada userbot');

    const { groups } = await getAllDialogs(clients[0].client);
    const group = groups.find(g => g.id === id);
    if (!group) return ctx.answerCbQuery('❌ Grup tidak ditemukan');

    const skip = loadSkipList();
    if (!skip.groups.some(g => g.id === id)) {
      skip.groups.push({ id: group.id, title: group.title });
      saveSkipList(skip);
    }
    await ctx.answerCbQuery(`✅ ${group.title.slice(0,20)} ditambahkan`);
    await ctx.editMessageText(
      `<blockquote>✅ <b>${group.title}</b> ditambahkan ke skip list grup.</blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('📋 Lihat Skip List', 'skipgroup_list', 'primary')]]) }
    );
  });

  bot.action('skipgroup_clearall', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `<blockquote>⚠️ <b>Hapus semua skip list grup?</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd([
        [btn('✅ Ya, Hapus Semua', 'skipgroup_clearall_confirm', 'danger')],
        [btn('❌ Batal', 'skipgroup_list', 'primary')],
      ])}
    );
  });

  bot.action('skipgroup_clearall_confirm', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    const skip = loadSkipList();
    skip.groups = [];
    saveSkipList(skip);
    await ctx.answerCbQuery('✅ Skip list grup dihapus');
    await ctx.editMessageText(
      `<blockquote>🗑 <b>Skip list grup telah dihapus.</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('◀️ Kembali', 'outallgroup_cancel', 'primary')]]) }
    );
  });

  // ══════════════════════════════════════════
  // /outallchannel — keluar semua channel
  // ══════════════════════════════════════════
  bot.command('outallchannel', safe(async (ctx) => {
    if (!isAdmin(ctx)) return;
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);

    await ctx.replyWithHTML(
      `<blockquote>⚠️ <b>Konfirmasi Keluar Semua Channel</b>
━━━━━━━━━━━━━━━━━━━━
Semua userbot musik akan keluar dari <b>semua channel</b> (kecuali yang di skip list).

Lanjutkan?</blockquote>`,
      kbd([
        [btn('✅ Ya, Keluar Semua', 'outallchannel_confirm', 'danger')],
        [btn('❌ Batal', 'outallchannel_cancel', 'primary')],
      ])
    );
  }));

  bot.action('outallchannel_confirm', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `<blockquote>⏳ <b>Sedang memproses...</b>\n\nMengambil daftar channel dari semua userbot...</blockquote>`,
      { parse_mode: 'HTML' }
    );

    const skip    = loadSkipList();
    const skipIds = new Set(skip.channels.map(c => String(c.id)));
    const clients = getMusicClients();

    if (!clients.length) {
      return ctx.editMessageText(`<blockquote>❌ Tidak ada userbot aktif.</blockquote>`, { parse_mode: 'HTML' });
    }

    let totalLeft = 0, totalSkipped = 0, totalFailed = 0, totalOwner = 0;
    const results = [];

    for (const { client, name } of clients) {
      try {
        const { channels } = await getAllDialogs(client);
        let left = 0, skipped = 0, failed = 0, owner = 0;

        for (const ch of channels) {
          if (skipIds.has(String(ch.id))) { skipped++; totalSkipped++; continue; }
          const result = await leaveDialog(client, ch);
          if (result === 'left') { left++; totalLeft++; }
          else if (result === 'owner') { owner++; totalOwner++; }
          else { failed++; totalFailed++; }
          await new Promise(r => setTimeout(r, 500));
        }

        results.push(`👤 <b>${name}</b>: ✅ ${left} keluar · 👑 ${owner} owner (di-skip) · ⏭ ${skipped} skip · ❌ ${failed} gagal`);
      } catch (e) {
        results.push(`👤 <b>${name}</b>: Error — ${e.message}`);
      }
    }

    await ctx.editMessageText(
      `<blockquote>✅ <b>Selesai Keluar Dari Semua Channel</b>
━━━━━━━━━━━━━━━━━━━━
${results.join('\n')}
━━━━━━━━━━━━━━━━━━━━
📊 Total: ✅ ${totalLeft} keluar · 👑 ${totalOwner} owner · ⏭ ${totalSkipped} skip · ❌ ${totalFailed} gagal</blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('📋 Lihat Skip List', 'skipchannel_list', 'primary')]]) }
    );
  });

  bot.action('outallchannel_cancel', async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    await ctx.editMessageText(`<blockquote>❌ <b>Dibatalkan.</b></blockquote>`, { parse_mode: 'HTML' });
  });

  // ══════════════════════════════════════════
  // /setskipchannel — kelola skip list channel
  // ══════════════════════════════════════════
  bot.command('setskipchannel', safe(async (ctx) => {
    if (!isAdmin(ctx)) return;
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);

    const parts = ctx.message.text.split(/\s+/).slice(1);
    const sub   = parts[0]?.toLowerCase();
    const skip  = loadSkipList();

    if (!sub || sub === 'list') {
      const list = skip.channels;
      let text = `<blockquote>📋 <b>Skip List Channel</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (!list.length) text += `<i>Kosong — semua channel akan ditinggalkan saat /outallchannel</i>`;
      else list.forEach((c, i) => { text += `${i+1}. ${c.title}\n   <code>${c.id}</code>\n`; });
      text += `\n━━━━━━━━━━━━━━━━━━━━\nGunakan:\n/setskipchannel add &lt;id/username&gt;\n/setskipchannel remove &lt;id&gt;</blockquote>`;

      return ctx.replyWithHTML(text, kbd([
        [btn('➕ Tambah dari Daftar', 'skipchannel_pick', 'success')],
        [btn('🗑 Hapus Semua Skip', 'skipchannel_clearall', 'danger')],
      ]));
    }

    if (sub === 'add') {
      const idStr = parts[1];
      if (!idStr) return ctx.replyWithHTML(`<blockquote>❓ Format: /setskipchannel add &lt;id atau @username&gt;</blockquote>`);

      const clients = getMusicClients();
      if (!clients.length) return ctx.replyWithHTML(`<blockquote>❌ Tidak ada userbot aktif.</blockquote>`);
      const client = clients[0].client;

      try {
        let id, title;
        if (/^-?\d+$/.test(idStr)) {
          id    = parseInt(idStr);
          const chanId = BigInt(String(id).replace('-100',''));
          const entity = await client.getEntity(new Api.PeerChannel({ channelId: chanId }));
          title = entity.title || 'Unknown';
        } else {
          const entity = await client.getEntity(idStr.replace('@',''));
          id    = -Number(`100${entity.id}`);
          title = entity.title || 'Unknown';
        }

        if (skip.channels.some(c => c.id === id))
          return ctx.replyWithHTML(`<blockquote>⚠️ <b>${title}</b> sudah ada di skip list.</blockquote>`);

        skip.channels.push({ id, title });
        saveSkipList(skip);
        return ctx.replyWithHTML(
          `<blockquote>✅ <b>Ditambahkan ke Skip List Channel</b>\n\n📺 ${title}\n<code>${id}</code></blockquote>`,
          kbd([[btn('📋 Lihat Skip List', 'skipchannel_list', 'primary')]])
        );
      } catch (e) { return ctx.replyWithHTML(`<blockquote>❌ Gagal: ${e.message}</blockquote>`); }
    }

    if (sub === 'remove') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) return ctx.replyWithHTML(`<blockquote>❓ Format: /setskipchannel remove &lt;id&gt;</blockquote>`);
      const removed = skip.channels.find(c => c.id === id);
      skip.channels = skip.channels.filter(c => c.id !== id);
      saveSkipList(skip);
      return ctx.replyWithHTML(
        removed
          ? `<blockquote>🗑 <b>${removed.title}</b> dihapus dari skip list channel.</blockquote>`
          : `<blockquote>❌ ID tidak ditemukan di skip list.</blockquote>`
      );
    }
  }));

  // Callback: tampilkan skip list channel
  bot.action('skipchannel_list', async (ctx) => {
    await ctx.answerCbQuery();
    const skip = loadSkipList();
    let text = `<blockquote>📋 <b>Skip List Channel</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (!skip.channels.length) text += `<i>Kosong</i>`;
    else skip.channels.forEach((c, i) => { text += `${i+1}. ${c.title} — <code>${c.id}</code>\n`; });
    text += `</blockquote>`;
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...kbd([
        [btn('➕ Tambah', 'skipchannel_pick', 'success'), btn('🗑 Hapus Semua', 'skipchannel_clearall', 'danger')],
        [btn('◀️ Kembali', 'outallchannel_cancel', 'primary')],
      ])
    });
  });

  // Callback: pick channel dari daftar aktif
  bot.action('skipchannel_pick', async (ctx) => {
    await ctx.answerCbQuery();
    const clients = getMusicClients();
    if (!clients.length) return ctx.editMessageText(`<blockquote>❌ Tidak ada userbot aktif.</blockquote>`, { parse_mode: 'HTML' });

    const { channels } = await getAllDialogs(clients[0].client);
    const skip = loadSkipList();
    const skipIds = new Set(skip.channels.map(c => String(c.id)));
    const available = channels.filter(c => !skipIds.has(String(c.id))).slice(0, 20);

    if (!available.length) return ctx.editMessageText(`<blockquote>✅ Semua channel sudah di skip list.</blockquote>`, { parse_mode: 'HTML' });

    const rows = available.map(c => [btn(`📺 ${c.title.slice(0,35)}`, `skipchannel_add_${c.id}`, 'primary')]);
    rows.push([btn('❌ Batal', 'skipchannel_list', 'danger')]);

    await ctx.editMessageText(
      `<blockquote>➕ <b>Pilih channel untuk di-skip:</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd(rows) }
    );
  });

  bot.action(/^skipchannel_add_(-?\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    const id = parseInt(ctx.match[1]);
    const clients = getMusicClients();
    if (!clients.length) return ctx.answerCbQuery('❌');

    const { channels } = await getAllDialogs(clients[0].client);
    const channel = channels.find(c => c.id === id);
    if (!channel) return ctx.answerCbQuery('❌ Channel tidak ditemukan');

    const skip = loadSkipList();
    if (!skip.channels.some(c => c.id === id)) {
      skip.channels.push({ id: channel.id, title: channel.title });
      saveSkipList(skip);
    }
    await ctx.answerCbQuery(`✅ ${channel.title.slice(0,20)} ditambahkan`);
    await ctx.editMessageText(
      `<blockquote>✅ <b>${channel.title}</b> ditambahkan ke skip list channel.</blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('📋 Lihat Skip List', 'skipchannel_list', 'primary')]]) }
    );
  });

  bot.action('skipchannel_clearall', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `<blockquote>⚠️ <b>Hapus semua skip list channel?</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd([
        [btn('✅ Ya, Hapus Semua', 'skipchannel_clearall_confirm', 'danger')],
        [btn('❌ Batal', 'skipchannel_list', 'primary')],
      ])}
    );
  });

  bot.action('skipchannel_clearall_confirm', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌');
    const skip = loadSkipList();
    skip.channels = [];
    saveSkipList(skip);
    await ctx.answerCbQuery('✅ Dihapus');
    await ctx.editMessageText(
      `<blockquote>🗑 <b>Skip list channel telah dihapus.</b></blockquote>`,
      { parse_mode: 'HTML', ...kbd([[btn('◀️ Kembali', 'outallchannel_cancel', 'primary')]]) }
    );
  });
};
