// ==========================================
// FILE: music/ytdl.js
// Primary  : @vreden/youtube_scraper
// Backup 1 : yt-dlp (auto-install via pip, pakai JS runtime Node buat YouTube/EJS)
// Backup 2 : RapidAPI youtube-mp310
// ==========================================

const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { spawn, execSync } = require('child_process');
const { getCookiesArgs } = require('./browser_session');

const RAPIDAPI_KEY  = global.RAPIDAPI_KEY  || '';
const RAPIDAPI_HOST = 'youtube-mp310.p.rapidapi.com';

// ─── Helpers ──────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return '??:??';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatViews(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function sanitizeBtn(str, maxLen = 40) {
  if (!str) return 'Unknown';
  return str.replace(/[^\x20-\x7E\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]/g,'')
    .replace(/\s+/g,' ').trim().slice(0, maxLen) || 'Unknown';
}

// Regex YouTube yang lebih lengkap -- dukung semua subdomain (www/m/music), semua tipe
// path (watch/shorts/embed/v/live), youtu.be, domain youtube-nocookie.com, v= di posisi
// mana pun di query string, dan case-insensitive di bagian domain (video ID sendiri
// tetap dicocokkan persis, karena ID YouTube memang case-sensitive).
function isYouTubeUrl(str) {
  return /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube(-nocookie)?\.com\/(watch\?([^#]*&)?v=|shorts\/|embed\/|v\/|live\/)|youtu\.be\/)[\w-]{11}/i.test(str);
}

function extractVideoId(url) {
  const m = url.match(/(?:[?&]v=|\/(?:shorts|embed|v|live)\/|youtu\.be\/)([\w-]{11})(?![\w-])/i);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────
// YT-DLP
// ─────────────────────────────────────────

let _ytdlpCmd = null; // null = belum di-cek, false = gak tersedia, object = { bin, baseArgs }

// Coba jalanin "<bin> <baseArgs> --version" buat mastiin command ini valid & bisa dieksekusi.
function tryYtdlpCmd(bin, baseArgs = []) {
  try {
    execSync(`${bin} ${[...baseArgs, '--version'].join(' ')}`.trim(), { stdio: 'ignore', timeout: 5000 });
    return { bin, baseArgs };
  } catch { return null; }
}

function legacyAutoDownloadPath() {
  // Lokasi lama tempat versi sebelumnya nyimpen hasil auto-download binary dari GitHub.
  // Gak di-download lagi sekarang, tapi tetep dicek buat kompatibilitas kalau filenya
  // udah kadung ada dari instalasi sebelum update ini.
  return path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

// Cari yt-dlp yang udah ke-install: command langsung di PATH, lokasi umum hasil "pip
// install" (--user maupun sistem), lokasi legacy binary, atau lewat "python3 -m yt_dlp"
// (selalu jalan begitu paketnya ke-install lewat pip, gak peduli PATH ke-setting bener
// apa nggak -- makanya ini dicek paling akhir sebagai jaring pengaman).
function getYtdlpCmd() {
  if (_ytdlpCmd !== null) return _ytdlpCmd;

  const home = os.homedir();
  let found =
    tryYtdlpCmd('yt-dlp') ||
    tryYtdlpCmd(path.join(home, '.local', 'bin', 'yt-dlp')) ||
    tryYtdlpCmd('/usr/local/bin/yt-dlp') ||
    tryYtdlpCmd('/usr/bin/yt-dlp') ||
    tryYtdlpCmd(legacyAutoDownloadPath());

  if (!found) {
    for (const py of ['python3', 'python']) {
      found = tryYtdlpCmd(py, ['-m', 'yt_dlp']);
      if (found) break;
    }
  }

  _ytdlpCmd = found || false;
  return _ytdlpCmd;
}

// String buat ditampilin di log/status aja -- BUKAN buat di-spawn langsung (pakai
// getYtdlpCmd() buat itu, soalnya command "python3 -m yt_dlp" perlu tetap 2 argv terpisah).
function getYtdlpPath() {
  const cmd = getYtdlpCmd();
  return cmd ? [cmd.bin, ...cmd.baseArgs].join(' ') : false;
}

// Cari pip yang tersedia di sistem: pip3 > pip > python3 -m pip > python -m pip.
function findPip() {
  const candidates = [
    { bin: 'pip3', args: [] },
    { bin: 'pip', args: [] },
    { bin: 'python3', args: ['-m', 'pip'] },
    { bin: 'python', args: ['-m', 'pip'] },
  ];
  for (const c of candidates) {
    try {
      execSync(`${c.bin} ${[...c.args, '--version'].join(' ')}`, { stdio: 'ignore', timeout: 5000 });
      return c;
    } catch {}
  }
  return null;
}

// Kalau yt-dlp gak ketemu di sistem, install lewat PIP -- bukan download binary standalone
// dari GitHub releases. Dua alasan: (1) paket pip dengan extra "[default]" otomatis bawa
// "yt-dlp-ejs", komponen JS-challenge-solver yang sekarang WAJIB dipunya yt-dlp buat nembus
// proteksi YouTube -- tanpa ini ketersediaan format kian terbatas & berujung ke error
// "Requested format is not available" walau video-nya normal & bisa diputar di browser
// biasa; (2) "pip install -U" jauh lebih gampang buat auto-update ketimbang ngulang proses
// download+chmod binary tiap kali yt-dlp rilis versi baru, dan yt-dlp WAJIB sering
// di-update karena YouTube sering berubah. --break-system-packages dibutuhin di image
// Debian/Ubuntu modern (PEP 668) yang nge-block "pip install" ke Python sistem;
// --user dicoba bareng biar gak butuh akses root (container Pterodactyl biasa jalan
// sebagai user non-root). Beberapa kombinasi flag dicoba berurutan buat jaga-jaga kalau
// versi pip di server gak kenal salah satu flag.
async function ensureYtdlp() {
  if (getYtdlpCmd()) return getYtdlpCmd();

  const pip = findPip();
  if (!pip) {
    console.warn('[ytdl] ⚠️  pip / python3 tidak ditemukan di container ini.');
    console.warn('[ytdl] ⚠️  Install Python3 + pip dulu (lewat startup command / image egg-nya), lalu restart server.');
    console.warn('[ytdl] ⚠️  Sementara bot tetap jalan pakai vreden + RapidAPI sebagai fallback.');
    _ytdlpCmd = false;
    return false;
  }

  console.log(`[ytdl] ⬇️  yt-dlp tidak ditemukan, install via ${pip.bin}...`);
  const pkg = 'yt-dlp[default]'; // extra "default" = otomatis bawa yt-dlp-ejs (JS challenge solver)
  const flagSets = [
    ['--upgrade', '--user', '--break-system-packages'],
    ['--upgrade', '--user'],
    ['--upgrade', '--break-system-packages'],
    ['--upgrade'],
  ];

  let lastErr = '';
  for (const flags of flagSets) {
    try {
      execSync(`${pip.bin} ${[...pip.args, 'install', ...flags, pkg].join(' ')}`, { stdio: 'pipe', timeout: 120000 });
      _ytdlpCmd = null; // reset cache biar lokasi hasil install baru ke-scan ulang
      const cmd = getYtdlpCmd();
      if (cmd) {
        console.log(`[ytdl] ✅ yt-dlp berhasil di-install via ${pip.bin}`);
        return cmd;
      }
    } catch (e) {
      lastErr = (e.stderr || e.message || '').toString().trim().split('\n').filter(Boolean).pop() || '';
    }
  }

  console.warn('[ytdl] ⚠️  Auto-install yt-dlp via pip gagal.' + (lastErr ? ` (${lastErr})` : ''));
  console.warn(`[ytdl] ⚠️  Coba manual di server: ${pip.bin} install --upgrade --user --break-system-packages "yt-dlp[default]"`);
  _ytdlpCmd = false;
  return false;
}

// Player client fallback biar gak ke-block "Sign in to confirm you're not a bot" dari
// YouTube TANPA perlu cookies. Sengaja GAK include 'android': yt-dlp sendiri udah nurunin
// prioritasnya di beberapa versi terakhir karena formatnya sering rusak, jadi kalau cuma
// andalin 1 client doang dan itu 'android', gampang mentok lagi begitu YouTube berubah.
// ios+mweb itu kombinasi default resmi yt-dlp waktu gak login; tv & web_safari ditambahin
// sebagai cadangan ekstra. yt-dlp otomatis pakai client mana pun yang berhasil dari daftar
// ini, jadi kalau satu diblokir yang lain masih bisa jalan.
//
// getCookiesArgs() (dari browser_session.js) nambahin --cookies-from-browser KALAU ada
// sesi browser tersimpan — ini yang dibutuhin buat nembus video age-restricted (player
// client apa pun gak akan bisa nembus itu tanpa cookies asli). Kalau belum di-setup,
// getCookiesArgs() balikin array kosong dan semuanya jalan seperti biasa tanpa cookies.
const YT_PLAYER_CLIENTS = ['--extractor-args', 'youtube:player_client=ios,mweb,tv,web_safari'];

// Sejak yt-dlp 2025.11.12, YouTube WAJIB pakai JS runtime eksternal (EJS) buat nyelesain
// challenge JavaScript-nya -- tanpa ini, ketersediaan format kian terbatas seiring waktu.
// INI PENYEBAB UTAMA error "Requested format is not available" yang muncul di log walau
// video-nya normal & bisa diputar di browser biasa. Daripada nyuruh install Deno terpisah
// (runtime default yt-dlp), kita manfaatin Node.js yang PASTI ada di container ini (bot
// ini sendiri jalan pakai Node, minimal versi 20). --remote-components ejs:github adalah
// jaring pengaman kalau script solver-nya belum ke-bundle (harusnya udah otomatis lewat
// "pip install yt-dlp[default]" di atas).
const YT_JS_RUNTIME = ['--js-runtimes', 'node', '--remote-components', 'ejs:github'];

function spawnYtdlp(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const cmd = getYtdlpCmd();
    if (!cmd) return reject(new Error('yt-dlp tidak tersedia'));
    let out = '', err = '';
    const proc = spawn(cmd.bin, [...cmd.baseArgs, ...args], { timeout: timeoutMs });
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `yt-dlp exit ${code}`));
    });
    proc.on('error', e => reject(e));
  });
}

