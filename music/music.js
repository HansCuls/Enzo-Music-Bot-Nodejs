// ==========================================
// FILE: music/music.js
// Main music command handler — LENGKAP
// Commands: play, search, pause, resume, skip,
//   prev, stop, queue, np, loop, volume, seek,
//   shuffle, remove, move, skipto, download,
//   lyrics, history, playlist, musichelp
// ==========================================

const queue    = require('./queue');
const { safe, writeLog } = require('./error_handler');
const { searchYouTube, getVideoInfo, downloadAudio, getStreamUrl, isYouTubeUrl } = require('./ytdl');
const { startStream, stopStream, pauseStream, resumeStream, getElapsed } = require('./streamer');
const { buildPlayerCaption, buildPlayerButtons, sendPlayer, updatePlayer,
        safeEdit, deleteAndSendPlayer,
        buildQueueText, buildQueueButtons,
        buildSearchText, buildSearchButtons, buildHistoryText, fmtMs } = require('./ui');
const { getMusicClient, startVoiceChat, isVoiceChatActive, checkBotIsAdmin,
        checkUserbotIsAdmin, checkUserbotInGroup, promoteUserbot,
        autoJoinGroup, userbotLeaveGroup, startLeaveTimer, cancelLeaveTimer } = require('./musicbot');
const { clarifyTeleprotoError } = require('./tgutils');
const { getLyrics }         = require('./lyrics');
const { savePlaylist, loadPlaylist, deletePlaylist, listPlaylists } = require('./playlist');
const { getLang, canPlay, getAutoDelete, getNoDuplicate, getMaxQueue } = require('./settings');
const { setVolume, getVolume } = require('./settings');
const { t }                 = require('./i18n');



// ─── Safe edit: handle both photo and text messages ───
async function safeEditMessage(ctx, text, extra = {}) {
  const msg = ctx.callbackQuery?.message;
  const isPhoto = !!(msg?.photo || msg?.animation || msg?.video);
  try {
    if (isPhoto) {
      await ctx.editMessageCaption(text, { parse_mode: 'HTML', ...extra });
    } else {
      const wrapped = text.startsWith('<blockquote>') ? text : `<blockquote>${text}</blockquote>`;
      await ctx.editMessageText(wrapped, { parse_mode: 'HTML', ...extra });
    }
  } catch (e) {
    if (!e.message?.includes('message is not modified') &&
        !e.message?.includes('no text in the message')) throw e;
  }
}
// ─── Auto-delete helper ───────────────────
async function autoDelete(ctx, chatId, msgId, delay) {
  const d = delay ?? getAutoDelete(chatId);
  if (!d || !msgId) return;
  setTimeout(async () => {
    try { await ctx.telegram.deleteMessage(chatId, msgId); } catch {}
  }, d * 1000);
}
const progressIntervals = new Map();
const searchCache       = new Map(); // chatId => [results]

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function lang(ctx) {
  return getLang(ctx.chat?.id || ctx.chatId || 0);
}

async function updatePlayerUI(ctx, chatId, state) {
  try {
    const track = queue.current(chatId);
    if (!track || !state.msgId) return;
    const l = getLang(chatId);
    await updatePlayer(
      ctx.telegram, chatId, state.msgId, state.isPhoto,
      track, state, getElapsed(chatId), l
    );
  } catch (e) {
    if (e.message?.includes('no text in the message') ||
        e.message?.includes('message to edit not found')) {
      // Message was deleted, send new one
      try {
        const result = await sendPlayer(ctx.telegram, chatId, track, state, getElapsed(chatId), l);
        state.msgId   = result.msgId;
        state.isPhoto = result.isPhoto;
      } catch {}
    } else if (!e.message?.includes('message is not modified')) {
      console.error('[music] updatePlayerUI:', e.message);
    }
  }
}

function startProgressInterval(ctx, chatId) {
  stopProgressInterval(chatId);
  const iv = setInterval(async () => {
    const state = queue.get(chatId);
    if (!state.isPlaying || state.isPaused) return;
    await updatePlayerUI(ctx, chatId, state);
  }, 10000);
  progressIntervals.set(String(chatId), iv);
}
function stopProgressInterval(chatId) {
  const iv = progressIntervals.get(String(chatId));
  if (iv) { clearInterval(iv); progressIntervals.delete(String(chatId)); }
}

function onQueueEmpty(ctx, chatId) {
  const l = getLang(chatId);
  startLeaveTimer(chatId, async (id) => {
    try {
      await ctx.telegram.sendMessage(id,
        `<blockquote>${t(l,'auto_leave')}</blockquote>`,
        { parse_mode: 'HTML' }
      );
    } catch {}
    await userbotLeaveGroup(id);
    queue.delete(id);
  });
}

// ─────────────────────────────────────────
// PRE-CHECK
// ─────────────────────────────────────────

