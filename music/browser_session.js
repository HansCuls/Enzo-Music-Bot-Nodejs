// ==========================================
// FILE: music/browser_session.js
// Sesi browser (Puppeteer + Firefox) buat nyediain cookies YouTube ASLI ke yt-dlp
// lewat --cookies-from-browser, buat nembus video age-restricted.
//
// KENAPA FIREFOX, BUKAN CHROME/CHROMIUM:
// Cookie Chrome dienkripsi pakai secret dari OS (DPAPI di Windows, Keychain di macOS,
// GNOME Keyring/KWallet di Linux). Di VPS headless kayak Pterodactyl, GAK ADA keyring
// daemon yang jalan — jadi --cookies-from-browser chrome sering gagal decrypt.
// Firefox nyimpen cookie TANPA enkripsi OS-level gitu, dan --cookies-from-browser
// firefox:/path/custom udah didukung resmi tanpa drama keyring.
//
// Puppeteer resmi dukung Firefox stabil sejak v23 (Agustus 2024) lewat WebDriver BiDi —
// sebelum itu cuma eksperimental/Nightly-only, jadi package.json udah dikunci ^23.0.0.
//
// LOGIN OTOMATIS SENGAJA TIDAK DIPAKAI: halaman login Google secara aktif mendeteksi
// browser otomatis dan sering memblokirnya sepenuhnya (apalagi kalau akunnya pakai 2FA),
// jadi login TETAP dilakukan manual satu kali oleh manusia — Puppeteer di sini cuma
// dipakai buat NYIMPEN & ME-REFRESH sesi yang udah ada, bukan buat login sendiri.
//
// INI OPSIONAL — kalau folder profile-nya gak ada, semua fungsi di ytdl.js tetap
// jalan normal TANPA cookies (persis kayak sebelum fitur ini ada).
//
// CARA PAKAI:
//   1) Di KOMPUTER/HP yang ada layar: `npm install`, lalu
//        npx puppeteer browsers install firefox
//      kemudian:
//        node music/browser_session.js login
//      Firefox beneran kebuka -> login manual ke akun YouTube/Google kamu ->
//      tutup browsernya sendiri kalau udah selesai.
//   2) Zip folder yang dihasilkan (browser-profile/) lalu upload ke VPS,
//      taruh di root project (sejajar sama folder music/).
//   3) Di VPS: `npm install`, lalu `npx puppeteer browsers install firefox`,
//      lalu jalankan sekali: node music/browser_session.js refresh
//   4) Bot otomatis me-refresh sesi ini secara berkala di background (lihat
//      startAutoRefresh() yang dipanggil dari index.js).
// ==========================================

const path = require('path');
const fs   = require('fs');

const PROFILE_DIR = global.YT_BROWSER_PROFILE || path.join(__dirname, '..', 'browser-profile');
const STATE_FILE  = path.join(PROFILE_DIR, '.last_refresh');

function profileExists() {
  try {
    return fs.existsSync(PROFILE_DIR) && fs.readdirSync(PROFILE_DIR).length > 0;
  } catch { return false; }
}

function getLastRefresh() {
  try { return parseInt(fs.readFileSync(STATE_FILE, 'utf8').trim()); } catch { return null; }
}

function markRefreshed() {
  try {
    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, String(Date.now()));
  } catch {}
}

/**
 * Argumen buat disisipin ke spawnYtdlp KALAU profile browser-nya ada.
 * Kalau gak ada, balikin array kosong -- yt-dlp jalan normal tanpa cookies.
 */
function getCookiesArgs() {
  if (!profileExists()) return [];
  return ['--cookies-from-browser', `firefox:${PROFILE_DIR}`];
}

