// ==========================================
// FILE: music/videoplay.js
// Video + Audio streaming ke Voice Chat
// Source: owner @arnabxd/ntgcalls-napi
// - Audio: mediaSource:2, -vn, s16le, "-"
// - Video: mediaSource:2, -an, rawvideo yuv420p, "-"
// - Join dengan isVideoEnabled: true (videoStopped: false)
// ==========================================

const { Markup }  = require('telegraf');
const { searchYouTube, getVideoInfo, getVideoUrl, downloadVideo, isYouTubeUrl } = require('./ytdl');
const { getMusicClient, checkBotIsAdmin, checkUserbotInGroup,
        checkUserbotIsAdmin, autoJoinGroup, promoteUserbot,
        isVoiceChatActive, startVoiceChat, cancelLeaveTimer,
        startLeaveTimer, userbotLeaveGroup } = require('./musicbot');
const { joinVoiceChat, buildAudioCmd } = require('./streamer');
const { Api } = require('teleproto');
const { resolveChannelEntity, clarifyTeleprotoError } = require('./tgutils');

const queue      = require('./queue');
const { getLang, getVideoQuality, getVolume, VIDEO_QUALITY } = require('./settings');
const { t }      = require('./i18n');
const { deleteAndSendPlayer } = require('./ui');
const { safe }   = require('./error_handler');

let NtgCalls     = null;
try { NtgCalls = require('@arnabxd/ntgcalls-napi').NtgCalls; } catch {}

const videoSessions  = new Map();
const videoSearchCache = new Map();

const QUALITY = {
  low:    { width: 640,  height: 360, fps: 24 },
  medium: { width: 854,  height: 480, fps: 30 },
  high:   { width: 1280, height: 720, fps: 30 },
};

// ─── Build video ffmpeg commands ──────────
function buildVideoSources(fileOrUrl, quality = 'medium', volume = 100) {
  const q   = QUALITY[quality] || QUALITY.medium;
  const vol = Math.max(0, Math.min(200, volume)) / 100;
  const volFilter = vol !== 1.0 ? `-af "volume=${vol}"` : '';

  return {
    microphone: {
      mediaSource:  2,
      // -vn = no video, audio only track
      input: `ffmpeg -i "${fileOrUrl}" -vn ${volFilter} -f s16le -ar 48000 -ac 1 -`
        .replace(/\s+/g, ' ').trim(),
      sampleRate:   48000,
      channelCount: 1,
      keepOpen:     false,
    },
    camera: {
      mediaSource: 2,
      // -an = no audio, video only track
      // scale+pad to exact canvas (required by ntgcalls)
      input: `ffmpeg -i "${fileOrUrl}" -an -f rawvideo -pix_fmt yuv420p -vf "scale=${q.width}:${q.height}:force_original_aspect_ratio=decrease,pad=${q.width}:${q.height}:(ow-iw)/2:(oh-ih)/2,fps=${q.fps}" -`
        .replace(/\s+/g, ' ').trim(),
      width:    q.width,
      height:   q.height,
      fps:      q.fps,
      keepOpen: false,
    },
  };
}

// ─── Start video stream ─────────────────────
async function startVideoStream(client, chatId, videoUrl, callbacks = {}, quality = 'medium', volume = 100, videoId = null) {
  if (!NtgCalls) throw new Error('ntgcalls-napi tidak tersedia.');

  // Stop existing
  const old = videoSessions.get(String(chatId));
  if (old) { try { old.ntg?.stop(Number(chatId)); } catch {} videoSessions.delete(String(chatId)); }

  // Download video file dulu (butuh untuk dual-track ffmpeg)
  let filePath;
  try {
    filePath = await downloadVideo(videoUrl, videoId);
  } catch (e) {
    // Fallback: stream langsung dari URL
    console.warn('[videoplay] download gagal, stream dari URL:', e.message);
    filePath = videoUrl;
  }

  const ntg       = new NtgCalls();
  const offerSdp  = await ntg.create(Number(chatId));

  // JOIN dengan isVideoEnabled: true (videoStopped: false)
  const answerSdp = await joinVoiceChat(client, chatId, offerSdp, true);
  await ntg.connect(Number(chatId), answerSdp, false);

  const sources = buildVideoSources(filePath, quality, volume);
  await ntg.set_stream_sources(Number(chatId), 0, sources);

  ntg.on('stream-end', (cid, streamType) => {
    if (Number(cid) !== Number(chatId)) return;
    if (streamType !== undefined && streamType !== 0) return;
    videoSessions.delete(String(chatId));
    if (callbacks.onFinish) callbacks.onFinish();
  });

  videoSessions.set(String(chatId), { ntg, filePath, startedAt: Date.now() });
  return true;
}

