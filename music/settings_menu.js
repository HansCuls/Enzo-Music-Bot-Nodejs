// ==========================================
// FILE: music/settings_menu.js
// Interactive settings panel dengan tombol
// Khusus admin grup
// ==========================================

const { Markup } = require('telegraf');
const { safeEdit } = require('./ui');
const { safe, writeLog } = require('./error_handler');
const S = require('./settings');

// ─── Permission check ─────────────────────
async function isGroupAdmin(ctx, chatId) {
  try {
    const m = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    return ['administrator', 'creator'].includes(m.status);
  } catch { return false; }
}

// ─── Build settings text ──────────────────
function buildSettingsText(chatId) {
  const s   = S.getSettings(chatId);
  const aq  = S.AUDIO_QUALITY[s.audioQuality];
  const vq  = S.VIDEO_QUALITY[s.videoQuality];
  const ad  = s.autoDelete === 0 ? '➖ Off' : `${s.autoDelete}s`;
  const al  = s.autoLeave ? `✅ ${s.autoLeaveTime} menit` : '➖ Off';
  const pm  = { all:'👥 Semua', admin:'👑 Admin', dj:'🎧 DJ' }[s.playMode] || s.playMode;
  const lp  = { id:'🇮🇩', en:'🇬🇧', ms:'🇲🇾', ar:'🇸🇦', tr:'🇹🇷', ru:'🇷🇺' }[s.lang] || s.lang;
  const djr = s.djRole ? `@${s.djRole}` : '➖';
  const lch = s.logChannel ? `<code>${s.logChannel}</code>` : '➖';

  return `<blockquote>⚙️ <b>Pengaturan Grup</b>
━━━━━━━━━━━━━━━━━━━━
🔈 Kualitas Audio  : <b>${aq?.label || s.audioQuality}</b>
📹 Kualitas Video  : <b>${vq?.label || s.videoQuality}</b>
🔊 Volume          : <b>${s.volume}%</b>
🗑 Auto Delete     : <b>${ad}</b>
🎵 Mode Play       : <b>${pm}</b>
⏱ Auto Leave      : <b>${al}</b>
🎧 DJ Role         : <b>${djr}</b>
📢 Log Channel     : ${lch}
🌐 Bahasa          : ${lp}
━━━━━━━━━━━━━━━━━━━━</blockquote>`;
}

function buildSettingsButtons(chatId) {
  const s = S.getSettings(chatId);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔈 Kualitas Audio', `set_menu_audio_${chatId}`),
      Markup.button.callback('📹 Kualitas Video', `set_menu_video_${chatId}`),
    ],
    [
      Markup.button.callback('🔊 Volume', `set_menu_volume_${chatId}`),
      Markup.button.callback('🗑 Auto-Delete', `set_menu_autodel_${chatId}`),
    ],
    [
      Markup.button.callback('🎮 Mode Play', `set_menu_playmode_${chatId}`),
      Markup.button.callback('⏱ Auto-Leave', `set_menu_autoleave_${chatId}`),
    ],
    [
      Markup.button.callback('📋 Max Antrian', `set_menu_maxqueue_${chatId}`),
      Markup.button.callback(s.noDuplicate ? '🚫 Duplikat: ON' : '🚫 Duplikat: OFF', `set_toggle_nodup_${chatId}`),
    ],
    [
      Markup.button.callback(s.djMode ? '🎧 DJ Mode: ON' : '🎧 DJ Mode: OFF', `set_toggle_djmode_${chatId}`),
      Markup.button.callback('📢 Log Channel', `set_menu_log_${chatId}`),
    ],
    [
      Markup.button.callback('🌐 Bahasa', `set_menu_lang_${chatId}`),
      Markup.button.callback('🔄 Reset Default', `set_reset_${chatId}`),
    ],
    [
      Markup.button.callback('❌ Tutup', `set_close_${chatId}`),
    ],
  ]);
}