async function ytdlpSearch(query, limit = 5) {
  const out = await spawnYtdlp([
    `ytsearch${limit}:${query}`,
    '--dump-json', '--flat-playlist',
    '--no-warnings', '--quiet',
    ...YT_JS_RUNTIME,
    ...YT_PLAYER_CLIENTS,
    ...getCookiesArgs(),
  ], 30000);
  return out.split('\n').filter(Boolean).map(line => {
    try {
      const v = JSON.parse(line);
      const dur = v.duration || 0;
      return {
        title:       v.title || 'Unknown',
        url:         v.webpage_url || `https://youtube.com/watch?v=${v.id}`,
        videoId:     v.id,
        duration:    dur * 1000,
        durationFmt: formatDuration(dur),
        thumbnail:   v.thumbnail || null,
        uploader:    v.channel || v.uploader || 'Unknown',
        views:       v.view_count || 0,
        viewsFmt:    formatViews(v.view_count),
        titleBtn:    sanitizeBtn(v.title),
      };
    } catch { return null; }
  }).filter(Boolean);
}

async function ytdlpGetInfo(url) {
  const out = await spawnYtdlp([url, '--dump-json', '--no-warnings', '--quiet', ...YT_JS_RUNTIME, ...YT_PLAYER_CLIENTS, ...getCookiesArgs()], 30000);
  const v   = JSON.parse(out);
  const dur = v.duration || 0;
  return {
    title:       v.title || 'Unknown',
    url:         v.webpage_url || url,
    videoId:     v.id,
    duration:    dur * 1000,
    durationFmt: formatDuration(dur),
    thumbnail:   v.thumbnail || null,
    uploader:    v.channel || v.uploader || 'Unknown',
    views:       v.view_count || 0,
    viewsFmt:    formatViews(v.view_count),
    titleBtn:    sanitizeBtn(v.title),
  };
}

