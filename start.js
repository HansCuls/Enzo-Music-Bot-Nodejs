// ==========================================
// FILE: start.js
// Modern /start menu dengan tombol berwarna
// ==========================================

const { Markup }           = require('telegraf');
const { t }                = require('./music/i18n');
const { getLang, setLang } = require('./music/settings');

// ─── Warna tombol via emoji ────────────────
// Telegram tidak support custom color, pakai emoji sebagai indikator warna


const ALL_LANGS = [
  { code: 'id', text: '🇮🇩 ID', callback_data: 'setlang_id' },
  { code: 'en', text: '🇬🇧 EN', callback_data: 'setlang_en' },
  { code: 'ms', text: '🇲🇾 MS', callback_data: 'setlang_ms' },
  { code: 'ar', text: '🇸🇦 AR', callback_data: 'setlang_ar' },
  { code: 'tr', text: '🇹🇷 TR', callback_data: 'setlang_tr' },
  { code: 'ru', text: '🇷🇺 RU', callback_data: 'setlang_ru' },
];

// Tampilkan 5 bahasa (sembunyikan yang sedang aktif)
function buildLangButtons(activeLang) {
  const visible = ALL_LANGS.filter(l => l.code !== activeLang);
  // Bagi jadi 2 baris: 3 + 2
  const row1 = visible.slice(0, 3).map(l => ({ text: l.text, callback_data: l.callback_data }));
  const row2 = visible.slice(3).map(l => ({ text: l.text, callback_data: l.callback_data }));
  return [row1, row2];
}

function buildStartButtons(botUsername, lang = 'id') {
  // Raw format untuk support colored buttons (Bot API 9.4)
  return {
    reply_markup: {
      inline_keyboard: [
        // Row 1: Tambah ke Grup (success = hijau)
        [
          { text: '➕ Tambah ke Grup', url: `https://t.me/${botUsername}?startgroup=true`, style: 'success' },
        ],
        // Row 2: Follow Channel (primary = biru)
        [
          { text: global.CHANNEL_1_NAME || '📢 Channel 1', url: global.CHANNEL_1 || 'https://t.me/', style: 'primary' },
          { text: global.CHANNEL_2_NAME || '📣 Channel 2', url: global.CHANNEL_2 || 'https://t.me/', style: 'primary' },
        ],
        // Row 3: Donasi (danger = merah muda/spesial)
        [
          { text: '💝 Donasi via Saweria', url: global.SAWERIA_URL || 'https://saweria.co/', style: 'danger' },
        ],
        // Row 4: Pilih bahasa — sembunyikan bahasa aktif, tampilkan 5 dari 6
        // Bahasa aktif disembunyikan dan diganti bahasa lain
        ...buildLangButtons(lang),
        // Row 5: Bantuan
        [
          { text: '❓ Panduan Lengkap', callback_data: 'help_menu', style: 'primary' },
        ],
      ]
    }
  };
}

