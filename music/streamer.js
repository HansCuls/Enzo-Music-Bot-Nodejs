// ==========================================
// FILE: music/streamer.js
// Audio streaming ke Telegram Voice Chat
// Source: owner @arnabxd/ntgcalls-napi
// mediaSource: 2 = SHELL mode
// ==========================================

const { Api } = require('teleproto');
const { resolveChannelEntity } = require('./tgutils');
const fs      = require('fs');
const path    = require('path');
const { getCacheDir } = require('./cache');

let NtgCalls     = null;
let ntgAvailable = false;

try {
  NtgCalls     = require('@arnabxd/ntgcalls-napi').NtgCalls;
  ntgAvailable = true;
  console.log('[streamer] ✅ ntgcalls-napi loaded');
} catch (e) {
  console.warn('[streamer] ⚠️ ntgcalls-napi tidak tersedia:', e.message);
}

// Check ffmpeg
try {
  const { execSync } = require('child_process');
  const ver = execSync('ffmpeg -version 2>&1').toString().split('\n')[0];
  console.log(`[streamer] ✅ ffmpeg: ${ver.split(' ')[2] || 'OK'}`);
} catch {
  console.error('[streamer] ❌ ffmpeg tidak ditemukan! Install: apt install -y ffmpeg');
}

const sessions = new Map();

function getSession(chatId)    { return sessions.get(String(chatId)) || null; }
function deleteSession(chatId) {
  const s = sessions.get(String(chatId));
  if (s) { try { s.ntg?.stop(Number(chatId)); } catch {} }
  sessions.delete(String(chatId));
}