function sessionStatus() {
  if (!profileExists()) {
    return { active: false, message: 'Belum ada sesi browser tersimpan. Kirim file cookies.txt ke bot via /cookieimport (paling gampang), atau jalankan "node music/browser_session.js login" di perangkat yang ada layar.' };
  }
  const last = getLastRefresh();
  const ageHours = last ? Math.round((Date.now() - last) / 3600000) : null;
  return {
    active: true,
    lastRefresh: last,
    ageHours,
    message: ageHours === null
      ? 'Sesi ada, tapi belum pernah di-refresh sejak upload. Jalankan refresh sekali.'
      : `Sesi aktif, terakhir di-refresh ${ageHours} jam lalu.`,
  };
}

// Puppeteer sendiri gak otomatis download Firefox pas npm install (defaultnya Chrome,
// dan bahkan itu pun sering ke-block sama package manager modern). Jadi kalau launch
// gagal spesifik karena binary Firefox belum ada, coba install otomatis sekali lewat
// "npx puppeteer browsers install firefox", lalu retry — biar gak perlu akses shell
// manual sama sekali (penting karena banyak yang cuma punya akses lewat Telegram/panel).
let _firefoxInstallAttempted = false;
async function launchFirefox(options) {
  const puppeteer = require('puppeteer');
  try {
    return await puppeteer.launch({ browser: 'firefox', ...options });
  } catch (e) {
    if (!/could not find firefox/i.test(e.message) || _firefoxInstallAttempted) throw e;
    _firefoxInstallAttempted = true;
    console.log('[browser_session] ⬇️  Browser Firefox belum ke-install, mencoba auto-install (bisa makan waktu 1-2 menit)...');
    try {
      const { execSync } = require('child_process');
      execSync('npx --yes puppeteer browsers install firefox', { stdio: 'inherit', timeout: 300000 });
    } catch (installErr) {
      throw new Error(`Gagal auto-install Firefox: ${installErr.message}. Coba jalankan manual di VPS: npx puppeteer browsers install firefox`);
    }
    console.log('[browser_session] ✅ Firefox berhasil diinstall, membuka browser lagi...');
    return await puppeteer.launch({ browser: 'firefox', ...options });
  }
}

// --- Login manual (jalankan di perangkat yang ada layar, bukan di VPS headless) ---
async function loginLocal() {
  console.log(`[browser_session] Profile akan disimpan di: ${PROFILE_DIR}`);
  console.log('[browser_session] Browser Firefox bakal kebuka. Login ke akun YouTube/Google kamu.');
  console.log('[browser_session] TUTUP browsernya sendiri (klik X) kalau login udah selesai.');
  const browser = await launchFirefox({
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: { width: 1280, height: 800 },
  });
  const [page] = await browser.pages();
  await page.goto('https://www.youtube.com');
  await new Promise((resolve) => browser.on('disconnected', resolve));
  markRefreshed();
  console.log('[browser_session] ✅ Sesi tersimpan. Zip folder browser-profile/ lalu upload ke VPS.');
}

/**
 * Parse file cookies.txt format Netscape (yang di-export ekstensi browser kayak
 * "cookies.txt" resmi di addons.mozilla.org). Format: 7 kolom dipisah TAB —
 * domain, includeSubdomains, path, secure, expiration, name, value.
 * Baris yang diawali "#HttpOnly_" itu cookie httpOnly (bukan komentar biasa).
 */
function parseNetscapeCookies(content) {
  const cookies = [];
  for (let line of content.split('\n')) {
    line = line.trim();
    if (!line) continue;
    let httpOnly = false;
    if (line.startsWith('#HttpOnly_')) {
      httpOnly = true;
      line = line.slice('#HttpOnly_'.length);
    } else if (line.startsWith('#')) {
      continue; // komentar biasa
    }
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [domain, , cookiePath, secureStr, expiryStr, name, ...valueParts] = parts;
    const expiry = parseInt(expiryStr, 10);
    cookies.push({
      name,
      value: valueParts.join('\t'),
      domain,
      path: cookiePath || '/',
      secure: String(secureStr).toUpperCase() === 'TRUE',
      httpOnly,
      ...(expiry > 0 ? { expires: expiry } : {}),
    });
  }
  return cookies;
}

