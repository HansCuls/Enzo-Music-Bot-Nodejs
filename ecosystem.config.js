// ==========================================
// FILE: ecosystem.config.js
// Konfigurasi PM2 untuk Music Bot
// Jalankan: pm2 start ecosystem.config.js
// ==========================================

module.exports = {
  apps: [
    {
      name:             'music-bot',
      script:           'index.js',
      cwd:              __dirname,

      // ─── Restart settings ───────────────
      watch:            false,         // jangan watch file (bisa loop restart)
      autorestart:      true,          // restart otomatis kalau crash
      max_restarts:     10,            // max restart sebelum dianggap failed
      min_uptime:       '10s',         // harus jalan min 10 detik baru dianggap sukses
      restart_delay:    3000,          // tunggu 3 detik sebelum restart

      // ─── Memory limit ───────────────────
      max_memory_restart: '512M',      // restart kalau memory > 512MB

      // ─── Logs ───────────────────────────
      log_date_format:  'YYYY-MM-DD HH:mm:ss',
      out_file:         './database/logs/out.log',
      error_file:       './database/logs/error.log',
      merge_logs:       true,

      // ─── Environment ────────────────────
      env: {
        NODE_ENV: 'production',
      },

      // ─── Instance ───────────────────────
      instances:        1,             // 1 instance (jangan lebih, bot tidak support cluster)
      exec_mode:        'fork',        // mode fork (bukan cluster)
    },
  ],
};