async function preCheck(ctx, chatId) {
  const l = getLang(chatId);

  const botIsAdmin = await checkBotIsAdmin(ctx, chatId);
  if (!botIsAdmin) return { ok: false, reason: t(l,'bot_not_admin') };

  const client = getMusicClient(chatId);
  if (!client) return { ok: false, reason: t(l,'userbot_not_login') };

  // Fast path: userbot udah admin/owner → langsung lanjut. Gak perlu cek "di grup"
  // (bergantung resolve MTProto, lebih rawan gagal abis restart) atau invite/promote ulang.
  const alreadyAdmin = await checkUserbotIsAdmin(ctx, chatId);

  if (!alreadyAdmin) {
    const inGroup = await checkUserbotInGroup(chatId);
    if (!inGroup) {
      try {
        await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'inviting_userbot')}</blockquote>`, { parse_mode:'HTML' });
        await autoJoinGroup(ctx, chatId);
        await new Promise(r => setTimeout(r, 1500)); // beri waktu Telegram propagate join sebelum resolve/promote
        await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'userbot_joined')}</blockquote>`, { parse_mode:'HTML' });
      } catch (e) {
        return { ok: false, reason: t(l,'invite_failed',clarifyTeleprotoError(e)) };
      }
    }

    try {
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'promoting_userbot')}</blockquote>`, { parse_mode:'HTML' });
      await promoteUserbot(ctx, chatId);
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'userbot_promoted')}</blockquote>`, { parse_mode:'HTML' });
    } catch (e) {
      return { ok: false, reason: t(l,'promote_failed',clarifyTeleprotoError(e)) };
    }
  }

  const vcActive = await isVoiceChatActive(chatId);
  if (!vcActive) {
    try {
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'starting_vc')}</blockquote>`, { parse_mode:'HTML' });
      await startVoiceChat(chatId);
      await ctx.telegram.sendMessage(chatId, `<blockquote>${t(l,'vc_started')}</blockquote>`, { parse_mode:'HTML' });
    } catch (e) {
      return { ok: false, reason: t(l,'vc_failed',e.message) };
    }
  }

  return { ok: true };
}

// ─────────────────────────────────────────
// PLAY TRACK
// ─────────────────────────────────────────

async function playTrack(ctx, chatId, track, state) {
  cancelLeaveTimer(chatId);
  const l   = getLang(chatId);
  const vol = getVolume(chatId);

  try {
    const streamUrl = await getStreamUrl(track.url);

    await startStream(getMusicClient(chatId), chatId, streamUrl, {
      onFinish: async () => {
        stopProgressInterval(chatId);
        state.isPlaying = false;
        if (state.loop) {
          await playTrack(ctx, chatId, track, state);
        } else {
          const next = queue.next(chatId);
          if (next) {
            const fresh = queue.get(chatId);
            fresh.isPlaying = true; fresh.isPaused = false; fresh.startedAt = Date.now();
            await playTrack(ctx, chatId, next, fresh);
          } else {
            queue.get(chatId).isPlaying = false;
            stopProgressInterval(chatId);
            try {
              await ctx.telegram.sendMessage(chatId,
                `<blockquote>${t(l,'all_done')}</blockquote>`, { parse_mode:'HTML' }
              );
            } catch {}
            onQueueEmpty(ctx, chatId);
          }
        }
      },
      onError: async (e) => {
        console.error('[music] Stream error:', e.message);
        stopProgressInterval(chatId);
        try {
          await ctx.telegram.sendMessage(chatId,
            `<blockquote>${t(l,'stream_error',e.message)}</blockquote>`, { parse_mode:'HTML' }
          );
        } catch {}
        onQueueEmpty(ctx, chatId);
      },
    }, vol, track.videoId);

    state.isPlaying = true; state.isPaused = false; state.startedAt = Date.now();
    state.volume    = vol;
    startProgressInterval(ctx, chatId);

    // Log to log channel if set
    const { getLogChannel } = require('./settings');
    const logCh = getLogChannel(chatId);
    if (logCh) {
      ctx.telegram.sendMessage(logCh,
        `<blockquote>🎵 <b>Now Playing</b>

