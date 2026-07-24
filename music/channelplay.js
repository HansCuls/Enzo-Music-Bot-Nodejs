// ==========================================
// FILE: music/channelplay.js
// Play audio + video di Voice Chat CHANNEL
// Semua command via PRIVATE CHAT
// Menggunakan API ntgcalls yang benar:
//   mediaSource: 2 (SHELL), output "-"
//   joinVoiceChat dengan videoEnabled untuk video
// ==========================================

const { Markup }  = require('telegraf');
const { Api }     = require('teleproto');
const { searchYouTube, getVideoInfo, getStreamUrl, getVideoUrl,
        downloadVideo, isYouTubeUrl } = require('./ytdl');
const { startStream, stopStream, pauseStream, resumeStream,
        getElapsed, joinVoiceChat, buildAudioCmd } = require('./streamer');
const { startVideoStream, stopVideoStream } = require('./videoplay');
const queue      = require('./queue');
const S          = require('./settings');
const { t }      = require('./i18n');
const { getMusicClient, isVoiceChatActive, startVoiceChat,
        startLeaveTimer, cancelLeaveTimer, userbotLeaveGroup,
        checkBotIsAdmin, checkUserbotInGroup, checkUserbotIsAdmin,
        autoJoinGroup, promoteUserbot } = require('./musicbot');
const { buildPlayerCaption, buildQueueText, buildQueueButtons } = require('./ui');
const { safe }   = require('./error_handler');
const { resolveChannelEntity, clarifyTeleprotoError, extractInviteHash } = require('./tgutils');

// ─── Helpers ──────────────────────────────
function btn(text, callback_data, style = null) {
  const b = { text, callback_data };
  if (style) b.style = style;
  return b;
}
function btnUrl(text, url, style = null) {
  const b = { text, url };
  if (style) b.style = style;
  return b;
}

const chSearchCache = new Map();

// ─── Parse @channel / -100id + query ──────
function parseChannelCommand(text) {
  const parts = text.trim().split(/\s+/);
  parts.shift();
  if (!parts.length) return { channel: null, query: '' };
  const first     = parts[0];
  const isChannel = first.startsWith('@') || /^-?\d+$/.test(first);
  if (!isChannel) return { channel: null, query: parts.join(' ') };
  return { channel: first, query: parts.slice(1).join(' ').trim() };
}

// ─── Resolve channel to numeric ID ────────
async function resolveChannel(ctx, channelInput) {
  const client = getMusicClient();
  if (!client) throw new Error('Tidak ada userbot aktif');
  if (/^-?\d+$/.test(channelInput)) return parseInt(channelInput);
  const username = channelInput.replace('@', '');
  // Resolve lewat username langsung — BUKAN via resolveChannelEntity(), karena
  // fungsi itu didesain buat chatId numerik (dia coba BigInt(id) di dalamnya,
  // yang bakal error kalau dikasih username kayak "monyet_lu_babi").
  const entity = await client.getEntity(username);
  return entity.className === 'Channel'
    ? parseInt(`-100${entity.id}`)
    : entity.id;
}

// ─── Check channel admin ───────────────────
async function isChannelAdmin(ctx, channelId) {
  try {
    const m = await ctx.telegram.getChatMember(channelId, ctx.from.id);
    return ['administrator', 'creator'].includes(m.status);
  } catch { return false; }
}