function stopVideoStream(chatId) {
  const s = videoSessions.get(String(chatId));
  if (s) { try { s.ntg?.stop(Number(chatId)); } catch {} videoSessions.delete(String(chatId)); }
}

// ─── Pre-check ─────────────────────────────
async function preCheck(ctx, chatId) {
  const l = getLang(chatId);
  if (!await checkBotIsAdmin(ctx, chatId))   return { ok: false, reason: t(l,'bot_not_admin') };
  const client = getMusicClient(chatId);
  if (!client)                                return { ok: false, reason: t(l,'userbot_not_login') };

  // Fast path: userbot udah admin/owner → skip cek "di grup" + invite/promote.
  if (!await checkUserbotIsAdmin(ctx, chatId)) {
    if (!await checkUserbotInGroup(chatId)) {
      try {
        await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'inviting_userbot')}</blockquote>`, { parse_mode:'HTML' });
        await autoJoinGroup(ctx, chatId);
        await new Promise(r => setTimeout(r, 1500)); // beri waktu Telegram propagate join sebelum resolve/promote
      } catch (e) { return { ok: false, reason: t(l,'invite_failed',clarifyTeleprotoError(e)) }; }
    }
    try {
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'promoting_userbot')}</blockquote>`, { parse_mode:'HTML' });
      await promoteUserbot(ctx, chatId);
    } catch (e) { return { ok: false, reason: t(l,'promote_failed',clarifyTeleprotoError(e)) }; }
  }
  if (!await isVoiceChatActive(chatId)) {
    try {
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'starting_vc')}</blockquote>`, { parse_mode:'HTML' });
      await startVoiceChat(chatId);
    } catch (e) { return { ok: false, reason: t(l,'vc_failed',e.message) }; }
  }
  return { ok: true };
}

// ─── Register commands ─────────────────────
module.exports = (bot) => {

  // /vplay
  bot.command(['vplay','videoplay'], safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type))
      return ctx.replyWithHTML(`<blockquote>${t(getLang(ctx.chat.id),'only_group')}</blockquote>`);

    const chatId = ctx.chat.id;
    const l      = getLang(chatId);
    const input  = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!input) return ctx.replyWithHTML(`<blockquote>📹 <b>Video Play</b>\n\nCara pakai:\n/vplay judul video\n/vplay https://youtube.com/...\n\nContoh: /vplay Squid Game OST</blockquote>`);

    cancelLeaveTimer(chatId);
    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 ${t(l,'checking_group')}</blockquote>`);
    const check   = await preCheck(ctx, chatId);
    if (!check.ok) return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' });

    try {
      let track;
      if (isYouTubeUrl(input)) {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, `<blockquote>${t(l,'fetching_info')}</blockquote>`, { parse_mode:'HTML' });
        track = await getVideoInfo(input);
      } else {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, `<blockquote>🔍 Mencari video...</blockquote>`, { parse_mode:'HTML' });
        const results = await searchYouTube(input, 1);
        if (!results.length) return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' });
        track = results[0];
      }
      if (!track) throw new Error('Gagal mengambil info video');

      const quality = getVideoQuality(chatId);
      const volume  = getVolume(chatId);
      const vqLabel = VIDEO_QUALITY[quality].label;
      const client  = getMusicClient(chatId);

      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>⬇️ Mendownload video...\n📹 <b>${track.title}</b>\n\n<i>Mungkin membutuhkan beberapa saat...</i></blockquote>`,
        { parse_mode:'HTML' }
      );

      await startVideoStream(client, chatId, track.url, {
        onFinish: async () => {
          queue.get(chatId).isPlaying = false;
          try { await ctx.telegram.sendMessage(chatId, `<blockquote>✅ Video selesai.\n⏳ Userbot keluar 15 menit.</blockquote>`, { parse_mode:'HTML' }); } catch {}
          startLeaveTimer(chatId, async (id) => { await userbotLeaveGroup(id); queue.delete(id); });
        },
      }, quality, volume, track.videoId);

      queue.get(chatId).isPlaying = true;
      await ctx.telegram.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
      await ctx.replyWithHTML(
        `<blockquote>📹 <b>Sedang Stream Video</b>
━━━━━━━━━━━━━━━━━━━━
🎬 <b>${track.title}</b>
👤 ${track.uploader}
⏱ ${track.durationFmt} · 👁 ${track.viewsFmt}
📺 ${vqLabel} · 🔊 ${volume}%
━━━━━━━━━━━━━━━━━━━━</blockquote>`,
        Markup.inlineKeyboard([[
          Markup.button.callback('⏹ Stop', `vstop_${chatId}`),
          Markup.button.callback('⚙️ Settings', `set_back_${chatId}`),
        ]])
      );
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ <b>Gagal stream video:</b>\n${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // /vsearch
  bot.command('vsearch', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = getLang(chatId);
    const input  = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!input) return ctx.replyWithHTML(`<blockquote>❓ Cara pakai: /vsearch judul video</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>🔍 Mencari video...</blockquote>`);
    try {
      const results = await searchYouTube(input, 5);
      if (!results.length) return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' });

      videoSearchCache.set(String(chatId), results);
      let text = `<blockquote>📹 <b>Hasil Pencarian Video</b>\nQuery: <i>${input}</i>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((r, i) => {
        text += `${i+1}. <b>${r.title.length > 40 ? r.title.slice(0,40)+'…' : r.title}</b>\n   👤 ${r.uploader} · ⏱ ${r.durationFmt}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n📹 Pilih video:</blockquote>`;
      const buttons = results.map((r, i) => [
        Markup.button.callback(`${i+1}. ${r.title.slice(0,35)}`, `vpick_${chatId}_${i}`)
      ]);
      buttons.push([Markup.button.callback('❌ Batal', `vcancel_${chatId}`)]);
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, text, {
        parse_mode:'HTML', ...Markup.inlineKeyboard(buttons)
      });
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  bot.action(/^vpick_(-?\d+)_(\d+)$/, async (ctx) => {
    const chatId  = parseInt(ctx.match[1]);
    const idx     = parseInt(ctx.match[2]);
    const results = videoSearchCache.get(String(chatId));
    if (!results?.[idx]) return ctx.answerCbQuery('❌');
    const track = results[idx];
    await ctx.answerCbQuery(`📹 ${track.title.slice(0,25)}`);
    await ctx.deleteMessage().catch(() => {});
    const check = await preCheck(ctx, chatId);
    if (!check.ok) return ctx.telegram.sendMessage(chatId, `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' });
    const quality = getVideoQuality(chatId);
    const volume  = getVolume(chatId);
    const client  = getMusicClient(chatId);
    const loadMsg = await ctx.telegram.sendMessage(chatId,
      `<blockquote>⬇️ Mendownload video...\n📹 <b>${track.title}</b></blockquote>`, { parse_mode:'HTML' }
    );
    try {
      await startVideoStream(client, chatId, track.url, {
        onFinish: async () => { queue.get(chatId).isPlaying = false; }
      }, quality, volume, track.videoId);
      queue.get(chatId).isPlaying = true;
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>📹 <b>Sedang Stream Video</b>\n🎬 ${track.title}\n📺 ${VIDEO_QUALITY[quality].label} · 🔊 ${volume}%</blockquote>`,
        { parse_mode:'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⏹ Stop', `vstop_${chatId}`)]]) }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ Gagal: ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  });

  bot.action(/^vstop_(-?\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1]);
    stopVideoStream(chatId);
    queue.get(chatId).isPlaying = false;
    await ctx.answerCbQuery('⏹');
    try { await ctx.editMessageCaption(`<blockquote>⏹ Video dihentikan.</blockquote>`, { parse_mode:'HTML' }); }
    catch { await ctx.editMessageText(`<blockquote>⏹ Video dihentikan.</blockquote>`, { parse_mode:'HTML' }).catch(() => {}); }
  });

  bot.action(/^vcancel_(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('❌'); await ctx.deleteMessage().catch(() => {});
  });
};

module.exports.videoSessions    = videoSessions;
module.exports.startVideoStream = startVideoStream;
module.exports.stopVideoStream  = stopVideoStream;