🎬 ${track.title}
👤 ${track.uploader}
⏱ ${track.durationFmt}
👁 ${track.viewsFmt}
👥 Grup: <code>${chatId}</code></blockquote>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    // Delete old player, send fresh new one for each song
    const result = await deleteAndSendPlayer(ctx.telegram, chatId, state.msgId, track, state, l);
    state.msgId   = result.msgId;
    state.isPhoto = result.isPhoto;
  } catch (e) {
    console.error('[music] playTrack error:', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────
// SEEK HELPER
// ─────────────────────────────────────────

function parseSeekTime(str) {
  // Accepts: "90", "1:30", "1:30:00"
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// ─────────────────────────────────────────
// MODULE EXPORT
// ─────────────────────────────────────────

module.exports = (bot) => {

  // ──────────────── /play ────────────────
  bot.command('play', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type))
      return ctx.replyWithHTML(`<blockquote>${t(lang(ctx),'only_group')}</blockquote>`);

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const l      = lang(ctx);
    const input  = ctx.message.text.split(' ').slice(1).join(' ').trim();

    if (!input) return ctx.replyWithHTML(`<blockquote>${t(l,'play_usage')}</blockquote>`);

    // Check play permission (settings: all / admin / dj)
    if (!await canPlay(ctx, chatId)) {
      const m = await ctx.replyWithHTML(`<blockquote>❌ Kamu tidak punya izin untuk memutar musik di grup ini.

⚙️ Setting: /settings</blockquote>`);
      autoDelete(ctx, chatId, m.message_id);
      return;
    }

    // Check max queue limit
    const maxQ = getMaxQueue(chatId);
    if (maxQ > 0 && queue.size(chatId) >= maxQ) {
      const m = await ctx.replyWithHTML(`<blockquote>❌ Antrian penuh! Maksimal <b>${maxQ} lagu</b>.

Gunakan /skip atau /remove untuk memberi ruang.</blockquote>`);
      autoDelete(ctx, chatId, m.message_id);
      return;
    }

    cancelLeaveTimer(chatId);
    const loadMsg = await ctx.replyWithHTML(`<blockquote>${t(l,'checking_group')}</blockquote>`);
    const check   = await preCheck(ctx, chatId);
    if (!check.ok) {
      return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' }
      );
    }

    try {
      let track;
      if (isYouTubeUrl(input)) {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'fetching_info')}</blockquote>`, { parse_mode:'HTML' }
        );
        track = await getVideoInfo(input);
        if (!track) throw new Error('Gagal mengambil info video');
      } else {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'searching_yt')}</blockquote>`, { parse_mode:'HTML' }
        );
        const results = await searchYouTube(input, 1);
        if (!results.length) {
          return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
            `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' }
          );
        }
        track = results[0];
      }
      track.requestedBy = userId;

      // Check for duplicate songs
      if (getNoDuplicate(chatId)) {
        const state = queue.get(chatId);
        const isDup = state.tracks.some(t => t.videoId === track.videoId || t.url === track.url);
        if (isDup) {
          const m = await ctx.replyWithHTML(`<blockquote>🚫 <b>Lagu sudah ada di antrian!</b>

🎵 ${track.title}

<i>Cegah duplikat aktif di settings grup ini.</i></blockquote>`);
          autoDelete(ctx, chatId, m.message_id);
          return;
        }
      }

      queue.add(chatId, track);
      const state = queue.get(chatId);

      if (state.isPlaying) {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'added_to_queue',track.title,track.uploader,track.durationFmt,state.tracks.length)}</blockquote>`,
          { parse_mode:'HTML' }
        );
      } else {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'starting_play')}</blockquote>`, { parse_mode:'HTML' }
        );
        state.currentIndex = state.tracks.length - 1;
        await playTrack(ctx, chatId, track, state);
        await ctx.telegram.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
      }
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ <b>Error:</b> ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────────── /search ────────────────
  bot.command('search', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type))
      return ctx.replyWithHTML(`<blockquote>${t(lang(ctx),'only_group')}</blockquote>`);

    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const input  = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!input) return ctx.replyWithHTML(`<blockquote>${t(l,'search_usage')}</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>${t(l,'searching_yt')}</blockquote>`);
    try {
      const results = await searchYouTube(input, 5);
      if (!results.length) {
        return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' }
        );
      }
      searchCache.set(String(chatId), results);
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        buildSearchText(results, input, l),
        { parse_mode:'HTML', ...buildSearchButtons(results, chatId, l) }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────────── /pause ────────────────
  bot.command('pause', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    if (!state.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    if (state.isPaused)   return ctx.replyWithHTML(`<blockquote>${t(l,'already_paused')}</blockquote>`);
    if (await pauseStream(chatId)) {
      state.isPaused = true;
      await ctx.replyWithHTML(`<blockquote>${t(l,'paused')}</blockquote>`);
      await updatePlayerUI(ctx, chatId, state);
    }
  }));

  // ──────────────── /resume ────────────────
  bot.command('resume', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    if (!state.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    if (!state.isPaused)  return ctx.replyWithHTML(`<blockquote>${t(l,'already_playing')}</blockquote>`);
    if (await resumeStream(chatId)) {
      state.isPaused = false;
      cancelLeaveTimer(chatId);
      await ctx.replyWithHTML(`<blockquote>${t(l,'resumed')}</blockquote>`);
      await updatePlayerUI(ctx, chatId, state);
    }
  }));

  // ──────────────── /skip [n] ────────────────
  bot.command('skip', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    if (!state.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);

    const n = parseInt(ctx.message.text.split(' ')[1]) || 1;
    let next = null;
    for (let i = 0; i < n; i++) next = queue.next(chatId);

    if (!next) {
      stopStream(chatId); stopProgressInterval(chatId); state.isPlaying = false;
      onQueueEmpty(ctx, chatId);
      return ctx.replyWithHTML(`<blockquote>${t(l,'no_next')}</blockquote>`);
    }
    stopStream(chatId);
    await ctx.replyWithHTML(`<blockquote>${t(l,'skipped',next.title)}</blockquote>`);
    state.isPlaying = true; state.isPaused = false; state.startedAt = Date.now();
    await playTrack(ctx, chatId, next, state).catch(console.error);
  }));

  // ──────────────── /prev ────────────────
  bot.command('prev', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    const prev   = queue.prev(chatId);
    if (!prev) return ctx.replyWithHTML(`<blockquote>${t(l,'no_prev')}</blockquote>`);
    stopStream(chatId);
    await ctx.replyWithHTML(`<blockquote>${t(l,'prev_track',prev.title)}</blockquote>`);
    state.isPlaying = true; state.isPaused = false; state.startedAt = Date.now();
    await playTrack(ctx, chatId, prev, state).catch(console.error);
  }));

  // ──────────────── /stop ────────────────
  bot.command('stop', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    stopStream(chatId); stopProgressInterval(chatId); queue.clear(chatId);
    onQueueEmpty(ctx, chatId);
    await ctx.replyWithHTML(`<blockquote>${t(l,'stopped')}</blockquote>`);
  }));

  // ──────────────── /queue [page] ────────────────
  bot.command('queue', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    const page   = Math.max(0, (parseInt(ctx.message.text.split(' ')[1]) || 1) - 1);
    const perPage= 10;
    const pages  = Math.ceil(state.tracks.length / perPage) || 1;
    await ctx.replyWithHTML(
      buildQueueText(state, page, l),
      buildQueueButtons(chatId, page, pages, l)
    );
  }));

  // ──────────────── /np /nowplaying ────────────────
  bot.command(['np','nowplaying'], safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    const track  = queue.current(chatId);
    if (!state.isPlaying || !track) {
      return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    }
    const result = await sendPlayer(ctx.telegram, chatId, track, state, getElapsed(chatId), l);
    state.msgId   = result.msgId;
    state.isPhoto = result.isPhoto;
  }));

  // ──────────────── /loop ────────────────
  bot.command('loop', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    // Cycle: off → song → queue → off
    if (!state.loop && !state.loopQueue)    { state.loop = true; state.loopQueue = false; }
    else if (state.loop && !state.loopQueue){ state.loop = false; state.loopQueue = true; }
    else                                    { state.loop = false; state.loopQueue = false; }

    const mode = state.loop ? t(l,'loop_song') : state.loopQueue ? t(l,'loop_queue') : t(l,'loop_off');
    await ctx.replyWithHTML(`<blockquote>${mode}</blockquote>`);
    if (state.isPlaying) await updatePlayerUI(ctx, chatId, state);
  }));

  // ──────────────── /volume ────────────────
  bot.command('volume', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const args   = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.replyWithHTML(`<blockquote>${t(l,'volume_usage')}\n\n🔊 ${t(l,'volume_set',getVolume(chatId))}</blockquote>`);
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 200)
      return ctx.replyWithHTML(`<blockquote>${t(l,'volume_invalid')}</blockquote>`);
    setVolume(chatId, vol);
    queue.get(chatId).volume = vol;
    await ctx.replyWithHTML(`<blockquote>${t(l,'volume_set',vol)}</blockquote>`);
    if (queue.get(chatId).isPlaying) await updatePlayerUI(ctx, chatId, queue.get(chatId));
  }));

  // ──────────────── /seek ────────────────
  bot.command('seek', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const args   = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.replyWithHTML(`<blockquote>${t(l,'seek_usage')}</blockquote>`);
    const seconds = parseSeekTime(args[0]);
    if (seconds === null) return ctx.replyWithHTML(`<blockquote>${t(l,'seek_invalid')}</blockquote>`);
    const state = queue.get(chatId);
    if (!state.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    // Re-play from seek position (ntgcalls doesn't natively support seek,
    // so we restart stream with ffmpeg -ss offset)
    const track = queue.current(chatId);
    if (!track) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    try {
      stopStream(chatId);
      const streamUrl  = await getStreamUrl(track.url);
      const vol        = getVolume(chatId);
      const ffmpegArgs = `ffmpeg -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -ss ${seconds} -i "${streamUrl}" -af "volume=${vol/100}" -f s16le -ac 1 -ar 48000 pipe:1`;
      // Restart with offset — we pass custom cmd via a workaround
      state.startedAt = Date.now() - (seconds * 1000);
      await startStream(getMusicClient(chatId), chatId, streamUrl, {
        onFinish: async () => {
          stopProgressInterval(chatId);
          state.isPlaying = false;
          const next = queue.next(chatId);
          if (next) { state.isPlaying=true; state.isPaused=false; state.startedAt=Date.now(); await playTrack(ctx,chatId,next,state); }
          else onQueueEmpty(ctx, chatId);
        },
        onError: async (e) => {
          console.error('[seek] error:', e.message);
          onQueueEmpty(ctx, chatId);
        },
      }, vol);
      const timeStr = fmtMs(seconds * 1000);
      await ctx.replyWithHTML(`<blockquote>${t(l,'seek_done',timeStr)}</blockquote>`);
      await updatePlayerUI(ctx, chatId, state);
    } catch (e) {
      await ctx.replyWithHTML(`<blockquote>${t(l,'seek_failed')}</blockquote>`);
    }
  }));

  // ──────────────── /shuffle ────────────────
  bot.command('shuffle', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const state  = queue.get(chatId);
    if (state.tracks.length <= 1)
      return ctx.replyWithHTML(`<blockquote>${t(l,'no_queue_to_shuffle')}</blockquote>`);
    queue.shuffle(chatId);
    await ctx.replyWithHTML(`<blockquote>${t(l,'shuffled')}</blockquote>`);
  }));

  // ──────────────── /remove <n> ────────────────
  bot.command('remove', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const n      = parseInt(ctx.message.text.split(' ')[1]);
    if (!n) return ctx.replyWithHTML(`<blockquote>${t(l,'remove_usage')}</blockquote>`);
    const state = queue.get(chatId);
    const idx   = n - 1;
    if (idx < 0 || idx >= state.tracks.length)
      return ctx.replyWithHTML(`<blockquote>${t(l,'remove_invalid')}</blockquote>`);
    if (idx === state.currentIndex)
      return ctx.replyWithHTML(`<blockquote>${t(l,'remove_current')}</blockquote>`);
    const title = state.tracks[idx].title;
    queue.remove(chatId, idx);
    await ctx.replyWithHTML(`<blockquote>${t(l,'removed',title)}</blockquote>`);
  }));

  // ──────────────── /move <from> <to> ────────────────
  bot.command('move', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const args   = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.replyWithHTML(`<blockquote>${t(l,'move_usage')}</blockquote>`);
    const from = parseInt(args[0]) - 1;
    const to   = parseInt(args[1]) - 1;
    const state = queue.get(chatId);
    if (from < 0 || to < 0 || from >= state.tracks.length || to >= state.tracks.length)
      return ctx.replyWithHTML(`<blockquote>${t(l,'move_invalid')}</blockquote>`);
    const title = state.tracks[from].title;
    if (!queue.move(chatId, from, to))
      return ctx.replyWithHTML(`<blockquote>${t(l,'move_invalid')}</blockquote>`);
    await ctx.replyWithHTML(`<blockquote>${t(l,'moved',title,to+1)}</blockquote>`);
  }));

  // ──────────────── /skipto <n> ────────────────
  bot.command('skipto', safe(async (ctx) => {
    if (!['group','supergroup','channel'].includes(ctx.chat.type)) return;
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const n      = parseInt(ctx.message.text.split(' ')[1]);
    if (!n) return ctx.replyWithHTML(`<blockquote>${t(l,'skipto_usage')}</blockquote>`);
    const state = queue.get(chatId);
    if (!state.isPlaying) return ctx.replyWithHTML(`<blockquote>${t(l,'no_playing')}</blockquote>`);
    const idx   = n - 1;
    if (idx < 0 || idx >= state.tracks.length)
      return ctx.replyWithHTML(`<blockquote>${t(l,'skipto_invalid')}</blockquote>`);
    const track = queue.skipTo(chatId, idx);
    if (!track) return ctx.replyWithHTML(`<blockquote>${t(l,'skipto_invalid')}</blockquote>`);
    stopStream(chatId);
    await ctx.replyWithHTML(`<blockquote>${t(l,'skipped_to',track.title)}</blockquote>`);
    state.isPlaying = true; state.isPaused = false; state.startedAt = Date.now();
    await playTrack(ctx, chatId, track, state).catch(console.error);
  }));

  // ──────────────── /lyrics [query] ────────────────
  bot.command('lyrics', safe(async (ctx) => {
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const query  = ctx.message.text.split(' ').slice(1).join(' ').trim();
    const searchQuery = query || queue.current(chatId)?.title;
    if (!searchQuery) return ctx.replyWithHTML(`<blockquote>${t(l,'lyrics_usage')}</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>${t(l,'lyrics_searching')}</blockquote>`);
    try {
      const result = await getLyrics(searchQuery);
      if (!result) {
        return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'lyrics_not_found')}</blockquote>`, { parse_mode:'HTML' }
        );
      }
      const MAX_LEN = 3500;
      let lyricsText = result.lyrics.trim();
      const truncated = lyricsText.length > MAX_LEN;
      if (truncated) lyricsText = lyricsText.slice(0, MAX_LEN) + t(l,'lyrics_too_long');

      const header = t(l,'lyrics_header', result.title || searchQuery, result.artist || 'Unknown');
      const footer = t(l,'lyrics_footer');
      const text   = `<blockquote>${header}${lyricsText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}${footer}</blockquote>`;

      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null, text, { parse_mode:'HTML' });
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>❌ ${e.message}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────────── /history ────────────────
  bot.command('history', safe(async (ctx) => {
    const chatId  = ctx.chat.id;
    const l       = lang(ctx);
    const history = queue.getHistory(chatId);
    await ctx.replyWithHTML(buildHistoryText(history, l));
  }));

  // ──────────────── /download ────────────────
  bot.command('download', safe(async (ctx) => {
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const input  = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!input) return ctx.replyWithHTML(`<blockquote>${t(l,'download_usage')}</blockquote>`);

    const loadMsg = await ctx.replyWithHTML(`<blockquote>${t(l,'downloading')}</blockquote>`);
    try {
      let url = input;
      if (!isYouTubeUrl(input)) {
        await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'download_searching')}</blockquote>`, { parse_mode:'HTML' }
        );
        const results = await searchYouTube(input, 1);
        if (!results.length) {
          return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
            `<blockquote>${t(l,'not_found')}</blockquote>`, { parse_mode:'HTML' }
          );
        }
        url = results[0].url;
      }
      const info = await getVideoInfo(url);
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>${t(l,'downloading_file',info?.title||'Lagu')}</blockquote>`, { parse_mode:'HTML' }
      );
      const filePath = await downloadAudio(url);
      const fileSize = require('fs').statSync(filePath).size;
      if (fileSize > 50 * 1024 * 1024) {
        require('fs').unlinkSync(filePath);
        return ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
          `<blockquote>${t(l,'file_too_large')}</blockquote>`, { parse_mode:'HTML' }
        );
      }
      await ctx.telegram.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
      await ctx.replyWithAudio(
        { source: filePath },
        {
          title:     info?.title || 'Audio',
          performer: info?.uploader || 'Unknown',
          duration:  info?.duration,
          caption:   `<blockquote>🎵 <b>${info?.title}</b>\n👤 ${info?.uploader}\n⏱ ${info?.durationFmt}</blockquote>`,
          parse_mode: 'HTML',
        }
      );
      require('fs').unlinkSync(filePath);
    } catch (e) {
      await ctx.telegram.editMessageText(chatId, loadMsg.message_id, null,
        `<blockquote>${t(l,'download_failed',e.message)}</blockquote>`, { parse_mode:'HTML' }
      ).catch(() => {});
    }
  }));

  // ──────────────── /playlist ────────────────
  bot.command('playlist', safe(async (ctx) => {
    const chatId = ctx.chat.id;
    const l      = lang(ctx);
    const args   = ctx.message.text.split(' ').slice(1);
    const sub    = args[0]?.toLowerCase();
    const name   = args.slice(1).join(' ').trim();

    if (!sub) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_usage')}</blockquote>`);

    if (sub === 'save') {
      if (!name) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_usage')}</blockquote>`);
      const state = queue.get(chatId);
      if (!state.tracks.length) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_no_queue')}</blockquote>`);
      savePlaylist(chatId, name, state.tracks);
      return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_saved',name,state.tracks.length)}</blockquote>`);
    }

    if (sub === 'load') {
      if (!name) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_usage')}</blockquote>`);
      const pl = loadPlaylist(chatId, name);
      if (!pl) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_not_found',name)}</blockquote>`);
      for (const track of pl.tracks) queue.add(chatId, track);
      return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_loaded',pl.name,pl.count)}</blockquote>`);
    }

    if (sub === 'delete') {
      if (!name) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_usage')}</blockquote>`);
      if (!deletePlaylist(chatId, name)) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_not_found',name)}</blockquote>`);
      return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_deleted',name)}</blockquote>`);
    }

    if (sub === 'list') {
      const pls = listPlaylists(chatId);
      if (!pls.length) return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_empty')}</blockquote>`);
      let text = `<blockquote>${t(l,'playlist_list_hdr')}`;
      pls.forEach((p, i) => {
        const date = new Date(p.savedAt).toLocaleDateString();
        text += `${i+1}. <b>${p.name}</b> — ${p.count} lagu (${date})\n`;
      });
      text += `</blockquote>`;
      return ctx.replyWithHTML(text);
    }

    return ctx.replyWithHTML(`<blockquote>${t(l,'playlist_usage')}</blockquote>`);
  }));

  // ──────────────── /musichelp ────────────────
  bot.command('musichelp', safe(async (ctx) => {
    const l = lang(ctx);
    await ctx.replyWithHTML(t(l,'help_text'));
  }));

  // ─────────────────────────────────────────
  // CALLBACK QUERY HANDLER
  // ─────────────────────────────────────────

  bot.on('callback_query', async (ctx) => {
    const data   = ctx.callbackQuery.data;
    if (!data?.startsWith('music_')) return; // ignore non-music callbacks

    const chatId = ctx.chat?.id || ctx.callbackQuery.message?.chat?.id;
    const l      = chatId ? getLang(chatId) : 'id';
    const state  = chatId ? queue.get(chatId) : null;

    // ─── Safe edit for photo/text messages in callbacks ───
    const safeEditCb = async (text, extra = {}) => {
      const msg = ctx.callbackQuery?.message;
      const isPhoto = !!(msg?.photo || msg?.animation || msg?.video);
      const wrapped = text.startsWith('<blockquote>') ? text : `<blockquote>${text}</blockquote>`;
      try {
        if (isPhoto) await ctx.editMessageCaption(wrapped, { parse_mode:'HTML', ...extra });
        else await ctx.editMessageText(wrapped, { parse_mode:'HTML', ...extra });
      } catch(e) {
        if (!e.message?.includes('not modified') && !e.message?.includes('no text')) {
          try { await ctx.telegram.sendMessage(msg?.chat?.id || ctx.chat?.id, wrapped, { parse_mode:'HTML', ...extra }); } catch {}
        }
      }
    };

    // ── Cancel search ──
    if (data.startsWith('music_cancel_')) {
      await ctx.answerCbQuery(t(l,'cancelled'));
      await ctx.deleteMessage().catch(() => {});
      return;
    }

    // ── Pick search result ──
    if (data.startsWith('music_pick_')) {
      const parts  = data.split('_');
      const cid    = parseInt(parts[2]);
      const idx    = parseInt(parts[3]);
      const l2     = getLang(cid);
      const results= searchCache.get(String(cid));
      if (!results || !results[idx]) return ctx.answerCbQuery('❌');

      const track   = results[idx];
      track.requestedBy = ctx.from.id;
      await ctx.answerCbQuery(`✅ ${track.title.slice(0,30)}`);
      await ctx.deleteMessage().catch(() => {});

      // Check + play
      const check = await preCheck(ctx, cid);
      if (!check.ok) {
        return ctx.telegram.sendMessage(cid, `<blockquote>${check.reason}</blockquote>`, { parse_mode:'HTML' });
      }
      queue.add(cid, track);
      const st = queue.get(cid);
      if (st.isPlaying) {
        return ctx.telegram.sendMessage(cid,
          `<blockquote>${t(l2,'added_to_queue',track.title,track.uploader,track.durationFmt,st.tracks.length)}</blockquote>`,
          { parse_mode:'HTML' }
        );
      }
      st.currentIndex = st.tracks.length - 1;
      await playTrack(ctx, cid, track, st).catch(console.error);
      return;
    }

    // ── Pause/Resume toggle ──
    if (data.startsWith('music_pause_')) {
      const cid   = parseInt(data.split('_')[2]);
      const st    = queue.get(cid);
      if (!st.isPlaying) return ctx.answerCbQuery('❌', { show_alert:true });
      if (st.isPaused) {
        await resumeStream(cid); st.isPaused = false; cancelLeaveTimer(cid);
        await ctx.answerCbQuery(t(l,'resumed').replace(/<[^>]+>/g,''));
      } else {
        await pauseStream(cid); st.isPaused = true;
        await ctx.answerCbQuery(t(l,'paused').replace(/<[^>]+>/g,''));
      }
      await updatePlayerUI(ctx, cid, st);
      return;
    }

    // ── Skip ──
    if (data.startsWith('music_skip_')) {
      const cid = parseInt(data.split('_')[2]);
      const st  = queue.get(cid);
      if (!st.isPlaying) return ctx.answerCbQuery('❌', { show_alert:true });
      const next = queue.next(cid);
      if (!next) {
        stopStream(cid); stopProgressInterval(cid); st.isPlaying = false;
        onQueueEmpty(ctx, cid);
        await ctx.answerCbQuery(t(l,'no_next'));
        await updatePlayerUI(ctx, cid, st);
        return;
      }
      stopStream(cid);
      await ctx.answerCbQuery(`⏭ ${next.title.slice(0,20)}`);
      st.isPlaying = true; st.isPaused = false; st.startedAt = Date.now();
      await playTrack(ctx, cid, next, st).catch(console.error);
      return;
    }

    // ── Prev ──
    if (data.startsWith('music_prev_')) {
      const cid  = parseInt(data.split('_')[2]);
      const st   = queue.get(cid);
      const prev = queue.prev(cid);
      if (!prev) return ctx.answerCbQuery(t(l,'no_prev'), { show_alert:true });
      stopStream(cid);
      await ctx.answerCbQuery(`⏮ ${prev.title.slice(0,20)}`);
      st.isPlaying = true; st.isPaused = false; st.startedAt = Date.now();
      await playTrack(ctx, cid, prev, st).catch(console.error);
      return;
    }

    // ── Stop ──
    if (data.startsWith('music_stop_')) {
      const cid = parseInt(data.split('_')[2]);
      stopStream(cid); stopProgressInterval(cid); queue.clear(cid);
      onQueueEmpty(ctx, cid);
      await ctx.answerCbQuery('⏹');
      await safeEdit(ctx, t(getLang(cid),'stopped'));
      return;
    }

    // ── Queue page ──
    if (data.startsWith('music_queue_')) {
      const parts = data.split('_');
      const cid   = parseInt(parts[2]);
      const page  = parseInt(parts[3]) || 0;
      const st    = queue.get(cid);
      const l2    = getLang(cid);
      const pages = Math.ceil(st.tracks.length / 10) || 1;
      await ctx.answerCbQuery();
      await ctx.editMessageText(buildQueueText(st, page, l2), {
        parse_mode:'HTML', ...buildQueueButtons(cid, page, pages, l2)
      });
      return;
    }

    // ── Player view ──
    if (data.startsWith('music_player_')) {
      const cid   = parseInt(data.split('_')[2]);
      const st    = queue.get(cid);
      const track = queue.current(cid);
      const l2    = getLang(cid);
      if (!track) return ctx.answerCbQuery('❌');
      await ctx.answerCbQuery();
      await updatePlayer(ctx.telegram, cid, ctx.callbackQuery.message.message_id, st.isPhoto, track, st, getElapsed(cid), l2);
      return;
    }

    // ── Loop song ──
    if (data.startsWith('music_loop_')) {
      const cid = parseInt(data.split('_')[2]);
      const st  = queue.get(cid);
      st.loop   = !st.loop;
      if (st.loop) st.loopQueue = false;
      await ctx.answerCbQuery(st.loop ? '🔂 ON' : '🔂 OFF');
      await updatePlayerUI(ctx, cid, st);
      return;
    }

    // ── Loop queue ──
    if (data.startsWith('music_loopq_')) {
      const cid    = parseInt(data.split('_')[2]);
      const st     = queue.get(cid);
      st.loopQueue = !st.loopQueue;
      if (st.loopQueue) st.loop = false;
      await ctx.answerCbQuery(st.loopQueue ? '🔁 ON' : '🔁 OFF');
      await updatePlayerUI(ctx, cid, st);
      return;
    }

    // ── Shuffle ──
    if (data.startsWith('music_shuffle_')) {
      const cid = parseInt(data.split('_')[2]);
      const st  = queue.get(cid);
      if (!queue.shuffle(cid)) return ctx.answerCbQuery(t(getLang(cid),'no_queue_to_shuffle'), { show_alert:true });
      await ctx.answerCbQuery('🔀');
      return;
    }

    // ── Volume up ──
    if (data.startsWith('music_volup_')) {
      const cid = parseInt(data.split('_')[2]);
      const st  = queue.get(cid);
      const vol = Math.min((st.volume || getVolume(cid)) + 10, 200);
      setVolume(cid, vol); st.volume = vol;
      await ctx.answerCbQuery(`🔊 ${vol}%`);
      await updatePlayerUI(ctx, cid, st);
      return;
    }

    // ── Volume down ──
    if (data.startsWith('music_voldn_')) {
      const cid = parseInt(data.split('_')[2]);
      const st  = queue.get(cid);
      const vol = Math.max((st.volume || getVolume(cid)) - 10, 0);
      setVolume(cid, vol); st.volume = vol;
      await ctx.answerCbQuery(`🔉 ${vol}%`);
      await updatePlayerUI(ctx, cid, st);
      return;
    }

    // ── Clear queue ──
    if (data.startsWith('music_clear_')) {
      const cid = parseInt(data.split('_')[2]);
      stopStream(cid); stopProgressInterval(cid); queue.clear(cid);
      onQueueEmpty(ctx, cid);
      await ctx.answerCbQuery('🗑');
      await ctx.editMessageText(
        `<blockquote>${t(getLang(cid),'queue_cleared')}</blockquote>`,
        { parse_mode:'HTML' }
      );
      return;
    }

    // ── Save to playlist from player button ──
    if (data.startsWith('music_savepl_')) {
      const cid   = parseInt(data.replace('music_savepl_', ''));
      const l     = getLang(cid);
      const track = queue.current(cid);
      if (!track) return ctx.answerCbQuery('❌ Tidak ada lagu', { show_alert: true });

      // Tampilkan daftar playlist + opsi buat baru
      const { listPlaylists } = require('./playlist');
      const pls = listPlaylists(cid);
      await ctx.answerCbQuery();

      let text = `<blockquote>📂 <b>Simpan ke Playlist</b>
`;
      text += `━━━━━━━━━━━━━━━━━━━━
`;
      text += `🎵 <b>${track.title.slice(0,40)}</b>
`;
      text += `━━━━━━━━━━━━━━━━━━━━

`;
      text += pls.length
        ? `Pilih playlist tujuan atau buat baru:`
        : `Belum ada playlist. Buat playlist baru:`;
      text += `</blockquote>`;

      const rows = [
        ...pls.map(p => [{ text: `📂 ${p.name} (${p.count} lagu)`, callback_data: `music_addtopl_${cid}_${encodeURIComponent(p.name)}`, style: 'primary' }]),
        [{ text: '✨ Buat Playlist Baru', callback_data: `music_newpl_${cid}`, style: 'success' }],
        [{ text: '❌ Batal', callback_data: `music_cancel_${cid}`, style: 'danger' }],
      ];
      await ctx.replyWithHTML(text, { reply_markup: { inline_keyboard: rows } });
      return;
    }

    // ── Add to existing playlist ──
    if (data.startsWith('music_addtopl_')) {
      const afterPrefix = data.replace('music_addtopl_', '');
      const firstUnderscore = afterPrefix.indexOf('_');
      const cid    = parseInt(afterPrefix.slice(0, firstUnderscore));
      const name   = decodeURIComponent(afterPrefix.slice(firstUnderscore + 1));
      const l      = getLang(cid);
      const track  = queue.current(cid);
      if (!track) return ctx.answerCbQuery('❌');

      const { loadPlaylist, savePlaylist } = require('./playlist');
      const pl = loadPlaylist(cid, name);
      if (!pl) return ctx.answerCbQuery(`❌ Playlist tidak ditemukan`, { show_alert: true });

      // Cek duplikat
      const isDup = pl.tracks.some(t => t.videoId === track.videoId || t.url === track.url);
      if (isDup) {
        await ctx.answerCbQuery(`⚠️ Lagu sudah ada di playlist ini`, { show_alert: true });
        await ctx.deleteMessage().catch(() => {});
        return;
      }

      pl.tracks.push(track);
      savePlaylist(cid, name, pl.tracks);
      await ctx.answerCbQuery(`✅ Ditambahkan ke "${name}"`);
      await ctx.editMessageText(
        `<blockquote>✅ <b>Berhasil disimpan!</b>

🎵 ${track.title.slice(0,40)}
📂 Playlist: <b>${name}</b>
📊 Total: ${pl.tracks.length} lagu</blockquote>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Tutup', callback_data: `music_cancel_${cid}`, style: 'danger' }]] } }
      );
      return;
    }

    // ── Create new playlist & add current song ──
    if (data.startsWith('music_newpl_')) {
      const cid   = parseInt(data.replace('music_newpl_', ''));
      const track = queue.current(cid);
      if (!track) return ctx.answerCbQuery('❌');
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `<blockquote>✨ <b>Buat Playlist Baru</b>

🎵 Lagu: <b>${track.title.slice(0,40)}</b>

Ketik nama playlist baru:
(contoh: <code>Favorit</code> atau <code>Santai Malam</code>)

/cancel untuk batal</blockquote>`,
        { parse_mode: 'HTML' }
      );
      // Store pending state
      if (!global._pendingNewPlaylist) global._pendingNewPlaylist = new Map();
      global._pendingNewPlaylist.set(String(ctx.from.id), { chatId: cid, track, msgId: ctx.callbackQuery.message.message_id });
      return;
    }

    // ── Save to playlist button ──

    // ── Lyrics from button ──
    if (data.startsWith('music_lyrics_')) {
      const cid   = parseInt(data.split('_')[2]);
      const l2    = getLang(cid);
      const track = queue.current(cid);
      if (!track) return ctx.answerCbQuery('❌');
      await ctx.answerCbQuery('🎤');
      const result = await getLyrics(track.title).catch(() => null);
      if (!result) {
        return ctx.telegram.sendMessage(cid, `<blockquote>${t(l2,'lyrics_not_found')}</blockquote>`, { parse_mode:'HTML' });
      }
      const MAX_LEN = 3500;
      let lyricsText = result.lyrics.trim();
      if (lyricsText.length > MAX_LEN) lyricsText = lyricsText.slice(0, MAX_LEN) + t(l2,'lyrics_too_long');
      const header = t(l2,'lyrics_header', result.title || track.title, result.artist || track.uploader);
      await ctx.telegram.sendMessage(cid,
        `<blockquote>${header}${lyricsText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}${t(l2,'lyrics_footer')}</blockquote>`,
        { parse_mode:'HTML' }
      );
      return;
    }
  });
  // ── Text handler: new playlist name ──────
  bot.on('text', async (ctx, next) => {
    if (!global._pendingNewPlaylist) return next();
    const userId  = String(ctx.from.id);
    const pending = global._pendingNewPlaylist.get(userId);
    if (!pending) return next();

    const chatId = pending.chatId;
    // Only handle if this is a group message in the right chat OR private
    if (ctx.chat.id !== chatId && ctx.chat.type !== 'private') return next();

    const name = ctx.message.text.trim();
    if (!name || name.startsWith('/')) return next();

    global._pendingNewPlaylist.delete(userId);

    const { savePlaylist } = require('./playlist');
    savePlaylist(chatId, name, [pending.track]);

    // Delete the "ketik nama" message
    try { await ctx.telegram.deleteMessage(
      pending.chatId || ctx.chat.id,
      pending.msgId
    ); } catch {}
    // Delete user's typed message
    try { await ctx.deleteMessage(); } catch {}

    await ctx.replyWithHTML(
      `<blockquote>✅ <b>Playlist baru dibuat!</b>

📂 Nama: <b>${name}</b>
🎵 Lagu pertama: ${pending.track.title.slice(0,40)}

Gunakan /playlist list untuk melihat semua playlist.</blockquote>`
    );
    return;
  });


};