// ─── Pre-check for channel ─────────────────
async function preCheckChannel(ctx, channelId) {
  const l = S.getLang(channelId);
  if (!await isChannelAdmin(ctx, channelId))
    return { ok: false, reason: `❌ Kamu bukan admin di channel <code>${channelId}</code>.` };

  const client = getMusicClient(channelId);
  if (!client) return { ok: false, reason: t(l, 'userbot_not_login') };

  // Check bot is admin
  try {
    const botInfo = await ctx.telegram.getMe();
    const member  = await ctx.telegram.getChatMember(channelId, botInfo.id);
    if (!['administrator', 'creator'].includes(member.status))
      return { ok: false, reason: `❌ Bot bukan admin di channel!\n\nTambahkan bot sebagai admin dengan hak:\n• Posting Pesan\n• Kelola Tayangan Langsung` };
  } catch (e) {
    return { ok: false, reason: `❌ Gagal cek status bot: ${e.message}` };
  }

  // Fast path: kalau userbot udah admin/owner di channel (cek lewat Bot API,
  // gak butuh resolve MTProto sama sekali), langsung skip cek "di channel" + invite + promote.
  const me = await client.getMe();
  let userbotIsAdmin = false;
  try {
    const member = await ctx.telegram.getChatMember(channelId, me.id);
    userbotIsAdmin = ['administrator', 'creator'].includes(member.status);
  } catch {}

  if (!userbotIsAdmin) {
    // Check userbot in channel
    try {
      const entity = await resolveChannelEntity(client, channelId);
      await client.invoke(new Api.channels.GetParticipant({ channel: entity, participant: me }));
    } catch {
      try {
        const invite = await ctx.telegram.exportChatInviteLink(channelId).catch(() => null);
        if (invite) {
          try {
            await client.invoke(new Api.messages.ImportChatInvite({ hash: extractInviteHash(invite) }));
          } catch (e) {
            if (!/ALREADY_PARTICIPANT/i.test(e?.message || '')) throw e;
          }
        } else {
          const entity = await resolveChannelEntity(client, channelId);
          try {
            await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
          } catch (e) {
            if (!/ALREADY_PARTICIPANT/i.test(e?.message || '')) throw e;
          }
        }
        await new Promise(r => setTimeout(r, 1500)); // beri waktu Telegram propagate join sebelum resolve/promote
      } catch (e) {
        return { ok: false, reason: `❌ Gagal mengundang userbot ke channel: ${clarifyTeleprotoError(e)}` };
      }
    }

    // Promote userbot
    try {
      await ctx.telegram.promoteChatMember(channelId, me.id, {
        can_manage_chat: true, can_manage_video_chats: true,
        can_post_messages: false, can_invite_users: true,
      });
    } catch (e) {
      return { ok: false, reason: `❌ Gagal promote userbot: ${clarifyTeleprotoError(e)}` };
    }
  }

  // Start VC if not active
  if (!await isVoiceChatActive(channelId)) {
    try { await startVoiceChat(channelId); }
    catch (e) { return { ok: false, reason: t(l, 'vc_failed', e.message) }; }
  }

  return { ok: true };
}

// ─── Build channel player buttons (colored raw) ──
function buildChannelPlayerButtons(channelId, state, lang = 'id') {
  const ip = state.isPaused;
  return {
    reply_markup: {
      inline_keyboard: [
        [
          btn('⏮', `ch_prev_${channelId}`),
          btn(ip ? '▶️ Play' : '⏸ Pause', `ch_pause_${channelId}`, ip ? 'success' : 'primary'),
          btn('⏭', `ch_skip_${channelId}`),
        ],
        [
          btn('🔂 Loop',   `ch_loop_${channelId}`),
          btn('🔀 Acak',   `ch_shuffle_${channelId}`),
          btn('📋 Antrian', `ch_queue_${channelId}_0`),
        ],
        [
          btn('🔉', `ch_voldn_${channelId}`),
          btn('🔊', `ch_volup_${channelId}`),
          btn('⚙️ Settings', `ch_settings_${channelId}`),
        ],
        [
          btn('⏹ Stop', `ch_stop_${channelId}`, 'danger'),
          btn('🗑 Clear', `ch_clear_${channelId}`, 'danger'),
        ],
      ]
    }
  };
}