async function ytdlpGetAudioUrl(url) {
  const out = await spawnYtdlp([
    url,
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--get-url', '--no-warnings', '--quiet',
    ...YT_JS_RUNTIME,
    ...YT_PLAYER_CLIENTS,
    ...getCookiesArgs(),
  ], 60000);
  const audioUrl = out.split('\n')[0];
  if (!audioUrl?.startsWith('http')) throw new Error('yt-dlp: URL tidak valid');
  return audioUrl;
}

async function ytdlpGetVideoUrl(url) {
  // Sama kayak ytdlpDownloadVideo: format spesifik dulu, fallback ke "best" kalau
  // ke-block 403 (biasanya soal PO Token yang kita gak punya buat format tertentu).
  const formatAttempts = [
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    'best',
  ];

  let lastErr;
  for (const fmt of formatAttempts) {
    try {
      const out = await spawnYtdlp([
        url,
        '-f', fmt,
        '--get-url', '--no-warnings', '--quiet',
        ...YT_JS_RUNTIME,
        ...YT_PLAYER_CLIENTS,
        ...getCookiesArgs(),
      ], 60000);
      // get-url bisa return 2 baris (video + audio) untuk format gabungan
      const lines = out.split('\n').filter(l => l.startsWith('http'));
      if (lines.length) return lines[0]; // ambil yang pertama
    } catch (e) {
      lastErr = e;
      console.warn(`[ytdl] yt-dlp get-video-url (format "${fmt}"):`, e.message);
    }
  }
  throw lastErr || new Error('yt-dlp: video URL tidak valid');
}