function buildStartText(botName, lang = 'id') {
  // Escape MarkdownV2 special chars in botName
  const name = botName.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

  const texts = {
    id: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
Bot musik Telegram dengan Voice Chat\\. Stream lagu & video langsung di grup kamu\\.

*✨ Fitur Utama:*
▶️ Play audio & video YouTube
📋 Antrian lagu otomatis
🎤 Lirik lagu real\\-time
📂 Simpan playlist favorit
🌐 6 bahasa tersedia

*🚀 Cara Mulai:*
1\\. Tambahkan bot ke grup
2\\. Jadikan bot sebagai Admin
3\\. Ketik /play di grup

━━━━━━━━━━━━━━━━━━
_Pilih bahasa atau tambahkan ke grup sekarang\\!_`,

    en: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
Telegram music bot with Voice Chat\\. Stream songs & videos directly in your group\\.

*✨ Key Features:*
▶️ Audio & video YouTube playback
📋 Automatic song queue
🎤 Real\\-time song lyrics
📂 Save favorite playlists
🌐 6 languages available

*🚀 How to Start:*
1\\. Add bot to a group
2\\. Make the bot an Admin
3\\. Type /play in the group

━━━━━━━━━━━━━━━━━━
_Select language or add to group now\\!_`,

    ms: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
Bot muzik Telegram dengan Voice Chat\\. Stream lagu & video terus dalam kumpulan anda\\.

*✨ Ciri Utama:*
▶️ Main audio & video YouTube
📋 Barisan lagu automatik
🎤 Lirik lagu masa nyata
📂 Simpan senarai main kegemaran
🌐 6 bahasa tersedia

*🚀 Cara Mula:*
1\\. Tambah bot ke kumpulan
2\\. Jadikan bot sebagai Admin
3\\. Taip /play dalam kumpulan

━━━━━━━━━━━━━━━━━━
_Pilih bahasa atau tambah ke kumpulan sekarang\\!_`,

    ar: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
بوت موسيقى تيليغرام مع دردشة صوتية\\. بث الأغاني والفيديوهات مباشرة في مجموعتك\\.

*✨ المميزات الرئيسية:*
▶️ تشغيل الصوت والفيديو من يوتيوب
📋 قائمة انتظار تلقائية
🎤 كلمات الأغاني في الوقت الفعلي
📂 حفظ قوائم التشغيل المفضلة
🌐 6 لغات متاحة

*🚀 كيفية البدء:*
1\\. أضف البوت إلى المجموعة
2\\. اجعل البوت مشرفاً
3\\. اكتب /play في المجموعة

━━━━━━━━━━━━━━━━━━
_اختر اللغة أو أضف إلى المجموعة الآن\\!_`,

    tr: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
Voice Chat ile Telegram müzik botu\\. Şarkı ve videoları grubunuzda doğrudan yayınlayın\\.

*✨ Temel Özellikler:*
▶️ YouTube ses ve video oynatma
📋 Otomatik şarkı kuyruğu
🎤 Gerçek zamanlı şarkı sözleri
📂 Favori çalma listelerini kaydet
🌐 6 dil mevcut

*🚀 Nasıl Başlanır:*
1\\. Botu gruba ekle
2\\. Botu Yönetici yap
3\\. Grupta /play yaz

━━━━━━━━━━━━━━━━━━
_Dil seçin veya şimdi gruba ekleyin\\!_`,

    ru: `🎵 *${name}*
━━━━━━━━━━━━━━━━━━
Музыкальный бот Telegram с голосовым чатом\\. Стримите песни и видео прямо в вашей группе\\.

*✨ Основные функции:*
▶️ Воспроизведение аудио и видео YouTube
📋 Автоматическая очередь песен
🎤 Текст песен в реальном времени
📂 Сохранение избранных плейлистов
🌐 6 языков доступно

*🚀 Как начать:*
1\\. Добавьте бота в группу
2\\. Сделайте бота администратором
3\\. Введите /play в группе

━━━━━━━━━━━━━━━━━━
_Выберите язык или добавьте в группу сейчас\\!_`,
  };

  return texts[lang] || texts.id;
}

// ─── Donasi menu ──────────────────────────
function buildDonationText() {
  const name = global.SAWERIA_NAME || 'kami';
  const url  = global.SAWERIA_URL  || 'https://saweria.co/';
  return `💝 *Dukung Pengembangan Bot*
━━━━━━━━━━━━━━━━━━

Bot ini gratis untuk semua orang\\! Jika kamu menikmati bot ini, pertimbangkan untuk berdonasi\\.

Setiap donasi sangat berarti untuk:
• 🖥 Biaya server VPS
• ⚡ Pengembangan fitur baru
• 🛠 Maintenance & update rutin

*💳 Metode Pembayaran:*
QRIS \\| Transfer Bank \\| e\\-Wallet

[Klik untuk donasi sekarang →](${url})

_Terima kasih atas dukunganmu\\! 🙏_`;
}

module.exports = (bot) => {

  // ─── /start ──────────────────────────────
  bot.command('start', async (ctx) => {
    const lang    = getLang(ctx.chat.id);
    const botName = ctx.botInfo?.first_name || 'Music Bot';
    const botUser = ctx.botInfo?.username   || '';

    const startButtons = buildStartButtons(botUser, lang);
    await ctx.telegram.sendMessage(ctx.chat.id,
      buildStartText(botName, lang),
      { parse_mode: 'MarkdownV2', ...startButtons }
    );
  });

  // ─── /donate ─────────────────────────────
  bot.command(['donate', 'donasi'], async (ctx) => {
    await ctx.replyWithMarkdownV2(
      buildDonationText(),
      Markup.inlineKeyboard([
        [Markup.button.url(`💝 Donasi Sekarang`, global.SAWERIA_URL || 'https://saweria.co/')],
        [Markup.button.callback('◀️ Kembali', 'back_to_start')],
      ])
    );
  });

  // ─── Callbacks ───────────────────────────

  // Pilih bahasa dari /start (include Russian)
  bot.action(/^setlang_(id|en|ms|ar|tr|ru)$/, async (ctx) => {
    const code  = ctx.match[1];
    const names = {
      id:'🇮🇩 Bahasa Indonesia', en:'🇬🇧 English', ms:'🇲🇾 Bahasa Melayu',
      ar:'🇸🇦 العربية', tr:'🇹🇷 Türkçe', ru:'🇷🇺 Русский'
    };
    setLang(ctx.chat.id, code);
    await ctx.answerCbQuery(`✅ ${names[code]}`);

    const botName = ctx.botInfo?.first_name || 'Music Bot';
    const botUser = ctx.botInfo?.username   || '';
    const buttons = buildStartButtons(botUser, code);
    try {
      await ctx.editMessageText(
        buildStartText(botName, code),
        { parse_mode: 'MarkdownV2', ...buttons }
      );
    } catch {
      // Jika gagal edit, kirim baru
      await ctx.telegram.sendMessage(ctx.chat.id,
        buildStartText(botName, code),
        { parse_mode: 'MarkdownV2', ...buttons }
      );
    }
  });

  // Help menu
  bot.action('help_menu', async (ctx) => {
    const lang = getLang(ctx.chat.id);
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(t(lang, 'help_text'), {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Kembali ke Start', 'back_to_start')],
      ])
    });
  });

  // Back to start
  bot.action('back_to_start', async (ctx) => {
    const lang    = getLang(ctx.chat.id);
    const botName = ctx.botInfo?.first_name || 'Music Bot';
    const botUser = ctx.botInfo?.username   || '';
    await ctx.answerCbQuery();
    const buttons = buildStartButtons(botUser, lang);
    const text    = buildStartText(botName, lang);
    try {
      await ctx.editMessageText(text, { parse_mode: 'MarkdownV2', ...buttons });
    } catch {
      await ctx.telegram.sendMessage(ctx.chat.id, text, { parse_mode: 'MarkdownV2', ...buttons });
    }
  });

  // Donate button from start or anywhere
  bot.action('donate_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdownV2(
      buildDonationText(),
      Markup.inlineKeyboard([
        [Markup.button.url('💝 Donasi Sekarang', global.SAWERIA_URL || 'https://saweria.co/')],
        [Markup.button.callback('◀️ Kembali', 'back_to_start')],
      ])
    );
  });
};