// ─── Play audio track in channel ──────────
async function playChannelTrack(ctx, channelId, track, state) {
  cancelLeaveTimer(channelId);
  const l       = S.getLang(channelId);
  const vol     = S.getVolume(channelId);
  const client  = getMusicClient(channelId);
  const streamUrl = await getStreamUrl(track.url);

  await startStream(client, channelId, streamUrl, {
    onFinish: async () => {
      state.isPlaying = false;
      const next = queue.next(channelId);
      if (next) {
        state.isPlaying = true; state.isPaused = false; state.startedAt = Date.now();
        await playChannelTrack(ctx, channelId, next, state).catch(console.error);
      } else {
        state.isPlaying = false;
        try {
          await ctx.replyWithHTML(`<blockquote>✅ Semua lagu di channel selesai.\n⏳ Userbot keluar 15 menit.</blockquote>`);
        } catch {}
        startLeaveTimer(channelId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
      }
    },
  }, vol, track.videoId);

  state.isPlaying = true; state.isPaused = false;
  state.startedAt = Date.now(); state.volume = vol;

  const caption = buildPlayerCaption(track, state, 0, l);

  if (state.msgId) {
    try {
      // Try edit existing message
      await ctx.telegram.editMessageText(ctx.chat.id, state.msgId, null,
        `<blockquote>${caption}</blockquote>`,
        { parse_mode: 'HTML', ...buildChannelPlayerButtons(channelId, state, l) }
      );
      return;
    } catch {}
  }

  // Send new player message (in private chat)
  const msg = await ctx.replyWithHTML(
    `<blockquote>${caption}</blockquote>`,
    buildChannelPlayerButtons(channelId, state, l)
  );
  state.msgId   = msg.message_id;
  state.isPhoto = false;
}

// ─── Register commands ─────────────────────
module.exports = (bot) => {

  // ──────────── /cplay @ch judul ────────────
  bot.command('cplay', safe(async (ctx) => {
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di <b>private chat</b>.\n\nFormat: /cplay @channel judul lagu</blockquote>`);

    const { channel, query } = parseChannelCommand(ctx.message.text);
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ <b>Cara pakai:</b>\n/cplay @channel judul lagu\n/cplay -1001234567890 judul lagu\n\nContoh: /cplay @mychannel Shape of You</blockquote>`);
    if (!query)   return ctx.replyWithHTML(`<blockquote>❓ Tambahkan judul lagu.\n\nContoh: /cplay @mychannel Dewa 19 Kangen</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Memproses...</blockquote>`);
    try {
      const channelId = await resolveChannel(ctx, channel);
      const l = S.getLang(channelId);

      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>🔍 Memeriksa channel <code>${channel}</code>...</blockquote>`, { parse_mode:'HTML' }
      );

      const check = await preCheckChannel(ctx, channelId);
      if (!check.ok) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' }
      );

      let track;
      if (isYouTubeUrl(query)) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>${t(l,'fetching_info')}</blockquote>`, { parse_mode:'HTML' });
        track = await getVideoInfo(query);
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>${t(l,'searching_yt')}</blockquote>`, { parse_mode:'HTML' });
        const results = await searchYouTube(query, 1);
        if (!results.length) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' });
        track = results[0];
      }
      if (!track) throw new Error('Gagal ambil info lagu');
      track.requestedBy = ctx.from.id;

      queue.add(channelId, track);
      const state = queue.get(channelId);

      if (state.isPlaying) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>✅ <b>Ditambahkan ke antrian channel ${channel}!</b>\n\n🎵 ${track.title}\n👤 ${track.uploader}\n⏱ ${track.durationFmt}\n📋 Posisi: #${state.tracks.length}</blockquote>`,
          { parse_mode:'HTML' }
        );
      } else {
        state.currentIndex = state.tracks.length - 1;
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>🎶 Memulai putar di channel ${channel}...</blockquote>`, { parse_mode:'HTML' }
        );
        await playChannelTrack(ctx, channelId, track, state);
        await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
      }
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ <b>Error:</b> ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────── /cvplay @ch judul ───────────
  bot.command('cvplay', safe(async (ctx) => {
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.\n\nFormat: /cvplay @channel judul video</blockquote>`);

    const { channel, query } = parseChannelCommand(ctx.message.text);
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ <b>Cara pakai:</b>\n/cvplay @channel judul video</blockquote>`);
    if (!query)   return ctx.replyWithHTML(`<blockquote>❓ Tambahkan judul video.</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Memproses...</blockquote>`);
    try {
      const channelId = await resolveChannel(ctx, channel);
      const l = S.getLang(channelId);

      const check = await preCheckChannel(ctx, channelId);
      if (!check.ok) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' });

      let track;
      if (isYouTubeUrl(query)) {
        track = await getVideoInfo(query);
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>🔍 Mencari video...</blockquote>`, { parse_mode:'HTML' });
        const results = await searchYouTube(query, 1);
        if (!results.length) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
          `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' });
        track = results[0];
      }
      if (!track) throw new Error('Gagal ambil info video');

      const quality = S.getVideoQuality(channelId);
      const volume  = S.getVolume(channelId);
      const vqLabel = S.VIDEO_QUALITY[quality].label;
      const client  = getMusicClient(channelId);

      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>⬇️ Mendownload video...\n📹 <b>${track.title}</b></blockquote>`, { parse_mode:'HTML' }
      );

      await startVideoStream(client, channelId, track.url, {
        onFinish: async () => {
          queue.get(channelId).isPlaying = false;
          try { await ctx.replyWithHTML(`<blockquote>✅ Video channel selesai.</blockquote>`); } catch {}
          startLeaveTimer(channelId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
        },
      }, quality, volume, track.videoId);

      queue.get(channelId).isPlaying = true;

      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>📹 <b>Sedang Stream Video</b>
━━━━━━━━━━━━━━━━━━━━
📺 Channel  : ${channel}
🎬 Judul    : <b>${track.title}</b>
👤 Channel  : ${track.uploader}
⏱ Durasi   : ${track.durationFmt}
📺 Kualitas : ${vqLabel}
🔊 Volume   : ${volume}%
━━━━━━━━━━━━━━━━━━━━</blockquote>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                btn('⏹ Stop Video', `ch_vstop_${channelId}`, 'danger'),
                btn('⚙️ Settings', `ch_settings_${channelId}`),
              ],
            ]
          }
        }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ <b>Gagal stream video:</b>\n${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────── /csearch @ch judul ──────────
  bot.command('csearch', safe(async (ctx) => {
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);
    const { channel, query } = parseChannelCommand(ctx.message.text);
    if (!channel || !query) return ctx.replyWithHTML(`<blockquote>❓ Format: /csearch @channel judul lagu</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Mencari lagu...</blockquote>`);
    try {
      const channelId = await resolveChannel(ctx, channel);
      const results   = await searchYouTube(query, 5);
      if (!results.length) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ Tidak ditemukan.</blockquote>`, { parse_mode:'HTML' });

      chSearchCache.set(`${ctx.from.id}_${channelId}`, { results, channelId, channel });

      let text = `<blockquote>🔍 <b>Hasil Pencarian Audio</b>\n📺 Channel: ${channel}\nQuery: <i>${query}</i>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((r, i) => {
        text += `${i+1}. <b>${r.title.length > 38 ? r.title.slice(0,38)+'…' : r.title}</b>\n   👤 ${r.uploader} · ⏱ ${r.durationFmt}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n🎵 Pilih lagu:</blockquote>`;

      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...results.map((r, i) => [btn(`${i+1}. ${r.title.slice(0,35)}`, `ch_pick_${ctx.from.id}_${channelId}_${i}`, 'primary')]),
            [btn('❌ Batal', `ch_cancel_search_${ctx.from.id}`, 'danger')],
          ]
        }
      });
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }).catch(() => {});
    }
  }));

  // ──────────── /cvsearch @ch judul ─────────
  bot.command('cvsearch', safe(async (ctx) => {
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.</blockquote>`);
    const { channel, query } = parseChannelCommand(ctx.message.text);
    if (!channel || !query) return ctx.replyWithHTML(`<blockquote>❓ Format: /cvsearch @channel judul video</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Mencari video...</blockquote>`);
    try {
      const channelId = await resolveChannel(ctx, channel);
      const results   = await searchYouTube(query, 5);
      if (!results.length) return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ Tidak ditemukan.</blockquote>`, { parse_mode:'HTML' });

      chSearchCache.set(`${ctx.from.id}_${channelId}_v`, { results, channelId, channel, isVideo: true });

      let text = `<blockquote>📹 <b>Hasil Pencarian Video</b>\n📺 Channel: ${channel}\nQuery: <i>${query}</i>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((r, i) => {
        text += `${i+1}. <b>${r.title.length > 38 ? r.title.slice(0,38)+'…' : r.title}</b>\n   👤 ${r.uploader} · ⏱ ${r.durationFmt}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n📹 Pilih video:</blockquote>`;

      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...results.map((r, i) => [btn(`${i+1}. ${r.title.slice(0,35)}`, `ch_vpick_${ctx.from.id}_${channelId}_${i}`, 'primary')]),
            [btn('❌ Batal', `ch_cancel_search_${ctx.from.id}`, 'danger')],
          ]
        }
      });
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }).catch(() => {});
    }
  }));

  // ──────────── Simple controls ──────────────
  const simpleControls = {
    cpause:   async (ctx, chId, l) => {
      const st = queue.get(chId);
      if (!st.isPlaying) return t(l,'no_playing');
      if (st.isPaused)   return t(l,'already_paused');
      await pauseStream(chId); st.isPaused = true;
      return t(l,'paused');
    },
    cresume:  async (ctx, chId, l) => {
      const st = queue.get(chId);
      if (!st.isPlaying) return t(l,'no_playing');
      if (!st.isPaused)  return t(l,'already_playing');
      await resumeStream(chId); st.isPaused = false; cancelLeaveTimer(chId);
      return t(l,'resumed');
    },
    cstop:    async (ctx, chId, l) => {
      stopStream(chId); queue.clear(chId);
      startLeaveTimer(chId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
      return t(l,'stopped');
    },
    cshuffle: async (ctx, chId, l) => {
      if (!queue.shuffle(chId)) return t(l,'no_queue_to_shuffle');
      return t(l,'shuffled');
    },
    cnp: async (ctx, chId, l) => {
      const track = queue.current(chId);
      const st    = queue.get(chId);
      if (!st.isPlaying || !track) return t(l,'no_playing');
      return buildPlayerCaption(track, st, getElapsed(chId), l);
    },
  };

  for (const [cmd, handler] of Object.entries(simpleControls)) {
    bot.command(cmd, safe(async (ctx) => {
      if (ctx.chat.type !== 'private')
        return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.\n\nFormat: /${cmd} @channel</blockquote>`);
      const { channel } = parseChannelCommand(ctx.message.text);
      if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /${cmd} @channel</blockquote>`);
      try {
        const chId = await resolveChannel(ctx, channel);
        const l    = S.getLang(chId);
        const msg  = await handler(ctx, chId, l);
        await ctx.replyWithHTML(`<blockquote>${msg}</blockquote>`);
      } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
    }));
  }

  // /cskip @ch [n]
  bot.command('cskip', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const parts = ctx.message.text.split(/\s+/);
    const channel = parts[1]; const n = parseInt(parts[2]) || 1;
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /cskip @channel [n]</blockquote>`);
    try {
      const chId = await resolveChannel(ctx, channel);
      const l    = S.getLang(chId);
      const st   = queue.get(chId);
      if (!st.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
      let next = null;
      for (let i = 0; i < n; i++) next = queue.next(chId);
      if (!next) { stopStream(chId); st.isPlaying = false; return ctx.replyWithHTML(`<blockquote>${t(l,'no_next')}</blockquote>`); }
      stopStream(chId);
      st.isPlaying = true; st.isPaused = false; st.startedAt = Date.now();
      await ctx.replyWithHTML(`<blockquote>${t(l,'skipped',next.title)}</blockquote>`);
      await playChannelTrack(ctx, chId, next, st);
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // /cprev @ch
  bot.command('cprev', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const channel = ctx.message.text.split(/\s+/)[1];
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /cprev @channel</blockquote>`);
    try {
      const chId = await resolveChannel(ctx, channel);
      const l    = S.getLang(chId);
      const prev = queue.prev(chId);
      if (!prev) return ctx.replyWithHTML(`<blockquote>${t(l,'no_prev')}</blockquote>`);
      stopStream(chId);
      const st = queue.get(chId);
      st.isPlaying = true; st.isPaused = false; st.startedAt = Date.now();
      await ctx.replyWithHTML(`<blockquote>${t(l,'prev_track',prev.title)}</blockquote>`);
      await playChannelTrack(ctx, chId, prev, st);
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // /cqueue @ch [page]
  bot.command('cqueue', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const parts = ctx.message.text.split(/\s+/);
    const channel = parts[1]; const page = Math.max(0, (parseInt(parts[2]) || 1) - 1);
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /cqueue @channel [halaman]</blockquote>`);
    try {
      const chId  = await resolveChannel(ctx, channel);
      const l     = S.getLang(chId);
      const st    = queue.get(chId);
      const pages = Math.ceil(st.tracks.length / 10) || 1;
      await ctx.replyWithHTML(buildQueueText(st, page, l), buildQueueButtons(chId, page, pages, l));
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // /cvolume @ch <0-200>
  bot.command('cvolume', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const parts = ctx.message.text.split(/\s+/);
    const channel = parts[1]; const vol = parseInt(parts[2]);
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /cvolume @channel 0-200</blockquote>`);
    if (isNaN(vol) || vol < 0 || vol > 200) return ctx.replyWithHTML(`<blockquote>❌ Volume harus 0-200.</blockquote>`);
    try {
      const chId = await resolveChannel(ctx, channel);
      const l    = S.getLang(chId);
      S.setVolume(chId, vol); queue.get(chId).volume = vol;
      await ctx.replyWithHTML(`<blockquote>${t(l,'volume_set',vol)}</blockquote>`);
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // /cloop @ch
  bot.command('cloop', safe(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const channel = ctx.message.text.split(/\s+/)[1];
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Format: /cloop @channel</blockquote>`);
    try {
      const chId = await resolveChannel(ctx, channel);
      const l    = S.getLang(chId);
      const st   = queue.get(chId);
      if (!st.loop && !st.loopQueue)    { st.loop = true;  st.loopQueue = false; }
      else if (st.loop)                 { st.loop = false; st.loopQueue = true; }
      else                              { st.loop = false; st.loopQueue = false; }
      const mode = st.loop ? t(l,'loop_song') : st.loopQueue ? t(l,'loop_queue') : t(l,'loop_off');
      await ctx.replyWithHTML(`<blockquote>${mode}</blockquote>`);
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // /csettings @ch
  bot.command('csettings', safe(async (ctx) => {
    if (ctx.chat.type !== 'private')
      return ctx.replyWithHTML(`<blockquote>❌ Gunakan di private chat.\n\nFormat: /csettings @channel</blockquote>`);
    const channel = ctx.message.text.split(/\s+/)[1];
    if (!channel) return ctx.replyWithHTML(`<blockquote>❓ Cara pakai: /csettings @channel</blockquote>`);
    try {
      const chId = await resolveChannel(ctx, channel);
      if (!await isChannelAdmin(ctx, chId))
        return ctx.replyWithHTML(`<blockquote>❌ Kamu bukan admin di channel ${channel}.</blockquote>`);

      const s    = S.getSettings(chId);
      const aq   = S.AUDIO_QUALITY[s.audioQuality];
      const vq   = S.VIDEO_QUALITY[s.videoQuality];
      const lang = { id:'🇮🇩 ID', en:'🇬🇧 EN', ms:'🇲🇾 MS', ar:'🇸🇦 AR', tr:'🇹🇷 TR', ru:'🇷🇺 RU' }[s.lang] || s.lang;

      await ctx.replyWithHTML(
        `<blockquote>⚙️ <b>Settings Channel</b>
📺 ${channel} (<code>${chId}</code>)
━━━━━━━━━━━━━━━━━━━━
🔈 Audio  : ${aq.label}
📹 Video  : ${vq.label}
🔊 Volume : ${s.volume}%
⏱ Leave  : ${s.autoLeave ? s.autoLeaveTime+'m' : 'Off'}
🌐 Lang   : ${lang}
━━━━━━━━━━━━━━━━━━━━</blockquote>`,
        {
          reply_markup: {
            inline_keyboard: [
              [btn('🔈 Audio', `ch_set_audio_${chId}`), btn('📹 Video', `ch_set_video_${chId}`)],
              [btn('🔊 Volume', `ch_set_vol_${chId}`),  btn('⏱ Auto-Leave', `ch_set_al_${chId}`)],
              [btn('🌐 Bahasa', `ch_set_lang_${chId}`), btn('🔄 Reset', `ch_set_reset_${chId}`)],
              [btn('❌ Tutup', `ch_set_close_${chId}`, 'danger')],
            ]
          }
        }
      );
    } catch (e) { await ctx.replyWithHTML(`<blockquote>❌ ${e.message}</blockquote>`); }
  }));

  // ──────────── Callbacks ───────────────────

  // Pause/Resume
  bot.action(/^ch_pause_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    const st   = queue.get(chId);
    const l    = S.getLang(chId);
    if (!st.isPlaying) return ctx.answerCbQuery(t(l,'no_playing'), { show_alert:true });
    if (st.isPaused) {
      await resumeStream(chId); st.isPaused = false; cancelLeaveTimer(chId);
      await ctx.answerCbQuery('▶️');
    } else {
      await pauseStream(chId); st.isPaused = true;
      await ctx.answerCbQuery('⏸');
    }
    const track = queue.current(chId);
    if (track) {
      try {
        await ctx.editMessageText(
          `<blockquote>${buildPlayerCaption(track, st, getElapsed(chId), l)}</blockquote>`,
          { parse_mode:'HTML', ...buildChannelPlayerButtons(chId, st, l) }
        );
      } catch {}
    }
  });

  // Skip
  bot.action(/^ch_skip_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    const st   = queue.get(chId); const l = S.getLang(chId);
    const next = queue.next(chId);
    if (!next) { stopStream(chId); st.isPlaying = false; return ctx.answerCbQuery(t(l,'no_next')); }
    stopStream(chId); await ctx.answerCbQuery(`⏭ ${next.title.slice(0,20)}`);
    st.isPlaying=true; st.isPaused=false; st.startedAt=Date.now();
    await playChannelTrack(ctx, chId, next, st).catch(console.error);
  });

  // Prev
  bot.action(/^ch_prev_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const l = S.getLang(chId);
    const prev = queue.prev(chId);
    if (!prev) return ctx.answerCbQuery(t(l,'no_prev'), { show_alert:true });
    stopStream(chId); await ctx.answerCbQuery(`⏮ ${prev.title.slice(0,20)}`);
    const st = queue.get(chId);
    st.isPlaying=true; st.isPaused=false; st.startedAt=Date.now();
    await playChannelTrack(ctx, chId, prev, st).catch(console.error);
  });

  // Stop
  bot.action(/^ch_stop_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const l = S.getLang(chId);
    stopStream(chId); queue.clear(chId);
    startLeaveTimer(chId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
    await ctx.answerCbQuery('⏹');
    await ctx.editMessageText(`<blockquote>${t(l,'stopped')}</blockquote>`, { parse_mode:'HTML' }).catch(() => {});
  });

  // Clear
  bot.action(/^ch_clear_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const l = S.getLang(chId);
    stopStream(chId); queue.clear(chId);
    startLeaveTimer(chId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
    await ctx.answerCbQuery('🗑');
    await ctx.editMessageText(`<blockquote>${t(l,'queue_cleared')}</blockquote>`, { parse_mode:'HTML' }).catch(() => {});
  });

  // Loop
  bot.action(/^ch_loop_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const st = queue.get(chId); const l = S.getLang(chId);
    if (!st.loop && !st.loopQueue) { st.loop = true; st.loopQueue = false; }
    else if (st.loop)              { st.loop = false; st.loopQueue = true; }
    else                           { st.loop = false; st.loopQueue = false; }
    const mode = st.loop ? '🔂' : st.loopQueue ? '🔁 Q' : '➖';
    await ctx.answerCbQuery(mode);
  });

  // Shuffle
  bot.action(/^ch_shuffle_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const l = S.getLang(chId);
    if (!queue.shuffle(chId)) return ctx.answerCbQuery(t(l,'no_queue_to_shuffle'), { show_alert:true });
    await ctx.answerCbQuery('🔀');
  });

  // Volume
  bot.action(/^ch_volup_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    const vol  = Math.min(S.getVolume(chId) + 10, 200);
    S.setVolume(chId, vol); queue.get(chId).volume = vol;
    await ctx.answerCbQuery(`🔊 ${vol}%`);
  });
  bot.action(/^ch_voldn_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    const vol  = Math.max(S.getVolume(chId) - 10, 0);
    S.setVolume(chId, vol); queue.get(chId).volume = vol;
    await ctx.answerCbQuery(`🔉 ${vol}%`);
  });

  // Queue page
  bot.action(/^ch_queue_(-?\d+)_(\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]); const page = parseInt(ctx.match[2]);
    const st   = queue.get(chId); const l = S.getLang(chId);
    const pages = Math.ceil(st.tracks.length / 10) || 1;
    await ctx.answerCbQuery();
    await ctx.editMessageText(buildQueueText(st, page, l), {
      parse_mode:'HTML', ...buildQueueButtons(chId, page, pages, l)
    }).catch(() => {});
  });

  // Stop video
  bot.action(/^ch_vstop_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    stopVideoStream(chId); queue.get(chId).isPlaying = false;
    await ctx.answerCbQuery('⏹ Video dihentikan');
    await ctx.editMessageText(`<blockquote>⏹ <b>Video channel dihentikan.</b></blockquote>`, { parse_mode:'HTML' }).catch(() => {});
  });

  // Search pick callbacks
  bot.action(/^ch_pick_(\d+)_(-?\d+)_(\d+)$/, async (ctx) => {
    const userId = parseInt(ctx.match[1]); const chId = parseInt(ctx.match[2]); const idx = parseInt(ctx.match[3]);
    if (ctx.from.id !== userId) return ctx.answerCbQuery('❌ Bukan milikmu', { show_alert:true });
    const cache = chSearchCache.get(`${userId}_${chId}`);
    if (!cache?.results?.[idx]) return ctx.answerCbQuery('❌');
    const track = cache.results[idx];
    await ctx.answerCbQuery(`🎵 ${track.title.slice(0,25)}`);
    await ctx.deleteMessage().catch(() => {});
    const check = await preCheckChannel(ctx, chId);
    if (!check.ok) return ctx.replyWithHTML(`<blockquote>${check.reason}</blockquote>`);
    track.requestedBy = userId;
    queue.add(chId, track);
    const st = queue.get(chId);
    if (st.isPlaying) {
      return ctx.replyWithHTML(`<blockquote>✅ Ditambahkan!\n🎵 ${track.title}\n📋 #${st.tracks.length}</blockquote>`);
    }
    st.currentIndex = st.tracks.length - 1;
    await playChannelTrack(ctx, chId, track, st).catch(console.error);
  });

  bot.action(/^ch_vpick_(\d+)_(-?\d+)_(\d+)$/, async (ctx) => {
    const userId = parseInt(ctx.match[1]); const chId = parseInt(ctx.match[2]); const idx = parseInt(ctx.match[3]);
    if (ctx.from.id !== userId) return ctx.answerCbQuery('❌', { show_alert:true });
    const cache = chSearchCache.get(`${userId}_${chId}_v`);
    if (!cache?.results?.[idx]) return ctx.answerCbQuery('❌');
    const track = cache.results[idx];
    await ctx.answerCbQuery(`📹 ${track.title.slice(0,25)}`);
    await ctx.deleteMessage().catch(() => {});
    const check = await preCheckChannel(ctx, chId);
    if (!check.ok) return ctx.replyWithHTML(`<blockquote>${check.reason}</blockquote>`);
    const quality = S.getVideoQuality(chId); const volume = S.getVolume(chId);
    const client  = getMusicClient(chId);
    const loadMsg = await ctx.replyWithHTML(`<blockquote>⬇️ Download video...\n📹 ${track.title}</blockquote>`);
    try {
      await startVideoStream(client, chId, track.url, {
        onFinish: async () => { queue.get(chId).isPlaying = false; }
      }, quality, volume, track.videoId);
      queue.get(chId).isPlaying = true;
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>📹 <b>Stream Video Channel</b>\n🎬 ${track.title}\n📺 ${S.VIDEO_QUALITY[quality].label} · 🔊 ${volume}%</blockquote>`,
        { parse_mode:'HTML', reply_markup: { inline_keyboard: [[btn('⏹ Stop', `ch_vstop_${chId}`, 'danger')]] } }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }).catch(() => {});
    }
  });

  bot.action(/^ch_cancel_search_(\d+)$/, async (ctx) => {
    if (ctx.from.id !== parseInt(ctx.match[1])) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery('❌ Dibatalkan'); await ctx.deleteMessage().catch(() => {});
  });

  // Settings callbacks
  bot.action(/^ch_settings_(-?\d+)$/, async (ctx) => {
    const chId = parseInt(ctx.match[1]);
    if (!await isChannelAdmin(ctx, chId)) return ctx.answerCbQuery('❌ Bukan admin', { show_alert:true });
    await ctx.answerCbQuery();
    const s  = S.getSettings(chId); const aq = S.AUDIO_QUALITY[s.audioQuality]; const vq = S.VIDEO_QUALITY[s.videoQuality];
    const lang = { id:'🇮🇩',en:'🇬🇧',ms:'🇲🇾',ar:'🇸🇦',tr:'🇹🇷',ru:'🇷🇺' }[s.lang]||s.lang;
    await ctx.editMessageText(
      `<blockquote>⚙️ <b>Settings Channel</b> <code>${chId}</code>\n━━━━━━━━━━━━━━━━━━━━\n🔈 ${aq.label}\n📹 ${vq.label}\n🔊 ${s.volume}%\n⏱ ${s.autoLeave?s.autoLeaveTime+'m':'Off'}\n${lang}</blockquote>`,
      { parse_mode:'HTML', reply_markup: { inline_keyboard: [
        [btn('🔈 Audio',`ch_set_audio_${chId}`), btn('📹 Video',`ch_set_video_${chId}`)],
        [btn('🔊 Volume',`ch_set_vol_${chId}`), btn('⏱ Leave',`ch_set_al_${chId}`)],
        [btn('🌐 Lang',`ch_set_lang_${chId}`), btn('🔄 Reset',`ch_set_reset_${chId}`)],
        [btn('❌ Tutup',`ch_set_close_${chId}`,'danger')],
      ]}}
    ).catch(() => {});
  });

  // Audio quality
  for (const q of ['low','medium','high']) {
    bot.action(new RegExp(`^ch_set_audio_${q}_(-?\\d+)$`), async (ctx) => {
      const chId = parseInt(ctx.match[1]);
      S.setAudioQuality(chId, q);
      await ctx.answerCbQuery(`✅ ${S.AUDIO_QUALITY[q].label}`);
    });
    bot.action(new RegExp(`^ch_aq_${q}_(-?\\d+)$`), async (ctx) => {
      const chId = parseInt(ctx.match[1]); S.setAudioQuality(chId, q);
      await ctx.answerCbQuery(`✅ ${S.AUDIO_QUALITY[q].label}`);
    });
  }

  // Dummy handlers for settings sub-menus
  bot.action(/^ch_set_(audio|video|vol|al|lang|reset|close)_(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('⚙️ Gunakan /csettings @channel untuk settings lengkap');
  });
};
