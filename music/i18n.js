// ==========================================
// FILE: music/i18n.js
// Multi-language support
// Supported: id (Indonesian), en (English),
//            ms (Malay), ar (Arabic), tr (Turkish)
// ==========================================
const translations = {
  // ─────────────────────────────────────────
  // 🇮🇩 BAHASA INDONESIA (default)
  // ─────────────────────────────────────────
  id: {
    // General
    only_group:          '❌ Perintah ini hanya bisa digunakan di grup.',
    no_permission:       '❌ Kamu tidak punya izin untuk itu.',
    unknown_error:       '❌ Terjadi kesalahan tidak terduga.',
    cancelled:           '❌ Dibatalkan.',
    loading:             '⏳ Memuat...',
    // Pre-check
    checking_group:      '🔍 Memeriksa kondisi grup...',
    bot_not_admin:       `❌ <b>Bot bukan admin di grup ini!</b>\n\nJadikan bot sebagai admin dengan hak:\n• Kelola anggota\n• Kelola Voice Chat\n• Undang pengguna\n\nLalu coba lagi.`,
    userbot_not_login:   `❌ <b>Userbot musik belum login!</b>\n\nAdmin bot harus login dulu via:\n<code>/musiclogin</code> di private chat bot.`,
    inviting_userbot:    '⏳ Mengundang userbot musik ke grup...',
    userbot_joined:      '✅ Userbot musik berhasil bergabung!',
    invite_failed:       (e) => `❌ <b>Gagal mengundang userbot musik!</b>\n\nError: ${e}\n\nPastikan bot punya hak <b>Undang Pengguna</b>.`,
    promoting_userbot:   '⏳ Mempromote userbot musik jadi admin...',
    userbot_promoted:    '✅ Userbot musik berhasil dijadikan admin!',
    promote_failed:      (e) => `❌ <b>Gagal promote userbot musik!</b>\n\nError: ${e}`,
    starting_vc:         '🎙 Memulai Voice Chat...',
    vc_started:          '✅ Voice Chat berhasil dimulai!',
    vc_failed:           (e) => `❌ <b>Gagal memulai Voice Chat!</b>\n\nError: ${e}`,
    // Play
    play_usage:          `❓ <b>Cara Pakai:</b>\n\n/play judul lagu\n/play https://youtube.com/watch?v=...\n\nContoh: /play Dewa 19 Kangen`,
    fetching_info:       '⏳ Mengambil info lagu...',
    searching_yt:        '🔍 Mencari lagu di YouTube...',
    not_found:           '❌ Lagu tidak ditemukan. Coba kata kunci lain.',
    starting_play:       '🎶 Memulai putar lagu...',
    added_to_queue:      (title, uploader, dur, pos) =>
                           `✅ <b>Ditambahkan ke antrian!</b>\n\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 Posisi: #${pos}`,
    stream_error:        (e) => `❌ <b>Error streaming:</b> ${e}`,
    // Search
    search_usage:        `❓ <b>Cara Pakai:</b>\n\n/search judul lagu\n\nContoh: /search Sheila On 7`,
    search_results:      (q) => `🔍 <b>Hasil Pencarian</b>\nQuery: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 Pilih lagu di bawah:',
    pick_cancelled:      '❌ Pencarian dibatalkan.',
    // Controls
    no_playing:          '❌ Tidak ada lagu yang sedang diputar.',
    already_paused:      '⏸ Sudah di-pause.',
    already_playing:     '▶️ Lagu sudah berjalan.',
    paused:              '⏸ <b>Lagu di-pause.</b>',
    resumed:             '▶️ <b>Lagu dilanjutkan.</b>',
    stopped:             `⏹ <b>Musik dihentikan.</b>\n\n⏳ Userbot keluar otomatis dalam <b>15 menit</b>.`,
    no_next:             '⏭ Lagu terakhir. Antrian habis.',
    no_prev:             '❌ Tidak ada lagu sebelumnya.',
    skipped:             (title) => `⏭ <b>Skip ke:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>Kembali ke:</b> ${title}`,
    all_done:            `✅ <b>Semua lagu selesai diputar.</b>\n\n⏳ Userbot keluar otomatis dalam <b>15 menit</b> jika tidak ada lagu baru.`,
    // Loop
    loop_off:            '🔁 Loop: <b>Mati</b>',
    loop_song:           '🔂 Loop: <b>Lagu ini</b>',
    loop_queue:          '🔁 Loop: <b>Semua antrian</b>',
    loop_toggled:        (mode) => `Loop berganti ke: <b>${mode}</b>`,
    // Volume
    volume_usage:        '❓ Cara pakai: /volume 0-200\nContoh: /volume 80',
    volume_invalid:      '❌ Volume harus antara 0 hingga 200.',
    volume_set:          (v) => `🔊 Volume diatur ke <b>${v}%</b>`,
    // Seek
    seek_usage:          '❓ Cara pakai: /seek 1:30 (menit:detik)\nContoh: /seek 2:45',
    seek_invalid:        '❌ Format waktu tidak valid. Gunakan mm:ss atau ss.',
    seek_done:           (t) => `⏩ Lagu di-seek ke <b>${t}</b>`,
    seek_failed:         '❌ Gagal melakukan seek.',
    // Queue
    queue_empty_view:    `📋 <b>Antrian kosong</b>\n\nGunakan /play untuk menambah lagu.`,
    queue_header:        (total) => `📋 <b>Antrian Lagu</b> (${total} lagu)\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nLoop: ${loop}`,
    queue_page:          (cur, total) => `📄 Halaman ${cur}/${total}`,
    queue_cleared:       `🗑 <b>Antrian dikosongkan.</b>\n\n⏳ Userbot keluar otomatis dalam <b>15 menit</b>.`,
    shuffled:            '🔀 <b>Antrian diacak!</b>',
    no_queue_to_shuffle: '❌ Antrian kosong atau hanya ada 1 lagu.',
    // Remove / Move
    remove_usage:        '❓ Cara pakai: /remove <code>nomor</code>\nContoh: /remove 3',
    remove_invalid:      '❌ Nomor lagu tidak valid.',
    remove_current:      '❌ Tidak bisa menghapus lagu yang sedang diputar.',
    removed:             (title) => `🗑 <b>Dihapus dari antrian:</b> ${title}`,
    move_usage:          '❓ Cara pakai: /move <code>dari</code> <code>ke</code>\nContoh: /move 3 1',
    move_invalid:        '❌ Nomor lagu tidak valid.',
    moved:               (title, pos) => `↕️ <b>${title}</b> dipindah ke posisi #${pos}`,
    // Skip to
    skipto_usage:        '❓ Cara pakai: /skipto <code>nomor</code>\nContoh: /skipto 4',
    skipto_invalid:      '❌ Nomor lagu tidak valid.',
    skipped_to:          (title) => `⏭ <b>Skip ke:</b> ${title}`,
    // Download
    download_usage:      `❓ <b>Cara Pakai:</b>\n\n/download judul lagu\n/download https://youtube.com/...\n\nContoh: /download Dewa 19 Kangen`,
    downloading:         '⏳ Mengunduh audio...',
    download_searching:  '🔍 Mencari lagu...',
    downloading_file:    (title) => `⬇️ Mengunduh: <b>${title}</b>...`,
    file_too_large:      '❌ File terlalu besar (>50MB).',
    download_failed:     (e) => `❌ Gagal download: ${e}`,
    // Lyrics
    lyrics_usage:        '❓ Cara pakai: /lyrics judul lagu\nAtau gunakan saat lagu sedang diputar: /lyrics',
    lyrics_searching:    '🔍 Mencari lirik...',
    lyrics_not_found:    '❌ Lirik tidak ditemukan.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n\n<i>... (lirik terlalu panjang, disingkat)</i>',
    // History
    history_empty:       '📜 <b>Riwayat kosong.</b>\n\nBelum ada lagu yang diputar.',
    history_header:      '📜 <b>Riwayat Lagu Terakhir</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    // Playlist
    playlist_usage:      `📂 <b>Perintah Playlist:</b>\n\n/playlist save &lt;nama&gt; — Simpan antrian\n/playlist load &lt;nama&gt; — Muat playlist\n/playlist list — Daftar playlist\n/playlist delete &lt;nama&gt; — Hapus playlist`,
    playlist_saved:      (name, count) => `✅ Playlist "<b>${name}</b>" disimpan (${count} lagu).`,
    playlist_no_queue:   '❌ Antrian kosong, tidak ada yang disimpan.',
    playlist_loaded:     (name, count) => `✅ Playlist "<b>${name}</b>" dimuat (${count} lagu).`,
    playlist_not_found:  (name) => `❌ Playlist "<b>${name}</b>" tidak ditemukan.`,
    playlist_deleted:    (name) => `🗑 Playlist "<b>${name}</b>" dihapus.`,
    playlist_empty:      '📂 <b>Belum ada playlist tersimpan.</b>',
    playlist_list_hdr:   '📂 <b>Daftar Playlist Tersimpan</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    // Language
    lang_set:            (lang) => `🌐 Bahasa diatur ke: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 Bahasa saat ini: <b>${lang}</b>`,
    lang_list:           `🌐 <b>Bahasa yang tersedia:</b>\n\n🇮🇩 /setlang id — Bahasa Indonesia\n🇬🇧 /setlang en — English\n🇲🇾 /setlang ms — Bahasa Melayu\n🇸🇦 /setlang ar — العربية\n🇹🇷 /setlang tr — Türkçe\n🇷🇺 /setlang ru — Русский`,
    lang_invalid:        '❌ Kode bahasa tidak valid. Gunakan: id, en, ms, ar, tr, ru',
    // Login / Status
    login_private_only:  '❌ Perintah ini hanya bisa dipakai di private chat.',
    logout_done:         '✅ Userbot musik berhasil logout.',
    status_online:       (name, phone) => `✅ <b>Userbot Aktif</b>\n\n👤 Nama: ${name}\n📱 Nomor: ${phone}`,
    status_offline:      '❌ <b>Userbot Belum Login</b>\n\nGunakan /musiclogin untuk login.',
    promote_usage:       '❓ Cara pakai: /promote @username atau reply ke pesan user.',
    promote_done:        (name) => `✅ <b>${name}</b> berhasil dijadikan admin.`,
    promote_failed_msg:  (e) => `❌ Gagal promote: ${e}`,
    // Auto leave
    auto_leave:          '👋 <b>Tidak ada lagu selama 15 menit.</b>\n\nUserbot musik keluar dari grup.',
    // Player UI labels
    ui_now_playing:      'Sedang Diputar',
    ui_status:           'Status',
    ui_queue_info:       'Antrian',
    ui_playing:          'Memutar',
    ui_paused:           'Dijeda',
    ui_songs:            'lagu',
    ui_btn_prev:         '⏮',
    ui_btn_pause:        '⏸ Jeda',
    ui_btn_resume:       '▶️ Lanjut',
    ui_btn_skip:         '⏭',
    ui_btn_stop:         '⏹ Stop',
    ui_btn_queue:        '📋 Antrian',
    ui_btn_loop:         '🔂 Loop',
    ui_btn_loopq:        '🔁 Loop Q',
    ui_btn_shuffle:      '🔀 Acak',
    ui_btn_vol_up:       '🔊+',
    ui_btn_vol_dn:       '🔉-',
    ui_btn_clear:        '🗑 Hapus',
    ui_btn_back:         '◀️ Kembali',
    ui_btn_prev_page:    '◀️',
    ui_btn_next_page:    '▶️',
    ui_btn_lyrics:       '🎤 Lirik',
    ui_btn_save:         '📂 Simpan',
    // Help
    start_text: (botName) => `🎵 <b>Selamat datang di ${botName}!</b>
━━━━━━━━━━━━━━━━━━━━
Bot musik Telegram terlengkap dengan Voice Chat.
<b>🚀 Cara Mulai:</b>
1. Tambahkan bot ke grup
2. Jadikan bot sebagai <b>Admin</b>
3. Ketik /play di grup
<b>📋 Perintah Utama:</b>
▶️ /play &lt;judul/URL&gt; — Putar lagu
🔍 /search &lt;judul&gt; — Cari lagu
📋 /queue — Lihat antrian
🎤 /lyrics — Lirik lagu
⬇️ /download &lt;judul&gt; — Unduh MP3
📂 /playlist — Kelola playlist
🌐 /setlang — Ganti bahasa bot
❓ /musichelp — Bantuan lengkap
<b>🌐 Bahasa:</b>
🇮🇩 ID · 🇬🇧 EN · 🇲🇾 MS · 🇸🇦 AR · 🇹🇷 TR
━━━━━━━━━━━━━━━━━━━━
🔧 Powered by ntgcalls + YouTube`,
    help_text: `🎵 <b>Panduan Bot Musik Lengkap</b>
━━━━━━━━━━━━━━━━━━━━
<b>▶️ Audio (di grup):</b>
/play &lt;judul/URL&gt; — Putar lagu
/search &lt;judul&gt; — Tampilkan 5 pilihan
/skipto &lt;no&gt; — Skip ke nomor antrian
<b>📹 Video (di grup):</b>
/vplay &lt;judul/URL&gt; — Stream video ke VC
/vsearch &lt;judul&gt; — Cari &amp; pilih video
<b>🎛 Kontrol:</b>
/pause /resume /skip /prev /stop
/loop — Ganti mode loop
/seek &lt;mm:ss&gt; — Loncat ke waktu
<b>🔊 Volume &amp; Efek:</b>
/volume &lt;0-200&gt; — Atur volume
/shuffle — Acak antrian
<b>📋 Antrian:</b>
/queue /np /remove &lt;no&gt; /move &lt;dari&gt; &lt;ke&gt;
/history — Riwayat lagu
<b>🎵 Extra:</b>
/lyrics — Lirik lagu
/download &lt;judul&gt; — Unduh MP3
/suggest &lt;artis&gt; — Rekomendasi lagu
/topmix &lt;genre&gt; — Tambah top mix
/songinfo — Info lagu detail
<b>📂 Playlist:</b>
/playlist save/load/list/delete
<b>⚙️ Settings (Admin Grup):</b>
/settings — Menu pengaturan lengkap
/setdjrole &lt;nama&gt; — Set DJ role
/setlogchannel &lt;id&gt; — Set log channel
<b>🌐 Bahasa:</b>
/setlang &lt;id/en/ms/ar/tr&gt;
/language — Daftar bahasa
<b>🤖 Admin Bot:</b>
/musiclogin /listuserbot /deluserbot
/musicstatus /broadcast /broadcastlist
/promote /ping /stats
━━━━━━━━━━━━━━━━━━━━`,
  },
  // ─────────────────────────────────────────
  // 🇬🇧 ENGLISH
  // ─────────────────────────────────────────
  en: {
    only_group:          '❌ This command can only be used in groups.',
    no_permission:       '❌ You do not have permission to do that.',
    unknown_error:       '❌ An unexpected error occurred.',
    cancelled:           '❌ Cancelled.',
    loading:             '⏳ Loading...',
    checking_group:      '🔍 Checking group conditions...',
    bot_not_admin:       `❌ <b>Bot is not admin in this group!</b>\n\nMake the bot an admin with rights:\n• Manage members\n• Manage Voice Chat\n• Invite users\n\nThen try again.`,
    userbot_not_login:   `❌ <b>Music userbot not logged in!</b>\n\nBot admin must login first via:\n<code>/musiclogin</code> in private chat.`,
    inviting_userbot:    '⏳ Inviting music userbot to group...',
    userbot_joined:      '✅ Music userbot joined successfully!',
    invite_failed:       (e) => `❌ <b>Failed to invite music userbot!</b>\n\nError: ${e}\n\nMake sure bot has <b>Invite Users</b> right.`,
    promoting_userbot:   '⏳ Promoting music userbot to admin...',
    userbot_promoted:    '✅ Music userbot promoted to admin!',
    promote_failed:      (e) => `❌ <b>Failed to promote music userbot!</b>\n\nError: ${e}`,
    starting_vc:         '🎙 Starting Voice Chat...',
    vc_started:          '✅ Voice Chat started successfully!',
    vc_failed:           (e) => `❌ <b>Failed to start Voice Chat!</b>\n\nError: ${e}`,
    play_usage:          `❓ <b>Usage:</b>\n\n/play song title\n/play https://youtube.com/watch?v=...\n\nExample: /play Shape of You`,
    fetching_info:       '⏳ Fetching song info...',
    searching_yt:        '🔍 Searching YouTube...',
    not_found:           '❌ Song not found. Try different keywords.',
    starting_play:       '🎶 Starting playback...',
    added_to_queue:      (title, uploader, dur, pos) =>
                           `✅ <b>Added to queue!</b>\n\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 Position: #${pos}`,
    stream_error:        (e) => `❌ <b>Streaming error:</b> ${e}`,
    search_usage:        `❓ <b>Usage:</b>\n\n/search song title\n\nExample: /search Blinding Lights`,
    search_results:      (q) => `🔍 <b>Search Results</b>\nQuery: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 Pick a song below:',
    pick_cancelled:      '❌ Search cancelled.',
    no_playing:          '❌ No song is currently playing.',
    already_paused:      '⏸ Already paused.',
    already_playing:     '▶️ Song is already playing.',
    paused:              '⏸ <b>Song paused.</b>',
    resumed:             '▶️ <b>Song resumed.</b>',
    stopped:             `⏹ <b>Music stopped.</b>\n\n⏳ Userbot will leave automatically in <b>15 minutes</b>.`,
    no_next:             '⏭ Last song. Queue ended.',
    no_prev:             '❌ No previous song.',
    skipped:             (title) => `⏭ <b>Skipped to:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>Back to:</b> ${title}`,
    all_done:            `✅ <b>All songs finished.</b>\n\n⏳ Userbot leaves automatically in <b>15 minutes</b> if no new songs.`,
    loop_off:            '🔁 Loop: <b>Off</b>',
    loop_song:           '🔂 Loop: <b>This Song</b>',
    loop_queue:          '🔁 Loop: <b>Entire Queue</b>',
    loop_toggled:        (mode) => `Loop changed to: <b>${mode}</b>`,
    volume_usage:        '❓ Usage: /volume 0-200\nExample: /volume 80',
    volume_invalid:      '❌ Volume must be between 0 and 200.',
    volume_set:          (v) => `🔊 Volume set to <b>${v}%</b>`,
    seek_usage:          '❓ Usage: /seek 1:30 (min:sec)\nExample: /seek 2:45',
    seek_invalid:        '❌ Invalid time format. Use mm:ss or ss.',
    seek_done:           (t) => `⏩ Seeked to <b>${t}</b>`,
    seek_failed:         '❌ Seek failed.',
    queue_empty_view:    `📋 <b>Queue is empty</b>\n\nUse /play to add songs.`,
    queue_header:        (total) => `📋 <b>Song Queue</b> (${total} songs)\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nLoop: ${loop}`,
    queue_page:          (cur, total) => `📄 Page ${cur}/${total}`,
    queue_cleared:       `🗑 <b>Queue cleared.</b>\n\n⏳ Userbot leaves automatically in <b>15 minutes</b>.`,
    shuffled:            '🔀 <b>Queue shuffled!</b>',
    no_queue_to_shuffle: '❌ Queue is empty or only has 1 song.',
    remove_usage:        '❓ Usage: /remove &lt;number&gt;\nExample: /remove 3',
    remove_invalid:      '❌ Invalid song number.',
    remove_current:      '❌ Cannot remove currently playing song.',
    removed:             (title) => `🗑 <b>Removed from queue:</b> ${title}`,
    move_usage:          '❓ Usage: /move &lt;from&gt; &lt;to&gt;\nExample: /move 3 1',
    move_invalid:        '❌ Invalid song number.',
    moved:               (title, pos) => `↕️ <b>${title}</b> moved to position #${pos}`,
    skipto_usage:        '❓ Usage: /skipto &lt;number&gt;\nExample: /skipto 4',
    skipto_invalid:      '❌ Invalid song number.',
    skipped_to:          (title) => `⏭ <b>Skipped to:</b> ${title}`,
    download_usage:      `❓ <b>Usage:</b>\n\n/download song title\n/download https://youtube.com/...\n\nExample: /download Shape of You`,
    downloading:         '⏳ Downloading audio...',
    download_searching:  '🔍 Searching for song...',
    downloading_file:    (title) => `⬇️ Downloading: <b>${title}</b>...`,
    file_too_large:      '❌ File too large (>50MB).',
    download_failed:     (e) => `❌ Download failed: ${e}`,
    lyrics_usage:        '❓ Usage: /lyrics song title\nOr while a song is playing: /lyrics',
    lyrics_searching:    '🔍 Searching for lyrics...',
    lyrics_not_found:    '❌ Lyrics not found.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n\n<i>... (lyrics too long, truncated)</i>',
    history_empty:       '📜 <b>History is empty.</b>\n\nNo songs have been played yet.',
    history_header:      '📜 <b>Recent Song History</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    playlist_usage:      `📂 <b>Playlist Commands:</b>\n\n/playlist save &lt;name&gt; — Save queue\n/playlist load &lt;name&gt; — Load playlist\n/playlist list — List playlists\n/playlist delete &lt;name&gt; — Delete playlist`,
    playlist_saved:      (name, count) => `✅ Playlist "<b>${name}</b>" saved (${count} songs).`,
    playlist_no_queue:   '❌ Queue is empty, nothing to save.',
    playlist_loaded:     (name, count) => `✅ Playlist "<b>${name}</b>" loaded (${count} songs).`,
    playlist_not_found:  (name) => `❌ Playlist "<b>${name}</b>" not found.`,
    playlist_deleted:    (name) => `🗑 Playlist "<b>${name}</b>" deleted.`,
    playlist_empty:      '📂 <b>No saved playlists.</b>',
    playlist_list_hdr:   '📂 <b>Saved Playlists</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    lang_set:            (lang) => `🌐 Language set to: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 Current language: <b>${lang}</b>`,
    lang_list:           `🌐 <b>Available languages:</b>\n\n🇮🇩 /setlang id — Bahasa Indonesia\n🇬🇧 /setlang en — English\n🇲🇾 /setlang ms — Bahasa Melayu\n🇸🇦 /setlang ar — العربية\n🇹🇷 /setlang tr — Türkçe`,
    lang_invalid:        '❌ Invalid language code. Use: id, en, ms, ar, tr, ru',
    login_private_only:  '❌ This command can only be used in private chat.',
    logout_done:         '✅ Music userbot logged out successfully.',
    status_online:       (name, phone) => `✅ <b>Userbot Active</b>\n\n👤 Name: ${name}\n📱 Phone: ${phone}`,
    status_offline:      '❌ <b>Userbot Not Logged In</b>\n\nUse /musiclogin to login.',
    promote_usage:       '❓ Usage: /promote @username or reply to a user message.',
    promote_done:        (name) => `✅ <b>${name}</b> successfully promoted to admin.`,
    promote_failed_msg:  (e) => `❌ Promotion failed: ${e}`,
    auto_leave:          '👋 <b>No songs for 15 minutes.</b>\n\nMusic userbot has left the group.',
    ui_now_playing:      'Now Playing',
    ui_status:           'Status',
    ui_queue_info:       'Queue',
    ui_playing:          'Playing',
    ui_paused:           'Paused',
    ui_songs:            'songs',
    ui_btn_prev:         '⏮',
    ui_btn_pause:        '⏸ Pause',
    ui_btn_resume:       '▶️ Resume',
    ui_btn_skip:         '⏭',
    ui_btn_stop:         '⏹ Stop',
    ui_btn_queue:        '📋 Queue',
    ui_btn_loop:         '🔂 Loop',
    ui_btn_loopq:        '🔁 Loop Q',
    ui_btn_shuffle:      '🔀 Shuffle',
    ui_btn_vol_up:       '🔊+',
    ui_btn_vol_dn:       '🔉-',
    ui_btn_clear:        '🗑 Clear',
    ui_btn_back:         '◀️ Back',
    ui_btn_prev_page:    '◀️',
    ui_btn_next_page:    '▶️',
    ui_btn_lyrics:       '🎤 Lyrics',
    ui_btn_save:         '📂 Save',
    start_text: (botName) => `🎵 <b>Welcome to ${botName}!</b>
━━━━━━━━━━━━━━━━━━━━
The most complete Telegram music bot with Voice Chat.
<b>🚀 How to Start:</b>
1. Add bot to a group
2. Make bot an <b>Admin</b>
3. Type /play in the group
<b>📋 Main Commands:</b>
▶️ /play &lt;title/URL&gt; — Play song
🔍 /search &lt;title&gt; — Search song
📋 /queue — View queue
🎤 /lyrics — Song lyrics
⬇️ /download &lt;title&gt; — Download MP3
📂 /playlist — Manage playlists
🌐 /setlang — Change language
❓ /musichelp — Full help
<b>🌐 Languages:</b>
🇮🇩 ID · 🇬🇧 EN · 🇲🇾 MS · 🇸🇦 AR · 🇹🇷 TR
━━━━━━━━━━━━━━━━━━━━
🔧 Powered by ntgcalls + YouTube`,
    help_text: `🎵 <b>Complete Music Bot Guide</b>
━━━━━━━━━━━━━━━━━━━━
<b>▶️ Play Music (in group):</b>
/play &lt;title/URL&gt; — Search &amp; play
/search &lt;title&gt; — Show 5 results to pick
/skipto &lt;no&gt; — Skip to queue number
<b>🎛 Playback Controls:</b>
/pause — Pause song
/resume — Resume song
/skip — Next song
/skip &lt;n&gt; — Skip N songs
/prev — Previous song
/stop — Stop music
/loop — Toggle loop mode (off/song/queue)
/seek &lt;mm:ss&gt; — Jump to timestamp
<b>🔊 Volume &amp; Effects:</b>
/volume &lt;0-200&gt; — Set volume
/shuffle — Shuffle queue order
<b>📋 Queue Management:</b>
/queue — View queue
/np — Show active player
/remove &lt;no&gt; — Remove song from queue
/move &lt;from&gt; &lt;to&gt; — Move song position
/history — Song play history
<b>🎤 Lyrics:</b>
/lyrics — Lyrics of current song
/lyrics &lt;title&gt; — Search lyrics
<b>⬇️ Download:</b>
/download &lt;title/URL&gt; — Download MP3
<b>📂 Playlist:</b>
/playlist save &lt;name&gt; — Save queue
/playlist load &lt;name&gt; — Load playlist
/playlist list — List playlists
/playlist delete &lt;name&gt; — Delete playlist
<b>🌐 Language:</b>
/setlang &lt;code&gt; — Change language
/language — List available languages
<b>⚙️ Bot Admin Only:</b>
/musiclogin — Login userbot
/musiclogout — Logout userbot
/musicstatus — Userbot status
/promote &lt;@user/reply&gt; — Promote to admin
⏳ Userbot leaves automatically <b>15 min</b> after queue ends.
━━━━━━━━━━━━━━━━━━━━`,
  },
  // ─────────────────────────────────────────
  // 🇲🇾 BAHASA MELAYU
  // ─────────────────────────────────────────
  ms: {
    only_group:          '❌ Arahan ini hanya boleh digunakan dalam kumpulan.',
    no_permission:       '❌ Anda tidak mempunyai kebenaran untuk itu.',
    unknown_error:       '❌ Ralat tidak dijangka berlaku.',
    cancelled:           '❌ Dibatalkan.',
    loading:             '⏳ Memuatkan...',
    checking_group:      '🔍 Memeriksa keadaan kumpulan...',
    bot_not_admin:       `❌ <b>Bot bukan admin dalam kumpulan ini!</b>\n\nJadikan bot sebagai admin dengan hak:\n• Urus ahli\n• Urus Voice Chat\n• Jemput pengguna\n\nCuba lagi.`,
    userbot_not_login:   `❌ <b>Userbot muzik belum log masuk!</b>\n\nAdmin bot perlu log masuk dahulu melalui:\n<code>/musiclogin</code> dalam chat peribadi.`,
    inviting_userbot:    '⏳ Menjemput userbot muzik ke kumpulan...',
    userbot_joined:      '✅ Userbot muzik berjaya menyertai!',
    invite_failed:       (e) => `❌ <b>Gagal menjemput userbot muzik!</b>\n\nRalat: ${e}`,
    promoting_userbot:   '⏳ Mempromote userbot muzik jadi admin...',
    userbot_promoted:    '✅ Userbot muzik berjaya dijadikan admin!',
    promote_failed:      (e) => `❌ <b>Gagal promote userbot muzik!</b>\n\nRalat: ${e}`,
    starting_vc:         '🎙 Memulakan Voice Chat...',
    vc_started:          '✅ Voice Chat berjaya dimulakan!',
    vc_failed:           (e) => `❌ <b>Gagal memulakan Voice Chat!</b>\n\nRalat: ${e}`,
    play_usage:          `❓ <b>Cara Guna:</b>\n\n/play tajuk lagu\n/play https://youtube.com/watch?v=...\n\nContoh: /play Siti Nurhaliza Cindai`,
    fetching_info:       '⏳ Mendapatkan maklumat lagu...',
    searching_yt:        '🔍 Mencari lagu di YouTube...',
    not_found:           '❌ Lagu tidak dijumpai. Cuba kata kunci lain.',
    starting_play:       '🎶 Memulakan main balik...',
    added_to_queue:      (title, uploader, dur, pos) =>
                           `✅ <b>Ditambah ke giliran!</b>\n\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 Kedudukan: #${pos}`,
    stream_error:        (e) => `❌ <b>Ralat strim:</b> ${e}`,
    search_usage:        `❓ <b>Cara Guna:</b>\n\n/search tajuk lagu\n\nContoh: /search Anuar Zain`,
    search_results:      (q) => `🔍 <b>Keputusan Carian</b>\nQuery: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 Pilih lagu di bawah:',
    pick_cancelled:      '❌ Carian dibatalkan.',
    no_playing:          '❌ Tiada lagu yang sedang dimainkan.',
    already_paused:      '⏸ Sudah dijeda.',
    already_playing:     '▶️ Lagu sudah berjalan.',
    paused:              '⏸ <b>Lagu dijeda.</b>',
    resumed:             '▶️ <b>Lagu diteruskan.</b>',
    stopped:             `⏹ <b>Muzik dihentikan.</b>\n\n⏳ Userbot akan keluar automatik dalam <b>15 minit</b>.`,
    no_next:             '⏭ Lagu terakhir. Giliran habis.',
    no_prev:             '❌ Tiada lagu sebelumnya.',
    skipped:             (title) => `⏭ <b>Skip ke:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>Kembali ke:</b> ${title}`,
    all_done:            `✅ <b>Semua lagu selesai dimainkan.</b>\n\n⏳ Userbot keluar automatik dalam <b>15 minit</b>.`,
    loop_off:            '🔁 Ulang: <b>Mati</b>',
    loop_song:           '🔂 Ulang: <b>Lagu Ini</b>',
    loop_queue:          '🔁 Ulang: <b>Semua Giliran</b>',
    loop_toggled:        (mode) => `Ulang ditukar ke: <b>${mode}</b>`,
    volume_usage:        '❓ Cara guna: /volume 0-200\nContoh: /volume 80',
    volume_invalid:      '❌ Kelantangan mesti antara 0 hingga 200.',
    volume_set:          (v) => `🔊 Kelantangan ditetapkan ke <b>${v}%</b>`,
    seek_usage:          '❓ Cara guna: /seek 1:30 (minit:saat)',
    seek_invalid:        '❌ Format masa tidak sah.',
    seek_done:           (t) => `⏩ Dicari ke <b>${t}</b>`,
    seek_failed:         '❌ Carian gagal.',
    queue_empty_view:    `📋 <b>Giliran kosong</b>\n\nGuna /play untuk tambah lagu.`,
    queue_header:        (total) => `📋 <b>Giliran Lagu</b> (${total} lagu)\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nUlang: ${loop}`,
    queue_page:          (cur, total) => `📄 Halaman ${cur}/${total}`,
    queue_cleared:       `🗑 <b>Giliran dikosongkan.</b>\n\n⏳ Userbot keluar automatik dalam <b>15 minit</b>.`,
    shuffled:            '🔀 <b>Giliran diacak!</b>',
    no_queue_to_shuffle: '❌ Giliran kosong atau hanya ada 1 lagu.',
    remove_usage:        '❓ Cara guna: /remove <code>nombor</code>',
    remove_invalid:      '❌ Nombor lagu tidak sah.',
    remove_current:      '❌ Tidak boleh hapus lagu yang sedang dimainkan.',
    removed:             (title) => `🗑 <b>Dibuang dari giliran:</b> ${title}`,
    move_usage:          '❓ Cara guna: /move <code>dari</code> <code>ke</code>',
    move_invalid:        '❌ Nombor lagu tidak sah.',
    moved:               (title, pos) => `↕️ <b>${title}</b> dipindah ke kedudukan #${pos}`,
    skipto_usage:        '❓ Cara guna: /skipto <code>nombor</code>',
    skipto_invalid:      '❌ Nombor lagu tidak sah.',
    skipped_to:          (title) => `⏭ <b>Skip ke:</b> ${title}`,
    download_usage:      `❓ <b>Cara Guna:</b>\n\n/download tajuk lagu\n/download URL YouTube`,
    downloading:         '⏳ Memuat turun audio...',
    download_searching:  '🔍 Mencari lagu...',
    downloading_file:    (title) => `⬇️ Memuat turun: <b>${title}</b>...`,
    file_too_large:      '❌ Fail terlalu besar (>50MB).',
    download_failed:     (e) => `❌ Muat turun gagal: ${e}`,
    lyrics_usage:        '❓ Cara guna: /lyrics tajuk lagu',
    lyrics_searching:    '🔍 Mencari lirik...',
    lyrics_not_found:    '❌ Lirik tidak dijumpai.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n\n<i>... (lirik terlalu panjang)</i>',
    history_empty:       '📜 <b>Sejarah kosong.</b>',
    history_header:      '📜 <b>Sejarah Lagu Terkini</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    playlist_usage:      `📂 <b>Arahan Senarai Main:</b>\n\n/playlist save &lt;nama&gt;\n/playlist load &lt;nama&gt;\n/playlist list\n/playlist delete &lt;nama&gt;`,
    playlist_saved:      (name, count) => `✅ Senarai main "<b>${name}</b>" disimpan (${count} lagu).`,
    playlist_no_queue:   '❌ Giliran kosong.',
    playlist_loaded:     (name, count) => `✅ Senarai main "<b>${name}</b>" dimuatkan (${count} lagu).`,
    playlist_not_found:  (name) => `❌ Senarai main "<b>${name}</b>" tidak dijumpai.`,
    playlist_deleted:    (name) => `🗑 Senarai main "<b>${name}</b>" dipadam.`,
    playlist_empty:      '📂 <b>Tiada senarai main tersimpan.</b>',
    playlist_list_hdr:   '📂 <b>Senarai Main Tersimpan</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    lang_set:            (lang) => `🌐 Bahasa ditetapkan ke: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 Bahasa semasa: <b>${lang}</b>`,
    lang_list:           `🌐 <b>Bahasa yang tersedia:</b>\n\n🇮🇩 /setlang id — Bahasa Indonesia\n🇬🇧 /setlang en — English\n🇲🇾 /setlang ms — Bahasa Melayu\n🇸🇦 /setlang ar — العربية\n🇹🇷 /setlang tr — Türkçe`,
    lang_invalid:        '❌ Kod bahasa tidak sah. Guna: id, en, ms, ar, tr, ru',
    login_private_only:  '❌ Arahan ini hanya boleh digunakan dalam chat peribadi.',
    logout_done:         '✅ Userbot muzik berjaya log keluar.',
    status_online:       (name, phone) => `✅ <b>Userbot Aktif</b>\n\n👤 Nama: ${name}\n📱 Nombor: ${phone}`,
    status_offline:      '❌ <b>Userbot Tidak Log Masuk</b>\n\nGuna /musiclogin untuk log masuk.',
    promote_usage:       '❓ Cara guna: /promote @username atau balas mesej pengguna.',
    promote_done:        (name) => `✅ <b>${name}</b> berjaya dijadikan admin.`,
    promote_failed_msg:  (e) => `❌ Promosi gagal: ${e}`,
    auto_leave:          '👋 <b>Tiada lagu selama 15 minit.</b>\n\nUserbot muzik telah keluar dari kumpulan.',
    ui_now_playing: 'Sedang Dimainkan', ui_status: 'Status', ui_queue_info: 'Giliran',
    ui_playing: 'Bermain', ui_paused: 'Dijeda', ui_songs: 'lagu',
    ui_btn_prev: '⏮', ui_btn_pause: '⏸ Jeda', ui_btn_resume: '▶️ Terus',
    ui_btn_skip: '⏭', ui_btn_stop: '⏹ Henti', ui_btn_queue: '📋 Giliran',
    ui_btn_loop: '🔂 Ulang', ui_btn_loopq: '🔁 Ulang G', ui_btn_shuffle: '🔀 Kocok',
    ui_btn_vol_up: '🔊+', ui_btn_vol_dn: '🔉-', ui_btn_clear: '🗑 Kosong',
    ui_btn_back: '◀️ Kembali', ui_btn_prev_page: '◀️', ui_btn_next_page: '▶️',
    ui_btn_lyrics: '🎤 Lirik',
    ui_btn_save: '📂 Simpan',
    start_text: (botName) => `🎵 <b>Selamat datang ke ${botName}!</b>
━━━━━━━━━━━━━━━━━━━━
Bot muzik Telegram paling lengkap dengan Voice Chat.
<b>🚀 Cara Mula:</b>
1. Tambah bot ke kumpulan
2. Jadikan bot sebagai <b>Admin</b>
3. Taip /play dalam kumpulan
<b>📋 Arahan Utama:</b>
▶️ /play &lt;tajuk/URL&gt; — Main lagu
🔍 /search &lt;tajuk&gt; — Cari lagu
📋 /queue — Lihat giliran
🎤 /lyrics — Lirik lagu
⬇️ /download &lt;tajuk&gt; — Muat turun MP3
📂 /playlist — Urus senarai main
🌐 /setlang — Tukar bahasa
❓ /musichelp — Bantuan penuh
<b>🌐 Bahasa:</b>
🇮🇩 ID · 🇬🇧 EN · 🇲🇾 MS · 🇸🇦 AR · 🇹🇷 TR
━━━━━━━━━━━━━━━━━━━━
🔧 Powered by ntgcalls + YouTube`,
    help_text: `🎵 <b>Panduan Bot Muzik Lengkap</b>\n━━━━━━━━━━━━━━━━━━━━\n\nGunakan /musichelp dalam bahasa lain untuk panduan penuh.`,
  },
  // ─────────────────────────────────────────
  // 🇸🇦 العربية (Arabic)
  // ─────────────────────────────────────────
  ar: {
    only_group:          '❌ هذا الأمر يعمل فقط في المجموعات.',
    no_permission:       '❌ ليس لديك إذن للقيام بذلك.',
    unknown_error:       '❌ حدث خطأ غير متوقع.',
    cancelled:           '❌ تم الإلغاء.',
    loading:             '⏳ جارٍ التحميل...',
    checking_group:      '🔍 جارٍ التحقق من حالة المجموعة...',
    bot_not_admin:       `❌ <b>البوت ليس مشرفاً في هذه المجموعة!</b>\n\nاجعل البوت مشرفاً مع صلاحيات:\n• إدارة الأعضاء\n• إدارة المكالمات الصوتية\n• دعوة المستخدمين`,
    userbot_not_login:   `❌ <b>يوزربوت الموسيقى غير مسجل الدخول!</b>\n\nيجب على مشرف البوت تسجيل الدخول أولاً عبر:\n<code>/musiclogin</code> في المحادثة الخاصة.`,
    inviting_userbot:    '⏳ جارٍ دعوة يوزربوت الموسيقى...',
    userbot_joined:      '✅ انضم يوزربوت الموسيقى بنجاح!',
    invite_failed:       (e) => `❌ <b>فشل دعوة يوزربوت الموسيقى!</b>\n\nخطأ: ${e}`,
    promoting_userbot:   '⏳ جارٍ ترقية يوزربوت الموسيقى...',
    userbot_promoted:    '✅ تمت ترقية يوزربوت الموسيقى بنجاح!',
    promote_failed:      (e) => `❌ <b>فشل ترقية يوزربوت الموسيقى!</b>\n\nخطأ: ${e}`,
    starting_vc:         '🎙 جارٍ بدء المكالمة الصوتية...',
    vc_started:          '✅ بدأت المكالمة الصوتية بنجاح!',
    vc_failed:           (e) => `❌ <b>فشل بدء المكالمة الصوتية!</b>\n\nخطأ: ${e}`,
    play_usage:          `❓ <b>طريقة الاستخدام:</b>\n\n/play اسم الأغنية\n/play رابط يوتيوب`,
    fetching_info:       '⏳ جارٍ جلب معلومات الأغنية...',
    searching_yt:        '🔍 جارٍ البحث في يوتيوب...',
    not_found:           '❌ لم يتم العثور على الأغنية.',
    starting_play:       '🎶 جارٍ بدء التشغيل...',
    added_to_queue:      (title, uploader, dur, pos) =>
                           `✅ <b>تمت الإضافة إلى قائمة الانتظار!</b>\n\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 الموضع: #${pos}`,
    stream_error:        (e) => `❌ <b>خطأ في البث:</b> ${e}`,
    search_usage:        `❓ <b>طريقة الاستخدام:</b>\n\n/search اسم الأغنية`,
    search_results:      (q) => `🔍 <b>نتائج البحث</b>\nالاستعلام: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 اختر أغنية:',
    pick_cancelled:      '❌ تم إلغاء البحث.',
    no_playing:          '❌ لا توجد أغنية قيد التشغيل.',
    already_paused:      '⏸ الأغنية متوقفة مسبقاً.',
    already_playing:     '▶️ الأغنية تعمل بالفعل.',
    paused:              '⏸ <b>تم إيقاف الأغنية.</b>',
    resumed:             '▶️ <b>تم استئناف الأغنية.</b>',
    stopped:             `⏹ <b>تم إيقاف الموسيقى.</b>\n\n⏳ سيغادر اليوزربوت تلقائياً خلال <b>15 دقيقة</b>.`,
    no_next:             '⏭ آخر أغنية. انتهت القائمة.',
    no_prev:             '❌ لا توجد أغنية سابقة.',
    skipped:             (title) => `⏭ <b>تخطي إلى:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>العودة إلى:</b> ${title}`,
    all_done:            `✅ <b>انتهت جميع الأغاني.</b>\n\n⏳ سيغادر اليوزربوت تلقائياً خلال <b>15 دقيقة</b>.`,
    loop_off:            '🔁 التكرار: <b>إيقاف</b>',
    loop_song:           '🔂 التكرار: <b>هذه الأغنية</b>',
    loop_queue:          '🔁 التكرار: <b>القائمة كلها</b>',
    loop_toggled:        (mode) => `تم تغيير التكرار إلى: <b>${mode}</b>`,
    volume_usage:        '❓ الاستخدام: /volume 0-200',
    volume_invalid:      '❌ يجب أن يكون الصوت بين 0 و 200.',
    volume_set:          (v) => `🔊 تم ضبط الصوت على <b>${v}%</b>`,
    seek_usage:          '❓ الاستخدام: /seek 1:30',
    seek_invalid:        '❌ تنسيق الوقت غير صحيح.',
    seek_done:           (t) => `⏩ تم التقديم إلى <b>${t}</b>`,
    seek_failed:         '❌ فشل التقديم.',
    queue_empty_view:    `📋 <b>القائمة فارغة</b>\n\nاستخدم /play لإضافة أغاني.`,
    queue_header:        (total) => `📋 <b>قائمة الأغاني</b> (${total} أغنية)\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nالتكرار: ${loop}`,
    queue_page:          (cur, total) => `📄 الصفحة ${cur}/${total}`,
    queue_cleared:       `🗑 <b>تم مسح القائمة.</b>`,
    shuffled:            '🔀 <b>تم خلط القائمة!</b>',
    no_queue_to_shuffle: '❌ القائمة فارغة أو تحتوي على أغنية واحدة فقط.',
    remove_usage:        '❓ الاستخدام: /remove <code>رقم</code>',
    remove_invalid:      '❌ رقم الأغنية غير صحيح.',
    remove_current:      '❌ لا يمكن حذف الأغنية الحالية.',
    removed:             (title) => `🗑 <b>تم الحذف من القائمة:</b> ${title}`,
    move_usage:          '❓ الاستخدام: /move &lt;من&gt; &lt;إلى&gt;',
    move_invalid:        '❌ رقم الأغنية غير صحيح.',
    moved:               (title, pos) => `↕️ <b>${title}</b> تم نقلها إلى موضع #${pos}`,
    skipto_usage:        '❓ الاستخدام: /skipto <code>رقم</code>',
    skipto_invalid:      '❌ رقم الأغنية غير صحيح.',
    skipped_to:          (title) => `⏭ <b>تخطي إلى:</b> ${title}`,
    download_usage:      `❓ الاستخدام:\n/download اسم الأغنية\n/download رابط يوتيوب`,
    downloading:         '⏳ جارٍ تحميل الصوت...',
    download_searching:  '🔍 جارٍ البحث...',
    downloading_file:    (title) => `⬇️ جارٍ تحميل: <b>${title}</b>...`,
    file_too_large:      '❌ الملف كبير جداً (>50MB).',
    download_failed:     (e) => `❌ فشل التحميل: ${e}`,
    lyrics_usage:        '❓ الاستخدام: /lyrics اسم الأغنية',
    lyrics_searching:    '🔍 جارٍ البحث عن الكلمات...',
    lyrics_not_found:    '❌ لم يتم العثور على الكلمات.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n\n<i>... (الكلمات طويلة جداً)</i>',
    history_empty:       '📜 <b>السجل فارغ.</b>',
    history_header:      '📜 <b>سجل الأغاني الأخيرة</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    playlist_usage:      `📂 <b>أوامر قائمة التشغيل:</b>\n/playlist save &lt;اسم&gt;\n/playlist load &lt;اسم&gt;\n/playlist list\n/playlist delete &lt;اسم&gt;`,
    playlist_saved:      (name, count) => `✅ تم حفظ "<b>${name}</b>" (${count} أغنية).`,
    playlist_no_queue:   '❌ القائمة فارغة.',
    playlist_loaded:     (name, count) => `✅ تم تحميل "<b>${name}</b>" (${count} أغنية).`,
    playlist_not_found:  (name) => `❌ "<b>${name}</b>" غير موجود.`,
    playlist_deleted:    (name) => `🗑 تم حذف "<b>${name}</b>".`,
    playlist_empty:      '📂 <b>لا توجد قوائم محفوظة.</b>',
    playlist_list_hdr:   '📂 <b>قوائم التشغيل المحفوظة</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    lang_set:            (lang) => `🌐 تم ضبط اللغة على: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 اللغة الحالية: <b>${lang}</b>`,
    lang_list:           `🌐 <b>اللغات المتاحة:</b>\n\n🇮🇩 /setlang id — Bahasa Indonesia\n🇬🇧 /setlang en — English\n🇲🇾 /setlang ms — Bahasa Melayu\n🇸🇦 /setlang ar — العربية\n🇹🇷 /setlang tr — Türkçe`,
    lang_invalid:        '❌ رمز اللغة غير صحيح. استخدم: id, en, ms, ar, tr, ru',
    login_private_only:  '❌ هذا الأمر يعمل فقط في المحادثات الخاصة.',
    logout_done:         '✅ تم تسجيل خروج يوزربوت الموسيقى.',
    status_online:       (name, phone) => `✅ <b>اليوزربوت نشط</b>\n\n👤 الاسم: ${name}\n📱 الهاتف: ${phone}`,
    status_offline:      '❌ <b>اليوزربوت غير مسجل الدخول</b>\n\nاستخدم /musiclogin.',
    promote_usage:       '❓ الاستخدام: /promote @username أو رد على رسالة المستخدم.',
    promote_done:        (name) => `✅ تم ترقية <b>${name}</b> بنجاح.`,
    promote_failed_msg:  (e) => `❌ فشل الترقية: ${e}`,
    auto_leave:          '👋 <b>لم تكن هناك أغاني لمدة 15 دقيقة.</b>\n\nغادر يوزربوت الموسيقى المجموعة.',
    ui_now_playing: 'يعزف الآن', ui_status: 'الحالة', ui_queue_info: 'القائمة',
    ui_playing: 'يعزف', ui_paused: 'متوقف', ui_songs: 'أغانٍ',
    ui_btn_prev: '⏮', ui_btn_pause: '⏸ إيقاف', ui_btn_resume: '▶️ استئناف',
    ui_btn_skip: '⏭', ui_btn_stop: '⏹ أوقف', ui_btn_queue: '📋 القائمة',
    ui_btn_loop: '🔂 تكرار', ui_btn_loopq: '🔁 تكرار ق', ui_btn_shuffle: '🔀 خلط',
    ui_btn_vol_up: '🔊+', ui_btn_vol_dn: '🔉-', ui_btn_clear: '🗑 مسح',
    ui_btn_back: '◀️ رجوع', ui_btn_prev_page: '◀️', ui_btn_next_page: '▶️',
    ui_btn_lyrics: '🎤 كلمات',
    ui_btn_save: '📂 حفظ',
    start_text: (botName) => `🎵 <b>مرحباً بك في ${botName}!</b>
━━━━━━━━━━━━━━━━━━━━
أفضل بوت موسيقى تيليغرام مع Voice Chat.
<b>🚀 كيف تبدأ:</b>
1. أضف البوت إلى مجموعة
2. اجعل البوت <b>مشرفاً</b>
3. اكتب /play في المجموعة
<b>📋 الأوامر الرئيسية:</b>
▶️ /play &lt;عنوان/رابط&gt; — تشغيل أغنية
🔍 /search &lt;عنوان&gt; — بحث
📋 /queue — قائمة الانتظار
🎤 /lyrics — كلمات الأغنية
⬇️ /download &lt;عنوان&gt; — تحميل MP3
📂 /playlist — إدارة القوائم
🌐 /setlang — تغيير اللغة
❓ /musichelp — المساعدة الكاملة
<b>🌐 اللغات:</b>
🇮🇩 ID · 🇬🇧 EN · 🇲🇾 MS · 🇸🇦 AR · 🇹🇷 TR
━━━━━━━━━━━━━━━━━━━━
🔧 Powered by ntgcalls + YouTube`,
    help_text: `🎵 <b>دليل بوت الموسيقى الكامل</b>\n━━━━━━━━━━━━━━━━━━━━\n\nالأوامر متاحة، استخدم /musichelp للمزيد.`,
  },
  // ─────────────────────────────────────────
  // 🇹🇷 TÜRKÇE
  // ─────────────────────────────────────────
  tr: {
    only_group:          '❌ Bu komut yalnızca gruplarda kullanılabilir.',
    no_permission:       '❌ Bunu yapmak için izniniz yok.',
    unknown_error:       '❌ Beklenmeyen bir hata oluştu.',
    cancelled:           '❌ İptal edildi.',
    loading:             '⏳ Yükleniyor...',
    checking_group:      '🔍 Grup durumu kontrol ediliyor...',
    bot_not_admin:       `❌ <b>Bot bu grupta yönetici değil!</b>\n\nBotu şu haklarla yönetici yapın:\n• Üyeleri yönet\n• Sesli Sohbeti yönet\n• Kullanıcı davet et`,
    userbot_not_login:   `❌ <b>Müzik userbotu giriş yapmamış!</b>\n\nBot yöneticisi önce giriş yapmalıdır:\n<code>/musiclogin</code> özel sohbette.`,
    inviting_userbot:    '⏳ Müzik userbotu gruba davet ediliyor...',
    userbot_joined:      '✅ Müzik userbotu başarıyla katıldı!',
    invite_failed:       (e) => `❌ <b>Müzik userbotu davet edilemedi!</b>\n\nHata: ${e}`,
    promoting_userbot:   '⏳ Müzik userbotu yöneticiye yükseltiliyor...',
    userbot_promoted:    '✅ Müzik userbotu yönetici yapıldı!',
    promote_failed:      (e) => `❌ <b>Yükseltme başarısız!</b>\n\nHata: ${e}`,
    starting_vc:         '🎙 Sesli Sohbet başlatılıyor...',
    vc_started:          '✅ Sesli Sohbet başarıyla başlatıldı!',
    vc_failed:           (e) => `❌ <b>Sesli Sohbet başlatılamadı!</b>\n\nHata: ${e}`,
    play_usage:          `❓ <b>Kullanım:</b>\n\n/play şarkı adı\n/play YouTube URL`,
    fetching_info:       '⏳ Şarkı bilgisi alınıyor...',
    searching_yt:        '🔍 YouTube\'da aranıyor...',
    not_found:           '❌ Şarkı bulunamadı.',
    starting_play:       '🎶 Oynatma başlatılıyor...',
    added_to_queue:      (title, uploader, dur, pos) =>
                           `✅ <b>Kuyruğa eklendi!</b>\n\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 Konum: #${pos}`,
    stream_error:        (e) => `❌ <b>Yayın hatası:</b> ${e}`,
    search_usage:        `❓ <b>Kullanım:</b>\n\n/search şarkı adı`,
    search_results:      (q) => `🔍 <b>Arama Sonuçları</b>\nSorgu: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 Aşağıdan şarkı seçin:',
    pick_cancelled:      '❌ Arama iptal edildi.',
    no_playing:          '❌ Şu anda çalan şarkı yok.',
    already_paused:      '⏸ Zaten duraklatıldı.',
    already_playing:     '▶️ Şarkı zaten çalıyor.',
    paused:              '⏸ <b>Şarkı duraklatıldı.</b>',
    resumed:             '▶️ <b>Şarkı devam ettirildi.</b>',
    stopped:             `⏹ <b>Müzik durduruldu.</b>\n\n⏳ Userbot <b>15 dakika</b> içinde otomatik ayrılacak.`,
    no_next:             '⏭ Son şarkı. Kuyruk bitti.',
    no_prev:             '❌ Önceki şarkı yok.',
    skipped:             (title) => `⏭ <b>Atlandı:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>Geri dönüldü:</b> ${title}`,
    all_done:            `✅ <b>Tüm şarkılar bitti.</b>\n\n⏳ Userbot <b>15 dakika</b> içinde ayrılacak.`,
    loop_off:            '🔁 Döngü: <b>Kapalı</b>',
    loop_song:           '🔂 Döngü: <b>Bu Şarkı</b>',
    loop_queue:          '🔁 Döngü: <b>Tüm Kuyruk</b>',
    loop_toggled:        (mode) => `Döngü değiştirildi: <b>${mode}</b>`,
    volume_usage:        '❓ Kullanım: /volume 0-200',
    volume_invalid:      '❌ Ses seviyesi 0 ile 200 arasında olmalıdır.',
    volume_set:          (v) => `🔊 Ses <b>${v}%</b> olarak ayarlandı`,
    seek_usage:          '❓ Kullanım: /seek 1:30',
    seek_invalid:        '❌ Geçersiz zaman formatı.',
    seek_done:           (t) => `⏩ <b>${t}</b> konumuna gidildi`,
    seek_failed:         '❌ Seek başarısız.',
    queue_empty_view:    `📋 <b>Kuyruk boş</b>\n\nŞarkı eklemek için /play kullanın.`,
    queue_header:        (total) => `📋 <b>Şarkı Kuyruğu</b> (${total} şarkı)\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nDöngü: ${loop}`,
    queue_page:          (cur, total) => `📄 Sayfa ${cur}/${total}`,
    queue_cleared:       `🗑 <b>Kuyruk temizlendi.</b>`,
    shuffled:            '🔀 <b>Kuyruk karıştırıldı!</b>',
    no_queue_to_shuffle: '❌ Kuyruk boş veya yalnızca 1 şarkı var.',
    remove_usage:        '❓ Kullanım: /remove <code>numara</code>',
    remove_invalid:      '❌ Geçersiz şarkı numarası.',
    remove_current:      '❌ Çalan şarkı kaldırılamaz.',
    removed:             (title) => `🗑 <b>Kuyruktan kaldırıldı:</b> ${title}`,
    move_usage:          '❓ Kullanım: /move <code>nereden</code> <code>nereye</code>',
    move_invalid:        '❌ Geçersiz şarkı numarası.',
    moved:               (title, pos) => `↕️ <b>${title}</b> #${pos} konumuna taşındı`,
    skipto_usage:        '❓ Kullanım: /skipto <code>numara</code>',
    skipto_invalid:      '❌ Geçersiz şarkı numarası.',
    skipped_to:          (title) => `⏭ <b>Atlandı:</b> ${title}`,
    download_usage:      `❓ Kullanım:\n/download şarkı adı\n/download YouTube URL`,
    downloading:         '⏳ Ses indiriliyor...',
    download_searching:  '🔍 Şarkı aranıyor...',
    downloading_file:    (title) => `⬇️ İndiriliyor: <b>${title}</b>...`,
    file_too_large:      '❌ Dosya çok büyük (>50MB).',
    download_failed:     (e) => `❌ İndirme başarısız: ${e}`,
    lyrics_usage:        '❓ Kullanım: /lyrics şarkı adı',
    lyrics_searching:    '🔍 Sözler aranıyor...',
    lyrics_not_found:    '❌ Sözler bulunamadı.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n\n<i>... (sözler çok uzun)</i>',
    history_empty:       '📜 <b>Geçmiş boş.</b>',
    history_header:      '📜 <b>Son Çalınan Şarkılar</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    playlist_usage:      `📂 <b>Çalma Listesi Komutları:</b>\n/playlist save &lt;ad&gt;\n/playlist load &lt;ad&gt;\n/playlist list\n/playlist delete &lt;ad&gt;`,
    playlist_saved:      (name, count) => `✅ "<b>${name}</b>" kaydedildi (${count} şarkı).`,
    playlist_no_queue:   '❌ Kuyruk boş.',
    playlist_loaded:     (name, count) => `✅ "<b>${name}</b>" yüklendi (${count} şarkı).`,
    playlist_not_found:  (name) => `❌ "<b>${name}</b>" bulunamadı.`,
    playlist_deleted:    (name) => `🗑 "<b>${name}</b>" silindi.`,
    playlist_empty:      '📂 <b>Kayıtlı çalma listesi yok.</b>',
    playlist_list_hdr:   '📂 <b>Kayıtlı Çalma Listeleri</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    lang_set:            (lang) => `🌐 Dil ayarlandı: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 Mevcut dil: <b>${lang}</b>`,
    lang_list:           `🌐 <b>Mevcut diller:</b>\n\n🇮🇩 /setlang id — Bahasa Indonesia\n🇬🇧 /setlang en — English\n🇲🇾 /setlang ms — Bahasa Melayu\n🇸🇦 /setlang ar — العربية\n🇹🇷 /setlang tr — Türkçe`,
    lang_invalid:        '❌ Geçersiz dil kodu. Kullanın: id, en, ms, ar, tr, ru',
    login_private_only:  '❌ Bu komut yalnızca özel sohbette kullanılabilir.',
    logout_done:         '✅ Müzik userbotu başarıyla çıkış yaptı.',
    status_online:       (name, phone) => `✅ <b>Userbot Aktif</b>\n\n👤 Ad: ${name}\n📱 Telefon: ${phone}`,
    status_offline:      '❌ <b>Userbot Giriş Yapmamış</b>\n\n/musiclogin kullanın.',
    promote_usage:       '❓ Kullanım: /promote @kullanici veya mesaja yanıt.',
    promote_done:        (name) => `✅ <b>${name}</b> başarıyla yönetici yapıldı.`,
    promote_failed_msg:  (e) => `❌ Yükseltme başarısız: ${e}`,
    auto_leave:          '👋 <b>15 dakikadır şarkı yok.</b>\n\nMüzik userbotu gruptan ayrıldı.',
    ui_now_playing: 'Şu An Çalıyor', ui_status: 'Durum', ui_queue_info: 'Kuyruk',
    ui_playing: 'Çalıyor', ui_paused: 'Durakladı', ui_songs: 'şarkı',
    ui_btn_prev: '⏮', ui_btn_pause: '⏸ Duraklat', ui_btn_resume: '▶️ Devam',
    ui_btn_skip: '⏭', ui_btn_stop: '⏹ Durdur', ui_btn_queue: '📋 Kuyruk',
    ui_btn_loop: '🔂 Döngü', ui_btn_loopq: '🔁 Döngü K', ui_btn_shuffle: '🔀 Karıştır',
    ui_btn_vol_up: '🔊+', ui_btn_vol_dn: '🔉-', ui_btn_clear: '🗑 Temizle',
    ui_btn_back: '◀️ Geri', ui_btn_prev_page: '◀️', ui_btn_next_page: '▶️',
    ui_btn_lyrics: '🎤 Sözler',
    ui_btn_save: '📂 Kaydet',
    start_text: (botName) => `🎵 <b>${botName}'e Hoş Geldiniz!</b>
━━━━━━━━━━━━━━━━━━━━
Voice Chat destekli en kapsamlı Telegram müzik botu.
<b>🚀 Nasıl Başlanır:</b>
1. Botu bir gruba ekleyin
2. Botu <b>Yönetici</b> yapın
3. Grupta /play yazın
<b>📋 Ana Komutlar:</b>
▶️ /play &lt;başlık/URL&gt; — Şarkı çal
🔍 /search &lt;başlık&gt; — Şarkı ara
📋 /queue — Kuyruğu görüntüle
🎤 /lyrics — Şarkı sözleri
⬇️ /download &lt;başlık&gt; — MP3 indir
📂 /playlist — Çalma listesi yönet
🌐 /setlang — Dil değiştir
❓ /musichelp — Tam yardım
<b>🌐 Diller:</b>
🇮🇩 ID · 🇬🇧 EN · 🇲🇾 MS · 🇸🇦 AR · 🇹🇷 TR
━━━━━━━━━━━━━━━━━━━━
🔧 Powered by ntgcalls + YouTube`,
    help_text: `🎵 <b>Eksiksiz Müzik Botu Kılavuzu</b>\n━━━━━━━━━━━━━━━━━━━━\n\nKomutlar kullanılabilir. Tam kılavuz için /musichelp kullanın.`,
  },
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // 🇷🇺 РУССКИЙ (Russian)
  // ─────────────────────────────────────────
  ru: {
    only_group:          '❌ Эта команда работает только в группах.',
    no_permission:       '❌ У вас нет прав для этого.',
    unknown_error:       '❌ Произошла непредвиденная ошибка.',
    cancelled:           '❌ Отменено.',
    loading:             '⏳ Загрузка...',
    checking_group:      '🔍 Проверка группы...',
    bot_not_admin:       '❌ <b>Бот не администратор!</b>',
    userbot_not_login:   '❌ <b>Юзербот не вошёл!</b> Используйте /musiclogin.',
    inviting_userbot:    '⏳ Приглашаю юзербот...',
    userbot_joined:      '✅ Юзербот присоединился!',
    invite_failed:       (e) => `❌ Ошибка приглашения: ${e}`,
    promoting_userbot:   '⏳ Назначаю администратором...',
    userbot_promoted:    '✅ Юзербот назначен администратором!',
    promote_failed:      (e) => `❌ Ошибка назначения: ${e}`,
    starting_vc:         '🎙 Запускаю голосовой чат...',
    vc_started:          '✅ Голосовой чат запущен!',
    vc_failed:           (e) => `❌ Ошибка голосового чата: ${e}`,
    play_usage:          '❓ <b>Использование:</b> /play название или URL',
    fetching_info:       '⏳ Получаю информацию...',
    searching_yt:        '🔍 Поиск на YouTube...',
    not_found:           '❌ Трек не найден.',
    starting_play:       '🎶 Запускаю воспроизведение...',
    added_to_queue:      (title, uploader, dur, pos) => `✅ <b>Добавлено!</b>\n🎵 ${title}\n👤 ${uploader}\n⏱ ${dur}\n📋 #${pos}`,
    stream_error:        (e) => `❌ <b>Ошибка стриминга:</b> ${e}`,
    search_usage:        '❓ <b>Использование:</b> /search название',
    search_results:      (q) => `🔍 <b>Результаты</b>\nЗапрос: <i>${q}</i>\n━━━━━━━━━━━━━━━━━━━━\n`,
    search_pick_hint:    '\n━━━━━━━━━━━━━━━━━━━━\n🎵 Выберите трек:',
    pick_cancelled:      '❌ Поиск отменён.',
    no_playing:          '❌ Сейчас ничего не играет.',
    already_paused:      '⏸ Уже на паузе.',
    already_playing:     '▶️ Трек уже воспроизводится.',
    paused:              '⏸ <b>Пауза.</b>',
    resumed:             '▶️ <b>Возобновлено.</b>',
    stopped:             '⏹ <b>Остановлено.</b> Юзербот выйдет через 15 мин.',
    no_next:             '⏭ Последний трек.',
    no_prev:             '❌ Нет предыдущего.',
    skipped:             (title) => `⏭ <b>Следующий:</b> ${title}`,
    prev_track:          (title) => `⏮ <b>Предыдущий:</b> ${title}`,
    all_done:            '✅ <b>Все треки воспроизведены.</b>',
    loop_off:            '🔁 Повтор: <b>Выкл</b>',
    loop_song:           '🔂 Повтор: <b>Этот трек</b>',
    loop_queue:          '🔁 Повтор: <b>Вся очередь</b>',
    loop_toggled:        (mode) => `Повтор: <b>${mode}</b>`,
    volume_usage:        '❓ /volume 0-200',
    volume_invalid:      '❌ Громкость: 0-200.',
    volume_set:          (v) => `🔊 Громкость: <b>${v}%</b>`,
    seek_usage:          '❓ /seek мм:сс',
    seek_invalid:        '❌ Неверный формат.',
    seek_done:           (t) => `⏩ Перемотка: <b>${t}</b>`,
    seek_failed:         '❌ Ошибка перемотки.',
    queue_empty_view:    '📋 <b>Очередь пуста.</b>',
    queue_header:        (total) => `📋 <b>Очередь</b> (${total})\n━━━━━━━━━━━━━━━━━━━━\n`,
    queue_footer:        (loop) => `\n━━━━━━━━━━━━━━━━━━━━\nПовтор: ${loop}`,
    queue_page:          (cur, total) => `📄 Стр. ${cur}/${total}`,
    queue_cleared:       '🗑 <b>Очередь очищена.</b>',
    shuffled:            '🔀 <b>Перемешано!</b>',
    no_queue_to_shuffle: '❌ Очередь пуста или 1 трек.',
    remove_usage:        '❓ /remove <code>номер</code>',
    remove_invalid:      '❌ Неверный номер.',
    remove_current:      '❌ Нельзя удалить текущий.',
    removed:             (title) => `🗑 <b>Удалено:</b> ${title}`,
    move_usage:          '❓ /move <code>от</code> <code>до</code>',
    move_invalid:        '❌ Неверный номер.',
    moved:               (title, pos) => `↕️ <b>${title}</b> → #${pos}`,
    skipto_usage:        '❓ /skipto <code>номер</code>',
    skipto_invalid:      '❌ Неверный номер.',
    skipped_to:          (title) => `⏭ <b>К треку:</b> ${title}`,
    download_usage:      '❓ /download название или URL',
    downloading:         '⏳ Загрузка аудио...',
    download_searching:  '🔍 Поиск...',
    downloading_file:    (title) => `⬇️ Загружаю: <b>${title}</b>...`,
    file_too_large:      '❌ Файл > 50MB.',
    download_failed:     (e) => `❌ Ошибка: ${e}`,
    lyrics_usage:        '❓ /lyrics название',
    lyrics_searching:    '🔍 Ищу текст...',
    lyrics_not_found:    '❌ Текст не найден.',
    lyrics_header:       (title, artist) => `🎤 <b>${title}</b>\n👤 ${artist}\n━━━━━━━━━━━━━━━━━━━━\n`,
    lyrics_footer:       '\n━━━━━━━━━━━━━━━━━━━━',
    lyrics_too_long:     '\n<i>... (слишком длинный)</i>',
    history_empty:       '📜 <b>История пуста.</b>',
    history_header:      '📜 <b>История</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    playlist_usage:      '📂 /playlist save/load/list/delete <code>имя</code>',
    playlist_saved:      (name, count) => `✅ "<b>${name}</b>" (${count} тр.)`,
    playlist_no_queue:   '❌ Очередь пуста.',
    playlist_loaded:     (name, count) => `✅ "<b>${name}</b>" загружен (${count} тр.)`,
    playlist_not_found:  (name) => `❌ "<b>${name}</b>" не найден.`,
    playlist_deleted:    (name) => `🗑 "<b>${name}</b>" удалён.`,
    playlist_empty:      '📂 <b>Нет плейлистов.</b>',
    playlist_list_hdr:   '📂 <b>Плейлисты</b>\n━━━━━━━━━━━━━━━━━━━━\n',
    lang_set:            (lang) => `🌐 Язык: <b>${lang}</b>`,
    lang_current:        (lang) => `🌐 Текущий: <b>${lang}</b>`,
    lang_list:           '🌐 <b>Языки:</b> id · en · ms · ar · tr · ru',
    lang_invalid:        '❌ Код: id, en, ms, ar, tr, ru',
    login_private_only:  '❌ Только в личном чате.',
    logout_done:         '✅ Юзербот вышел.',
    status_online:       (name, phone) => `✅ <b>Юзербот активен</b>\n👤 ${name}\n📱 ${phone}`,
    status_offline:      '❌ <b>Юзербот не вошёл.</b>',
    promote_usage:       '❓ /promote @username',
    promote_done:        (name) => `✅ <b>${name}</b> администратор.`,
    promote_failed_msg:  (e) => `❌ Ошибка: ${e}`,
    auto_leave:          '👋 Нет треков 15 мин. Юзербот покинул группу.',
    ui_now_playing: 'Сейчас играет', ui_status: 'Статус', ui_queue_info: 'Очередь',
    ui_playing: 'Играет', ui_paused: 'Пауза', ui_songs: 'треков',
    ui_btn_prev: '⏮', ui_btn_pause: '⏸ Пауза', ui_btn_resume: '▶️ Продолжить',
    ui_btn_skip: '⏭', ui_btn_stop: '⏹ Стоп', ui_btn_queue: '📋 Очередь',
    ui_btn_loop: '🔂 Повтор', ui_btn_loopq: '🔁 Повтор О', ui_btn_shuffle: '🔀 Перемешать',
    ui_btn_vol_up: '🔊+', ui_btn_vol_dn: '🔉-', ui_btn_clear: '🗑 Очистить',
    ui_btn_back: '◀️ Назад', ui_btn_prev_page: '◀️', ui_btn_next_page: '▶️',
    ui_btn_lyrics: '🎤 Текст',
    ui_btn_save: '📂 Сохранить',
    start_text: (botName) => `🎵 <b>${botName}</b>\n━━━━━━━━━━━━━━━━━━\nМузыкальный бот с голосовым чатом\.`,
    help_text: `🎵 <b>Руководство</b>\n━━━━━━━━━━━━━━━━━━━━\n/play · /search · /pause · /resume\n/skip · /stop · /queue · /lyrics\n/download · /playlist · /settings\n━━━━━━━━━━━━━━━━━━━━`,
  },
};


// ─────────────────────────────────────────
// Translation getter
// ─────────────────────────────────────────
const SUPPORTED_LANGS = ['id', 'en', 'ms', 'ar', 'tr', 'ru'];
const DEFAULT_LANG    = 'id';
/**
 * Get translation string for a key in given language
 * @param {string} lang - language code
 * @param {string} key  - translation key
 * @param {...any} args - arguments for function-type translations
 */
function t(lang, key, ...args) {
  const lng  = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const dict = translations[lng] || translations[DEFAULT_LANG];
  const val  = dict[key] ?? translations[DEFAULT_LANG][key];
  if (typeof val === 'function') return val(...args);
  return val ?? `[${key}]`;
}
module.exports = { t, SUPPORTED_LANGS, DEFAULT_LANG, translations };
// Tambahan key untuk /start
// (diinjeksikan ke tiap bahasa via patch di bawah)