// ─── Cache download ────────────────────────
async function downloadToCache(audioUrl, videoId) {
  const cacheDir = getCacheDir();
  if (videoId) {
    const cached = path.join(cacheDir, `${videoId}.mp3`);
    if (fs.existsSync(cached)) {
      console.log(`[streamer] 💾 Cache hit: ${videoId}`);
      return cached;
    }
  }
  const filename = videoId ? `${videoId}.mp3` : `audio_${Date.now()}.mp3`;
  const filePath = path.join(cacheDir, filename);
  console.log(`[streamer] ⬇️ Downloading audio: ${filename}`);
  const res = await fetch(audioUrl, {
    signal: AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  console.log(`[streamer] ✅ Downloaded: ${filename} (${(buffer.length/1024/1024).toFixed(1)}MB)`);
  return filePath;
}

// ─── Build ffmpeg commands ─────────────────
// mediaSource: 2 = SHELL mode, output ke stdout dengan "-"
function buildAudioCmd(input, volume = 100, seekSeconds = 0) {
  const vol     = Math.max(0, Math.min(200, volume)) / 100;
  const seekArg = seekSeconds > 0 ? `-ss ${seekSeconds}` : '';
  const volArg  = vol !== 1.0 ? `-af "volume=${vol}"` : '';
  // -vn = no video, output to stdout with "-"
  return `ffmpeg ${seekArg} -i "${input}" -vn ${volArg} -f s16le -ar 48000 -ac 1 -`
    .replace(/\s+/g, ' ').trim();
}

// ─── Join Voice Chat (audio only) ─────────

async function joinVoiceChat(client, chatId, offerSdp, videoEnabled = false) {
  const entity = await resolveChannelEntity(client, chatId);
  const full   = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
  if (!full.fullChat?.call) throw new Error('Voice Chat tidak aktif.');

  let joinResult = null, lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      joinResult = await client.invoke(new Api.phone.JoinGroupCall({
        call:         full.fullChat.call,
        params:       new Api.DataJSON({ data: offerSdp }),
        muted:        false,
        videoStopped: !videoEnabled,
        joinAs:       new Api.InputPeerSelf(),
      }));
      break;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!joinResult) throw new Error(`Gagal join VC: ${lastErr?.message}`);

  let answerSdp = null;
  for (const u of joinResult.updates || []) {
    if (u?.params?.data) { answerSdp = u.params.data; break; }
  }
  if (!answerSdp) throw new Error('Gagal mendapatkan Answer SDP.');
  return answerSdp;
}

// ─── START STREAM (audio) ─────────────────
async function startStream(client, chatId, audioUrl, callbacks = {}, volume = 100, videoId = null) {
  if (!ntgAvailable) throw new Error('ntgcalls-napi tidak tersedia.');

  stopStream(chatId);

  // Download ke cache di background
  downloadToCache(audioUrl, videoId).catch(() => {});

  try {
    const ntg       = new NtgCalls();
    const offerSdp  = await ntg.create(Number(chatId));
    const answerSdp = await joinVoiceChat(client, chatId, offerSdp, false);

    await ntg.connect(Number(chatId), answerSdp, false);

    // mediaSource: 2 = SHELL, output "-" bukan "pipe:1"
    await ntg.set_stream_sources(Number(chatId), 0, {
      microphone: {
        mediaSource:  2,
        input:        buildAudioCmd(audioUrl, volume, 0),
        sampleRate:   48000,
        channelCount: 1,
        keepOpen:     false,
      },
    });

    ntg.on('stream-end', (cid, streamType) => {
      if (Number(cid) !== Number(chatId)) return;
      if (streamType !== undefined && streamType !== 0) return; // 0 = audio
      sessions.delete(String(chatId));
      if (callbacks.onFinish) callbacks.onFinish();
    });

    sessions.set(String(chatId), {
      ntg, audioUrl, videoId,
      startedAt: Date.now(),
      paused:    false,
      volume,
    });

    return true;
  } catch (e) {
    deleteSession(chatId);
    const { writeLog } = require('./error_handler');
    writeLog(`[streamer.startStream] chat:${chatId} | ${e.message}\n${e.stack?.split('\n').slice(0,4).join('\n')}`);
    throw e;
  }
}

// ─── SEEK ─────────────────────────────────
async function seekStream(client, chatId, seconds, callbacks = {}) {
  const s = getSession(chatId);
  if (!s) throw new Error('Tidak ada stream aktif.');
  try { s.ntg?.stop(Number(chatId)); } catch {}

  const ntg       = new NtgCalls();
  const offerSdp  = await ntg.create(Number(chatId));
  const answerSdp = await joinVoiceChat(client, chatId, offerSdp, false);
  await ntg.connect(Number(chatId), answerSdp, false);
  await ntg.set_stream_sources(Number(chatId), 0, {
    microphone: {
      mediaSource:  2,
      input:        buildAudioCmd(s.audioUrl, s.volume, seconds),
      sampleRate:   48000,
      channelCount: 1,
      keepOpen:     false,
    },
  });
  ntg.on('stream-end', (cid, streamType) => {
    if (Number(cid) !== Number(chatId)) return;
    if (streamType !== undefined && streamType !== 0) return;
    sessions.delete(String(chatId));
    if (callbacks.onFinish) callbacks.onFinish();
  });
  s.ntg = ntg; s.startedAt = Date.now() - (seconds * 1000); s.paused = false;
  return true;
}

function stopStream(chatId)  { deleteSession(chatId); }

async function pauseStream(chatId) {
  const s = getSession(chatId);
  if (!s || s.paused) return false;
  try { await s.ntg.pause(Number(chatId)); s.paused = true; return true; } catch { return false; }
}

async function resumeStream(chatId) {
  const s = getSession(chatId);
  if (!s || !s.paused) return false;
  try { await s.ntg.resume(Number(chatId)); s.paused = false; return true; } catch { return false; }
}

function isStreaming(chatId) { return sessions.has(String(chatId)); }
function getElapsed(chatId)  { const s = getSession(chatId); return s ? Date.now() - s.startedAt : 0; }

module.exports = {
  startStream, stopStream, pauseStream, resumeStream,
  seekStream, joinVoiceChat, isStreaming, getElapsed,
  buildAudioCmd,
  get available() { return ntgAvailable; },
};