async function ytdlpDownloadAudio(url, outPath) {
  await spawnYtdlp([
    url,
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '-o', outPath,
    '--no-warnings', '--quiet', '--no-playlist',
    ...YT_JS_RUNTIME,
    ...YT_PLAYER_CLIENTS,
    ...getCookiesArgs(),
  ], 300000);
  // yt-dlp mengubah ekstensi, cari file hasil
  const mp3Path = outPath.replace(/\.[^.]+$/, '.mp3');
  if (fs.existsSync(mp3Path)) return mp3Path;
  if (fs.existsSync(outPath)) return outPath;
  throw new Error('yt-dlp: file audio tidak ditemukan setelah download');
}

async function ytdlpDownloadVideo(url, outPath) {
  // Coba format spesifik (mp4+m4a) dulu buat kualitas terbaik. Beberapa kombinasi
  // client/format butuh PO Token yang gak kita punya dan bakal balas 403 Forbidden --
  // itu BUKAN berarti video-nya gak bisa didownload sama sekali, cuma format SPESIFIK itu
  // yang diblokir. Makanya kalau gagal, coba lagi dengan selector paling longgar ("best",
  // ambil apa pun yang tersedia) sebelum bener-bener nyerah dan pindah metode lain.
  const formatAttempts = [
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    'best',
  ];

  let lastErr;
  for (const fmt of formatAttempts) {
    try {
      await spawnYtdlp([
        url,
        '-f', fmt,
        '--merge-output-format', 'mp4',
        '-o', outPath,
        '--no-warnings', '--quiet', '--no-playlist',
        ...YT_JS_RUNTIME,
        ...YT_PLAYER_CLIENTS,
        ...getCookiesArgs(),
      ], 600000);
      if (fs.existsSync(outPath)) return outPath;
    } catch (e) {
      lastErr = e;
      console.warn(`[ytdl] yt-dlp video (format "${fmt}"):`, e.message);
    }
  }
  throw lastErr || new Error('yt-dlp: file video tidak ditemukan setelah download');
}

// ─────────────────────────────────────────
// @vreden/youtube_scraper
// ─────────────────────────────────────────

let _vreden = null;
function getVreden() {
  if (_vreden) return _vreden;
  try { _vreden = require('@vreden/youtube_scraper'); return _vreden; }
  catch { return null; }
}