/**
 * Import cookies yang UDAH KAMU AMBIL sendiri (misal dari ekstensi cookies.txt di
 * Firefox Android) ke profile Puppeteer — headless, gak buka form login Google sama
 * sekali. Ini beda total dari "otomasi login": yang terjadi cuma "titip" cookies yang
 * udah sah ke browser, jadi gak kena deteksi bot di halaman login sama sekali.
 * Setelah ini, refreshSession() bisa jalan seperti biasa buat jaga sesi tetap hangat.
 */
async function importCookies(cookiesTxtPath) {
  if (!fs.existsSync(cookiesTxtPath)) {
    throw new Error(`File cookies gak ketemu: ${cookiesTxtPath}`);
  }
  const cookies = parseNetscapeCookies(fs.readFileSync(cookiesTxtPath, 'utf8'));
  if (cookies.length === 0) {
    throw new Error('Gak ada cookie valid yang bisa dibaca dari file itu — pastikan formatnya Netscape cookies.txt.');
  }

  let browser;
  try {
    browser = await launchFirefox({ headless: true, userDataDir: PROFILE_DIR });
    const [page] = await browser.pages();
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.setCookie(...cookies);

    // Verifikasi ringan (best-effort, gak fatal kalau gagal ke-detect) — reload &
    // cek apakah kelihatan udah login.
    let loggedIn = null;
    try {
      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
      loggedIn = await page.evaluate(() =>
        !!document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer, button[aria-label*="Account" i]')
      );
    } catch {}

    markRefreshed();
    console.log(`[browser_session] ✅ ${cookies.length} cookies berhasil diimport.`);
    return { ok: true, cookieCount: cookies.length, loggedIn };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// --- Refresh sesi (aman dijalankan headless di VPS) ---
// Cuma numpang kunjungan ke YouTube biar sesinya tetep "hangat" dan gak dianggap
// basi/mencurigakan. TIDAK login ulang, TIDAK isi form apa pun -- cuma buka halaman.
async function refreshSession() {
  if (!profileExists()) {
    console.warn('[browser_session] ⚠️  Profile belum ada, skip refresh.');
    return false;
  }
  let browser;
  try {
    browser = await launchFirefox({
      headless: true,
      userDataDir: PROFILE_DIR,
    });
    const [page] = await browser.pages();
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));
    markRefreshed();
    console.log('[browser_session] ✅ Sesi berhasil di-refresh');
    return true;
  } catch (e) {
    console.warn('[browser_session] ⚠️  Refresh gagal:', e.message);
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// --- Auto-refresh berkala (dipanggil dari index.js saat bot start) ---
function startAutoRefresh(intervalHours = 12) {
  if (!profileExists()) {
    console.log('[browser_session] Profile browser belum di-setup, auto-refresh gak diaktifkan (opsional).');
    return;
  }
  console.log(`[browser_session] Auto-refresh sesi tiap ${intervalHours} jam diaktifkan.`);
  refreshSession(); // refresh sekali pas startup
  setInterval(refreshSession, intervalHours * 3600000);
}

module.exports = { getCookiesArgs, profileExists, sessionStatus, refreshSession, startAutoRefresh, importCookies, PROFILE_DIR };

// --- CLI entrypoint: node music/browser_session.js login|refresh|status|import <path> ---
if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === 'login')        await loginLocal();
    else if (cmd === 'refresh') await refreshSession();
    else if (cmd === 'status')  console.log(sessionStatus());
    else if (cmd === 'import') {
      const p = process.argv[3];
      if (!p) { console.log('Pakai: node music/browser_session.js import /path/ke/cookies.txt'); process.exit(1); }
      const result = await importCookies(p);
      console.log(result);
    }
    else console.log('Pakai: node music/browser_session.js login|refresh|status|import <path>');
    process.exit(0);
  })();
}
