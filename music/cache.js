// ==========================================
// FILE: music/cache.js
// Auto-clear downloaded audio cache
// Hapus file > 7 hari setiap 24 jam
// ==========================================

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CACHE_DIR     = path.join(__dirname, '../database/audio_cache');
const MAX_AGE_DAYS  = 7;
const CHECK_INTERVAL= 24 * 60 * 60 * 1000; // 24 jam

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

function clearOldCache() {
  try {
    ensureCacheDir();
    const files  = fs.readdirSync(CACHE_DIR);
    const cutoff = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    let deleted  = 0;
    let freedMB  = 0;

    for (const file of files) {
      const fpath = path.join(CACHE_DIR, file);
      try {
        const stat = fs.statSync(fpath);
        if (stat.mtimeMs < cutoff) {
          freedMB += stat.size / (1024 * 1024);
          fs.unlinkSync(fpath);
          deleted++;
        }
      } catch {}
    }

    if (deleted > 0) {
      console.log(`[cache] 🗑 Auto-clear: hapus ${deleted} file (${freedMB.toFixed(1)}MB), file > ${MAX_AGE_DAYS} hari`);
    }
    return { deleted, freedMB };
  } catch (e) {
    console.error('[cache] clear error:', e.message);
    return { deleted: 0, freedMB: 0 };
  }
}

function getCacheDir() {
  return ensureCacheDir();
}

function getCacheStats() {
  try {
    ensureCacheDir();
    const files   = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;
    for (const file of files) {
      try { totalSize += fs.statSync(path.join(CACHE_DIR, file)).size; } catch {}
    }
    return {
      count:   files.length,
      sizeMB:  (totalSize / (1024 * 1024)).toFixed(1),
    };
  } catch { return { count: 0, sizeMB: '0' }; }
}

// Hapus 1 file spesifik setelah dipakai
function deleteFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

// Start auto-clear interval
function startAutoClear(telegram) {
  // Clear sekali saat startup
  clearOldCache();

  // Lalu setiap 24 jam
  setInterval(() => {
    const result = clearOldCache();
    if (result.deleted > 0 && telegram) {
      const admins = (global.BOT_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const adminId of admins) {
        telegram.sendMessage(adminId,
          `<blockquote>🗑 <b>Auto Cache Clear</b>\n\n✅ ${result.deleted} file dihapus\n💾 ${result.freedMB.toFixed(1)}MB dibebaskan\n📁 Cache > ${MAX_AGE_DAYS} hari</blockquote>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
  }, CHECK_INTERVAL);

  console.log(`[cache] ✅ Auto-clear aktif (setiap 24 jam, hapus file > ${MAX_AGE_DAYS} hari)`);
}

module.exports = { getCacheDir, clearOldCache, getCacheStats, deleteFile, startAutoClear };