function extractVredenUrl(dl) {
  if (!dl) return null;
  if (typeof dl === 'string' && dl.startsWith('http')) return dl;
  const url = dl?.url || dl?.link || dl?.downloadUrl || dl?.download;
  return (typeof url === 'string' && url.startsWith('http')) ? url : null;
}

function mapVredenResult(v) {
  const title   = String(v.title || v.name || 'Unknown');
  const videoId = v.videoId || v.id || extractVideoId(v.url || '') || '';
  const url     = v.url || (videoId ? `https://youtube.com/watch?v=${videoId}` : '');

  // Uploader: handle object {name, id, url} or string
  const rawCh    = v.channel || v.author || v.channelTitle || v.uploader || '';
  const uploader = typeof rawCh === 'object' && rawCh !== null
    ? String(rawCh.name || rawCh.title || rawCh.channelTitle || rawCh.channel || 'Unknown')
    : String(rawCh || 'Unknown');

  // Duration: handle number (sec), number (ms), string "mm:ss", object {seconds, text}
  let durSec = 0, durFmt = '??:??';
  const rawDur = v.duration ?? v.length ?? v.lengthSeconds
    ?? v.videoDetails?.lengthSeconds ?? v.contentDetails?.duration;

  if (rawDur !== undefined && rawDur !== null) {
    if (typeof rawDur === 'object') {
      // {seconds: 212, text: "3:32"} or {duration: "3:32"}
      durSec = rawDur.seconds || rawDur.sec || 0;
      durFmt = rawDur.text || rawDur.duration || (durSec ? formatDuration(durSec) : '??:??');
    } else if (typeof rawDur === 'number' && rawDur > 0) {
      durSec = rawDur > 86400 ? Math.floor(rawDur / 1000) : rawDur; // >1day = ms
      durFmt = formatDuration(durSec);
    } else if (typeof rawDur === 'string' && rawDur.trim()) {
      const clean = rawDur.trim();
      if (clean.includes(':')) {
        const p = clean.split(':').map(Number);
        if (p.length === 2 && p.every(n => !isNaN(n))) { durSec = p[0]*60+p[1]; durFmt = clean; }
        if (p.length === 3 && p.every(n => !isNaN(n))) { durSec = p[0]*3600+p[1]*60+p[2]; durFmt = clean; }
      } else if (!isNaN(Number(clean)) && Number(clean) > 0) {
        durSec = Number(clean);
        durFmt = formatDuration(durSec);
      }
    }
  }

  // Views: number or string
  const rawViews = v.views ?? v.viewCount ?? v.view_count ?? 0;
  const views = typeof rawViews === 'number' ? rawViews
    : parseInt(String(rawViews).replace(/[^0-9]/g, '')) || 0;

  return {
    title, url, videoId,
    duration:    durSec * 1000,
    durationFmt: durFmt,
    thumbnail:   v.thumbnail || v.thumbnails?.[0]?.url || null,
    uploader,
    views,
    viewsFmt:    formatViews(views),
    titleBtn:    sanitizeBtn(title),
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, r) => setTimeout(() => r(new Error(`${label} timeout ${ms}ms`)), ms)),
  ]);
}

// ─── Search ───────────────────────────────
async function searchYouTube(query, limit = 5) {
  // 1. Vreden
  const vr = getVreden();
  if (vr) {
    try {
      const res = await withTimeout(vr.search(query), 15000, 'vreden.search');
      if (res.status && res.results?.length) {
        return res.results.slice(0, limit).map(mapVredenResult);
      }
    } catch (e) { console.warn('[ytdl] vreden search:', e.message); }
  }

  // 2. yt-dlp
  if (getYtdlpPath()) {
    try {
      const results = await ytdlpSearch(query, limit);
      if (results.length) { console.log('[ytdl] search via yt-dlp'); return results; }
    } catch (e) { console.warn('[ytdl] yt-dlp search:', e.message); }
  }

  // 3. youtube-sr
  try {
    const YouTube = require('youtube-sr').default;
    const results = await YouTube.search(query, { limit, type: 'video' });
    return results.map(v => ({
      title:       v.title || 'Unknown',
      url:         v.url,
      videoId:     v.id,
      duration:    v.duration || 0,
      durationFmt: v.durationFormatted || formatDuration(Math.floor((v.duration||0)/1000)),
      thumbnail:   v.thumbnail?.url || null,
      uploader:    v.channel?.name || 'Unknown',
      views:       v.views || 0,
      viewsFmt:    formatViews(v.views),
      titleBtn:    sanitizeBtn(v.title),
    }));
  } catch (e) {
    console.error('[ytdl] search semua gagal:', e.message);
    return [];
  }
}