// ─── Sub-menu builders ────────────────────
function audioQualityButtons(chatId) {
  const cur = S.getAudioQuality(chatId);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(cur==='low'   ? '✅ 🔈 Low (64kbps)'    : '🔈 Low (64kbps)',    `set_audio_low_${chatId}`),
    ],
    [
      Markup.button.callback(cur==='medium'? '✅ 🔉 Medium (128kbps)' : '🔉 Medium (128kbps)',`set_audio_medium_${chatId}`),
    ],
    [
      Markup.button.callback(cur==='high'  ? '✅ 🔊 High (320kbps)'  : '🔊 High (320kbps)',  `set_audio_high_${chatId}`),
    ],
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function videoQualityButtons(chatId) {
  const cur = S.getVideoQuality(chatId);
  return Markup.inlineKeyboard([
    [Markup.button.callback(cur==='low'   ?'✅ 📱 Low (360p)'   :'📱 Low (360p)',    `set_video_low_${chatId}`)],
    [Markup.button.callback(cur==='medium'?'✅ 💻 Medium (480p)':'💻 Medium (480p)', `set_video_medium_${chatId}`)],
    [Markup.button.callback(cur==='high'  ?'✅ 🖥 High (720p)'  :'🖥 High (720p)',   `set_video_high_${chatId}`)],
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function autoDeleteButtons(chatId) {
  const cur = S.getAutoDelete(chatId);
  const opts = [[0,'❌ Off'],[5,'5 detik'],[10,'10 detik'],[30,'30 detik'],[60,'1 menit']];
  return Markup.inlineKeyboard([
    ...opts.map(([v, label]) => [
      Markup.button.callback(cur===v ? `✅ ${label}` : label, `set_autodel_${v}_${chatId}`)
    ]),
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function playModeButtons(chatId) {
  const cur = S.getPlayMode(chatId);
  return Markup.inlineKeyboard([
    [Markup.button.callback(cur==='all'  ?'✅ 👥 Semua Anggota':'👥 Semua Anggota',   `set_play_all_${chatId}`)],
    [Markup.button.callback(cur==='admin'?'✅ 👑 Admin Saja'   :'👑 Admin Saja',       `set_play_admin_${chatId}`)],
    [Markup.button.callback(cur==='dj'   ?'✅ 🎧 DJ Role Saja' :'🎧 DJ Role Saja',    `set_play_dj_${chatId}`)],
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function autoLeaveButtons(chatId) {
  const s    = S.getSettings(chatId);
  const isOn = s.autoLeave;
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(isOn ? '✅ Auto-Leave: ON' : 'Auto-Leave: ON',   `set_autoleave_on_${chatId}`),
      Markup.button.callback(!isOn? '✅ Auto-Leave: OFF': 'Auto-Leave: OFF',  `set_autoleave_off_${chatId}`),
    ],
    ...(isOn ? [
      [
        Markup.button.callback(s.autoLeaveTime===5 ?'✅ 5 mnt':'5 mnt',   `set_altime_5_${chatId}`),
        Markup.button.callback(s.autoLeaveTime===10?'✅ 10 mnt':'10 mnt', `set_altime_10_${chatId}`),
        Markup.button.callback(s.autoLeaveTime===15?'✅ 15 mnt':'15 mnt', `set_altime_15_${chatId}`),
      ],
      [
        Markup.button.callback(s.autoLeaveTime===30?'✅ 30 mnt':'30 mnt', `set_altime_30_${chatId}`),
        Markup.button.callback(s.autoLeaveTime===60?'✅ 1 jam':'1 jam',   `set_altime_60_${chatId}`),
      ],
    ] : []),
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function maxQueueButtons(chatId) {
  const cur  = S.getMaxQueue(chatId);
  const opts = [[0,'♾ Unlimited'],[10,'10 lagu'],[20,'20 lagu'],[50,'50 lagu'],[100,'100 lagu']];
  return Markup.inlineKeyboard([
    ...opts.map(([v, label]) => [
      Markup.button.callback(cur===v ? `✅ ${label}` : label, `set_maxq_${v}_${chatId}`)
    ]),
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function volumeButtons(chatId) {
  const cur = S.getVolume(chatId);
  const opts = [[50,'50%'],[75,'75%'],[100,'100%'],[150,'150%'],[200,'200%']];
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔉 -10', `set_voladd_-10_${chatId}`),
      Markup.button.callback(`🔊 ${cur}%`, `set_vol_noop_${chatId}`),
      Markup.button.callback('🔊 +10', `set_voladd_10_${chatId}`),
    ],
    opts.reduce((rows, [v, label], i) => {
      if (i % 3 === 0) rows.push([]);
      rows[rows.length-1].push(Markup.button.callback(cur===v?`✅ ${label}`:label, `set_vol_${v}_${chatId}`));
      return rows;
    }, []).flat().reduce((rows, btn, i) => {
      if (i % 3 === 0) rows.push([]);
      rows[rows.length-1].push(btn);
      return rows;
    }, []),
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

function langButtons(chatId) {
  const cur = S.getLang(chatId);
  const langs = [
    ['id','🇮🇩 Indonesia'],['en','🇬🇧 English'],['ms','🇲🇾 Melayu'],
    ['ar','🇸🇦 العربية'],['tr','🇹🇷 Türkçe']
  ];
  return Markup.inlineKeyboard([
    ...langs.map(([code, label]) => [
      Markup.button.callback(cur===code?`✅ ${label}`:label, `set_lang_${code}_${chatId}`)
    ]),
    [Markup.button.callback('◀️ Kembali', `set_back_${chatId}`)],
  ]);
}

// ─── Register handlers ────────────────────
module.exports = (bot) => {

  // /settings command
  bot.command('settings', safe(async (ctx) => {
    if (ctx.chat.type === 'private') {
      return ctx.replyWithHTML(`<blockquote>❌ Perintah ini hanya bisa digunakan di grup.</blockquote>`);
    }
    const chatId = ctx.chat.id;
    if (!await isGroupAdmin(ctx, chatId)) {
      return ctx.replyWithHTML(`<blockquote>❌ Hanya admin grup yang bisa membuka settings.</blockquote>`);
    }
    await ctx.replyWithHTML(buildSettingsText(chatId), buildSettingsButtons(chatId));
  }));

  // ── Back to main settings ──
  bot.action(/^set_back_(-?\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    await ctx.answerCbQuery();
    await safeEdit(ctx, buildSettingsText(chatId), buildSettingsButtons(chatId));
  });

  // ── Close ──
  bot.action(/^set_close_(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Ditutup');
    await ctx.deleteMessage().catch(() => {});
  });

  // ── Reset to defaults ──
  bot.action(/^set_reset_(-?\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    const key = String(chatId);
    const { DEFAULTS } = require('./settings');
    const cache = require('./settings').getSettings(chatId);
    Object.assign(cache, { ...DEFAULTS });
    require('./settings').updateSetting(chatId, '__reset', true);
    await ctx.answerCbQuery('✅ Reset ke default');
    await safeEdit(ctx, buildSettingsText(chatId), buildSettingsButtons(chatId));
  });

  // ── Sub-menu openers ──
  const subMenus = {
    audio:     (id) => ({ text: '🔈 <b>Kualitas Audio</b>\n\nPilih kualitas audio saat stream:', buttons: audioQualityButtons(id) }),
    video:     (id) => ({ text: '📹 <b>Kualitas Video</b>\n\nPilih kualitas video saat stream:', buttons: videoQualityButtons(id) }),
    autodel:   (id) => ({ text: '🗑 <b>Auto-Delete Pesan Bot</b>\n\nPesan dari bot akan otomatis dihapus setelah:', buttons: autoDeleteButtons(id) }),
    playmode:  (id) => ({ text: '🎮 <b>Mode Play</b>\n\nSiapa yang bisa menggunakan /play dan kontrol musik:', buttons: playModeButtons(id) }),
    autoleave: (id) => ({ text: '⏱ <b>Auto-Leave</b>\n\nUserbot keluar otomatis jika tidak ada lagu:', buttons: autoLeaveButtons(id) }),
    maxqueue:  (id) => ({ text: '📋 <b>Batas Antrian</b>\n\nMaksimum lagu dalam antrian:', buttons: maxQueueButtons(id) }),
    volume:    (id) => ({ text: '🔊 <b>Volume Default</b>\n\nAtur volume default saat lagu mulai diputar:', buttons: volumeButtons(id) }),
    lang:      (id) => ({ text: '🌐 <b>Bahasa Bot</b>\n\nPilih bahasa untuk pesan bot di grup ini:', buttons: langButtons(id) }),
    log:       (id) => ({ text: '📢 <b>Log Channel</b>\n\nKirim ID channel log dengan format:\n/setlogchannel -100xxxxxxxxxx\n\nAtau /setlogchannel off untuk menonaktifkan.', buttons: Markup.inlineKeyboard([[Markup.button.callback('◀️ Kembali', `set_back_${id}`)]]) }),
  };

  for (const [key, builder] of Object.entries(subMenus)) {
    bot.action(new RegExp(`^set_menu_${key}_(-?\\d+)$`), async (ctx) => {
      const chatId = parseInt(ctx.match[1]);
      if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
      await ctx.answerCbQuery();
      const { text, buttons } = builder(chatId);
      await safeEdit(ctx, `<blockquote>${text}</blockquote>`, buttons);
    });
  }

  // ── Audio quality ──
  for (const q of ['low','medium','high']) {
    bot.action(new RegExp(`^set_audio_${q}_(-?\\d+)$`), async (ctx) => {
      const chatId = parseInt(ctx.match[1]);
      if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
      S.setAudioQuality(chatId, q);
      await ctx.answerCbQuery(`✅ ${S.AUDIO_QUALITY[q].label}`);
      await safeEdit(ctx, `<blockquote>🔈 <b>Kualitas Audio</b>\n\nPilih kualitas audio saat stream:</blockquote>`, audioQualityButtons(chatId));
    });
  }

  // ── Video quality ──
  for (const q of ['low','medium','high']) {
    bot.action(new RegExp(`^set_video_${q}_(-?\\d+)$`), async (ctx) => {
      const chatId = parseInt(ctx.match[1]);
      if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
      S.setVideoQuality(chatId, q);
      await ctx.answerCbQuery(`✅ ${S.VIDEO_QUALITY[q].label}`);
      await safeEdit(ctx, `<blockquote>📹 <b>Kualitas Video</b>\n\nPilih kualitas video saat stream:</blockquote>`, videoQualityButtons(chatId));
    });
  }

  // ── Auto-delete ──
  bot.action(/^set_autodel_(\d+)_(-?\d+)$/, async (ctx) => {
    const val    = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setAutoDelete(chatId, val);
    await ctx.answerCbQuery(val === 0 ? '❌ Auto-delete off' : `✅ Auto-delete ${val}s`);
    await safeEdit(ctx, `<blockquote>🗑 <b>Auto-Delete Pesan Bot</b>\n\nPesan dari bot akan otomatis dihapus setelah:</blockquote>`, autoDeleteButtons(chatId));
  });

  // ── Play mode ──
  for (const mode of ['all','admin','dj']) {
    bot.action(new RegExp(`^set_play_${mode}_(-?\\d+)$`), async (ctx) => {
      const chatId = parseInt(ctx.match[1]);
      if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
      S.setPlayMode(chatId, mode);
      const labels = { all:'👥 Semua Anggota', admin:'👑 Admin Saja', dj:'🎧 DJ Role' };
      await ctx.answerCbQuery(`✅ ${labels[mode]}`);
      await safeEdit(ctx, `<blockquote>🎮 <b>Mode Play</b>\n\nSiapa yang bisa menggunakan /play:</blockquote>`, playModeButtons(chatId));
    });
  }

  // ── Auto-leave on/off ──
  bot.action(/^set_autoleave_(on|off)_(-?\d+)$/, async (ctx) => {
    const isOn   = ctx.match[1] === 'on';
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setAutoLeave(chatId, isOn);
    await ctx.answerCbQuery(isOn ? '✅ Auto-Leave aktif' : '❌ Auto-Leave nonaktif');
    await safeEdit(ctx, `<blockquote>⏱ <b>Auto-Leave</b>\n\nUserbot keluar otomatis jika tidak ada lagu:</blockquote>`, autoLeaveButtons(chatId));
  });

  // ── Auto-leave time ──
  bot.action(/^set_altime_(\d+)_(-?\d+)$/, async (ctx) => {
    const mins   = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setAutoLeaveTime(chatId, mins);
    await ctx.answerCbQuery(`✅ ${mins} menit`);
    await safeEdit(ctx, `<blockquote>⏱ <b>Auto-Leave</b>\n\nUserbot keluar otomatis jika tidak ada lagu:</blockquote>`, autoLeaveButtons(chatId));
  });

  // ── Max queue ──
  bot.action(/^set_maxq_(\d+)_(-?\d+)$/, async (ctx) => {
    const val    = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setMaxQueue(chatId, val);
    await ctx.answerCbQuery(val === 0 ? '♾ Unlimited' : `✅ Max ${val} lagu`);
    await safeEdit(ctx, `<blockquote>📋 <b>Batas Antrian</b>\n\nMaksimum lagu dalam antrian:</blockquote>`, maxQueueButtons(chatId));
  });

  // ── Volume presets ──
  bot.action(/^set_vol_(\d+)_(-?\d+)$/, async (ctx) => {
    const vol    = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setVolume(chatId, vol);
    await ctx.answerCbQuery(`✅ Volume ${vol}%`);
    await safeEdit(ctx, `<blockquote>🔊 <b>Volume Default</b>\n\nVolume saat ini: <b>${vol}%</b></blockquote>`, volumeButtons(chatId));
  });

  // ── Volume +/- ──
  bot.action(/^set_voladd_(-?\d+)_(-?\d+)$/, async (ctx) => {
    const delta  = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    const cur = S.getVolume(chatId);
    const vol = Math.max(0, Math.min(200, cur + delta));
    S.setVolume(chatId, vol);
    await ctx.answerCbQuery(`🔊 ${vol}%`);
    await safeEdit(ctx, `<blockquote>🔊 <b>Volume Default</b>\n\nVolume saat ini: <b>${vol}%</b></blockquote>`, volumeButtons(chatId));
  });

  // ── No duplicate toggle ──
  bot.action(/^set_toggle_nodup_(-?\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    const cur = S.getNoDuplicate(chatId);
    S.setNoDuplicate(chatId, !cur);
    await ctx.answerCbQuery(!cur ? '✅ Cegah duplikat aktif' : '❌ Cegah duplikat nonaktif');
    await safeEdit(ctx, buildSettingsText(chatId), buildSettingsButtons(chatId));
  });

  // ── DJ mode toggle ──
  bot.action(/^set_toggle_djmode_(-?\d+)$/, async (ctx) => {
    const chatId = parseInt(ctx.match[1]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    const cur = S.getDjMode(chatId);
    S.setDjMode(chatId, !cur);
    await ctx.answerCbQuery(!cur ? '🎧 DJ Mode aktif' : '❌ DJ Mode nonaktif');
    await safeEdit(ctx, buildSettingsText(chatId), buildSettingsButtons(chatId));
  });

  // ── Language ──
  bot.action(/^set_lang_([a-z]+)_(-?\d+)$/, async (ctx) => {
    const code   = ctx.match[1];
    const chatId = parseInt(ctx.match[2]);
    if (!await isGroupAdmin(ctx, chatId)) return ctx.answerCbQuery('❌');
    S.setLang(chatId, code);
    const names = { id:'🇮🇩 Indonesia', en:'🇬🇧 English', ms:'🇲🇾 Melayu', ar:'🇸🇦 عربي', tr:'🇹🇷 Türkçe' };
    await ctx.answerCbQuery(`✅ ${names[code]}`);
    await safeEdit(ctx, `<blockquote>🌐 <b>Bahasa Bot</b>\n\nPilih bahasa untuk pesan bot di grup ini:</blockquote>`, langButtons(chatId));
  });

  // noop button
  bot.action(/^set_vol_noop_/, (ctx) => ctx.answerCbQuery());

  // /setlogchannel
  bot.command('setlogchannel', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!await isGroupAdmin(ctx, ctx.chat.id)) {
      return ctx.replyWithHTML(`<blockquote>❌ Hanya admin grup.</blockquote>`);
    }
    const arg = ctx.message.text.split(' ')[1];
    if (!arg) return ctx.replyWithHTML(`<blockquote>❓ Cara pakai: /setlogchannel -100xxxxxxxxxx\nAtau: /setlogchannel off</blockquote>`);
    if (arg === 'off') {
      S.setLogChannel(ctx.chat.id, null);
      return ctx.replyWithHTML(`<blockquote>✅ Log channel dinonaktifkan.</blockquote>`);
    }
    const channelId = parseInt(arg);
    if (isNaN(channelId)) return ctx.replyWithHTML(`<blockquote>❌ ID channel tidak valid.</blockquote>`);
    S.setLogChannel(ctx.chat.id, channelId);
    return ctx.replyWithHTML(`<blockquote>✅ Log channel diatur ke <code>${channelId}</code>.</blockquote>`);
  }));

  // /setdjrole
  bot.command('setdjrole', safe(async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!await isGroupAdmin(ctx, ctx.chat.id)) return;
    const role = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!role) return ctx.replyWithHTML(`<blockquote>❓ Cara pakai: /setdjrole NamaDJ\nContoh: /setdjrole DJ</blockquote>`);
    S.setDjRole(ctx.chat.id, role);
    return ctx.replyWithHTML(`<blockquote>✅ DJ Role diatur ke: <b>${role}</b>\n\nAnggota dengan custom title "<b>${role}</b>" bisa menggunakan musik.</blockquote>`);
  }));
};