// ─── Get video info ────────────────────────
async function getVideoInfo(url) {
  // 1. yt-dlp (paling akurat untuk info)
  if (getYtdlpPath()) {
    try { return await ytdlpGetInfo(url); } catch (e) { console.warn('[ytdl] yt-dlp info:', e.message); }
  }

  // 2. Vreden via search videoId
  const vr = getVreden();
  if (vr) {
    try {
      const id  = extractVideoId(url);
      const res = await withTimeout(vr.search(id || url), 15000, 'vreden.info');
      if (res.status && res.results?.length) return mapVredenResult(res.results[0]);
    } catch (e) { console.warn('[ytdl] vreden info:', e.message); }
  }

  // 3. youtube-sr
  try {
    const YouTube = require('youtube-sr').default;
    const v = await YouTube.getVideo(url);
    if (!v) throw new Error('Not found');
    return {
      title: v.title || 'Unknown', url: v.url, videoId: v.id,
      duration: v.duration || 0, durationFmt: v.durationFormatted || '??:??',
      thumbnail: v.thumbnail?.url || null, uploader: v.channel?.name || 'Unknown',
      views: v.views || 0, viewsFmt: formatViews(v.views), titleBtn: sanitizeBtn(v.title),
    };
  } catch (e) { console.error('[ytdl] getVideoInfo gagal:', e.message); return null; }
}

// ─── Get audio stream URL ──────────────────
async function getStreamUrl(url) {
  // 1. Vreden ytmp3
  const vr = getVreden();
  if (vr) {
    try {
      const res    = await withTimeout(vr.ytmp3(url), 20000, 'vreden.ytmp3');
      const dlUrl  = res.status ? extractVredenUrl(res.download) : null;
      if (dlUrl) { console.log('[ytdl] ✅ stream URL via vreden'); return dlUrl; }
      console.warn('[ytdl] vreden ytmp3 invalid:', JSON.stringify(res.download));
    } catch (e) { console.warn('[ytdl] vreden ytmp3:', e.message); }
  }

  // 2. yt-dlp
  if (getYtdlpPath()) {
    try {
      const dlUrl = await ytdlpGetAudioUrl(url);
      console.log('[ytdl] ✅ stream URL via yt-dlp');
      return dlUrl;
    } catch (e) { console.warn('[ytdl] yt-dlp audio URL:', e.message); }
  }

  // 3. RapidAPI
  try {
    const dlUrl = await rapidApiGetUrl(url, 'mp3');
    console.log('[ytdl] ✅ stream URL via RapidAPI');
    return dlUrl;
  } catch (e) { throw new Error(`Semua metode gagal: ${e.message}`); }
}

// ─── Get video URL ─────────────────────────
async function getVideoUrl(url) {
  // 1. Vreden ytmp4
  const vr = getVreden();
  if (vr) {
    try {
      const res   = await withTimeout(vr.ytmp4(url), 30000, 'vreden.ytmp4');
      const dlUrl = res.status ? extractVredenUrl(res.download) : null;
      if (dlUrl) { console.log('[ytdl] ✅ video URL via vreden'); return dlUrl; }
    } catch (e) { console.warn('[ytdl] vreden ytmp4:', e.message); }
  }

  // 2. yt-dlp
  if (getYtdlpPath()) {
    try {
      const dlUrl = await ytdlpGetVideoUrl(url);
      console.log('[ytdl] ✅ video URL via yt-dlp');
      return dlUrl;
    } catch (e) { console.warn('[ytdl] yt-dlp video URL:', e.message); }
  }

  // 3. RapidAPI
  try {
    const dlUrl = await rapidApiGetUrl(url, 'mp4');
    console.log('[ytdl] ✅ video URL via RapidAPI');
    return dlUrl;
  } catch (e) { throw new Error(`Semua metode video gagal: ${e.message}`); }
}

// ─── Download audio to cache ───────────────
// Video age-restricted itu WALL YANG BEDA dari bot-detection biasa — per 2026, YouTube
// mengharuskan cookies dari akun asli yang login+ke-verifikasi umur buat konten begini,
// gak ada trik ganti player_client yang bisa nembus lagi. Kalau ini penyebab kegagalan,
// user perlu tau itu BUKAN bug bot, biar gak bingung liat pesan teknis yang gak nyambung.
function isAgeRestrictedError(msg) {
  return /confirm your age|age.restrict|inappropriate for some users/i.test(msg || '');
}

function describeDownloadFailure(errors, jenis) {
  if (errors.some(isAgeRestrictedError)) {
    return `Video ini age-restricted (YouTube minta konfirmasi umur). Bot gak bisa download ${jenis} ini tanpa cookies akun YouTube asli yang sudah login & ter-verifikasi umur — ini batasan dari YouTube sendiri, bukan bug bot.`;
  }
  return `Semua metode download ${jenis} gagal: ${errors[errors.length - 1]}`;
}

async function downloadAudio(url, outputDir = os.tmpdir()) {
  const { getCacheDir } = require('./cache');
  const cacheDir = getCacheDir();
  const videoId  = extractVideoId(url);
  const cached   = videoId ? path.join(cacheDir, `${videoId}.mp3`) : null;
  if (cached && fs.existsSync(cached)) {
    console.log(`[ytdl] 💾 Cache hit audio: ${videoId}`);
    return cached;
  }
  const outPath = cached || path.join(cacheDir, `audio_${Date.now()}.mp3`);
  const errors  = [];

  // 1. yt-dlp (download langsung, paling reliable)
  if (getYtdlpPath()) {
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[ytdl] ⬇️ yt-dlp download audio (${i}/3)`);
        return await ytdlpDownloadAudio(url, outPath);
      } catch (e) {
        console.warn(`[ytdl] yt-dlp attempt ${i}: ${e.message}`);
        errors.push(e.message);
        // Age-restricted / video gak tersedia itu kegagalan PERMANEN — retry gak bakal
        // ngubah hasil, cuma buang waktu. Langsung lompat ke metode fallback lain.
        if (isAgeRestrictedError(e.message)) break;
        if (i < 3) await new Promise(r => setTimeout(r, 2000 * i));
      }
    }
  }

  // 2. Vreden + fetch
  const vr = getVreden();
  if (vr) {
    try {
      const res   = await withTimeout(vr.ytmp3(url), 20000, 'vreden.ytmp3');
      const dlUrl = res.status ? extractVredenUrl(res.download) : null;
      if (dlUrl) {
        console.log('[ytdl] ⬇️ download via vreden URL');
        const r = await fetch(dlUrl, { signal: AbortSignal.timeout(180000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()));
        return outPath;
      }
    } catch (e) { console.warn('[ytdl] vreden download:', e.message); errors.push(e.message); }
  }

  // 3. RapidAPI + fetch
  try {
    const dlUrl = await rapidApiGetUrl(url, 'mp3');
    console.log('[ytdl] ⬇️ download via RapidAPI URL');
    const r = await fetch(dlUrl, { signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()));
    return outPath;
  } catch (e) {
    errors.push(e.message);
    throw new Error(describeDownloadFailure(errors, 'audio'));
  }
}

// ─── Download video to cache ───────────────
async function downloadVideo(url, videoId = null) {
  const { getCacheDir } = require('./cache');
  const cacheDir = getCacheDir();
  const id       = videoId || extractVideoId(url);
  const cached   = id ? path.join(cacheDir, `${id}_video.mp4`) : null;
  if (cached && fs.existsSync(cached)) {
    console.log(`[ytdl] 💾 Cache hit video: ${id}`);
    return cached;
  }
  const outPath = cached || path.join(cacheDir, `video_${Date.now()}.mp4`);
  const errors  = [];

  // 1. yt-dlp
  if (getYtdlpPath()) {
    try {
      console.log('[ytdl] ⬇️ yt-dlp download video');
      return await ytdlpDownloadVideo(url, outPath);
    } catch (e) { console.warn('[ytdl] yt-dlp video:', e.message); errors.push(e.message); }
  }

  // 2. Vreden + fetch
  const vr = getVreden();
  if (vr) {
    try {
      const res   = await withTimeout(vr.ytmp4(url), 30000, 'vreden.ytmp4');
      const dlUrl = res.status ? extractVredenUrl(res.download) : null;
      if (dlUrl) {
        console.log('[ytdl] ⬇️ download video via vreden URL');
        const r = await fetch(dlUrl, { signal: AbortSignal.timeout(300000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()));
        return outPath;
      }
    } catch (e) { console.warn('[ytdl] vreden video download:', e.message); errors.push(e.message); }
  }

  // 3. RapidAPI
  try {
    const dlUrl = await rapidApiGetUrl(url, 'mp4');
    const r = await fetch(dlUrl, { signal: AbortSignal.timeout(300000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()));
    return outPath;
  } catch (e) {
    errors.push(e.message);
    throw new Error(describeDownloadFailure(errors, 'video'));
  }
}

// ─── RapidAPI fallback (youtube-mp310) ─────
// Endpoint: GET https://youtube-mp310.p.rapidapi.com/download/{mp3|mp4}?url=<youtube_url>
// Dipakai sebagai upaya terakhir kalau vreden & yt-dlp gagal.
async function rapidApiGetUrl(url, format = 'mp3') {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY tidak diset di config.js');

  const fmt      = format === 'mp4' ? 'mp4' : 'mp3';
  const endpoint = `https://${RAPIDAPI_HOST}/download/${fmt}?url=${encodeURIComponent(url)}`;

  const res = await fetch(endpoint, {
    method:  'GET',
    headers: {
      'x-rapidapi-key':  RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`RapidAPI HTTP ${res.status}`);

  const raw = (await res.text()).trim();

  // Respons bisa berupa JSON ({ dlink/link/url/... }) atau plain-text URL
  // tergantung plan/versi API, jadi coba dua-duanya.
  let dlUrl = null;
  try {
    const data = JSON.parse(raw);
    dlUrl = data.dlink || data.downloadUrl || data.download_url ||
            data.link  || data.url         || data.result       ||
            (data.data && (data.data.url || data.data.link))    || null;
  } catch {
    dlUrl = raw.replace(/^"+|"+$/g, ''); // buang tanda kutip kalau plain-text dibungkus quote
  }

  if (!dlUrl || !/^https?:\/\//.test(dlUrl)) {
    throw new Error(`RapidAPI respons tidak valid: ${raw.slice(0, 150)}`);
  }
  return dlUrl;
}

// ─── Startup check ─────────────────────────
(async function checkDeps() {
  const cmd = await ensureYtdlp();
  if (cmd) {
    try {
      const ver = execSync(`${cmd.bin} ${[...cmd.baseArgs, '--version'].join(' ')}`, { timeout: 5000 }).toString().trim();
      console.log(`[ytdl] ✅ yt-dlp: v${ver}`);
    } catch {}
  }
  if (getVreden()) console.log('[ytdl] ✅ @vreden/youtube_scraper loaded');
  else console.warn('[ytdl] ⚠️  vreden tidak tersedia. Install: npm i @vreden/youtube_scraper');
  if (!RAPIDAPI_KEY) console.warn('[ytdl] ⚠️  RAPIDAPI_KEY kosong — RapidAPI backup tidak aktif');
})();

module.exports = {
  searchYouTube, getVideoInfo,
  downloadAudio, downloadVideo,
  getStreamUrl,  getVideoUrl,
  isYouTubeUrl,  extractVideoId,
  formatDuration, sanitizeBtn,
  getYtdlpPath,
};
