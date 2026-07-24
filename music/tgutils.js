// ==========================================
// FILE: music/tgutils.js
// Utility functions untuk teleproto
// Shared across all music modules
// ==========================================

const { Api } = require('teleproto');

// StringSession (dipakai di userpool.js/loginwizard.js) cuma nyimpen kredensial
// login, BUKAN entity cache. Jadi tiap restart proses, userbot "lupa" access_hash
// semua channel yang belum ditemui lagi di proses ini → getEntity(PeerChannel) gagal
// dengan "Could not find the input entity". Fix: paksa sync dialog dulu buat isi ulang
// cache-nya, baru coba resolve lagi. Di-dedupe per client biar gak nembak getDialogs
// berkali-kali kalau banyak grup gagal resolve bersamaan (misal abis restart).
const dialogRefreshInFlight = new WeakMap();
async function refreshDialogCache(client) {
  if (typeof client.getDialogs !== 'function') return;
  if (!dialogRefreshInFlight.has(client)) {
    const p = client.getDialogs({ limit: 200 }).catch(() => {});
    dialogRefreshInFlight.set(client, p);
    p.finally(() => setTimeout(() => dialogRefreshInFlight.delete(client), 30000));
  }
  await dialogRefreshInFlight.get(client);
}

// Setelah berhasil resolve sekali, simpan entity-nya sendiri (bukan cuma andalkan
// cache internal teleproto/StringSession yang bisa hilang/gak konsisten). Jadi kalaupun
// resolusi pertama butuh beberapa kali retry, permintaan berikutnya untuk chat yang sama
// gak perlu ulang dari nol lagi selama proses ini masih hidup.
const resolvedEntityCache = new Map();

/**
 * Resolve chat entity dari chatId apapun formatnya
 * Teleproto (GramJS fork) getEntity sudah handle ini,
 * tapi perlu konversi ID format Bot API → MTProto
 *
 * Bot API format : -1002655523832 (supergroup)
 * MTProto format : PeerChannel{ channelId: 2655523832 }
 */
async function resolveChannelEntity(client, chatId) {
  const id = String(chatId).trim();

  if (resolvedEntityCache.has(id)) return resolvedEntityCache.get(id);

  const tryDirect = async () => {
    // Supergroup / Channel: Bot API prefix -100
    if (id.startsWith('-100')) {
      const chanId = BigInt(id.slice(4));
      return await client.getEntity(new Api.PeerChannel({ channelId: chanId }));
    }
    // Regular group: negative ID tanpa -100
    if (id.startsWith('-')) {
      const chatIdNum = BigInt(id.slice(1));
      return await client.getEntity(new Api.PeerChat({ chatId: chatIdNum }));
    }
    // User / Bot: positive ID
    return await client.getEntity(new Api.PeerUser({ userId: BigInt(id) }));
  };

  try {
    const entity = await tryDirect();
    resolvedEntityCache.set(id, entity);
    return entity;
  } catch (e1) {
    // Cache miss → paksa refresh dialog list (fills entity cache), lalu retry.
    // TIDAK ada fallback ke getEntity(chatId mentah) di sini dengan sengaja: chatId
    // Bot API (misal -1001234567890) bukan format MTProto yang valid (MTProto pakai
    // channelId positif tanpa prefix -100), jadi nembak raw id ke getEntity cuma bikin
    // Telegram nolak dengan CHANNEL_INVALID sungguhan — dan itu pernah memicu bug
    // internal teleproto pas nyusun error-nya ("Do not know how to serialize a BigInt").
    // Lebih baik gagal dengan error asli yang jelas daripada nebak-nebak format yang salah.
    try {
      await refreshDialogCache(client);
      const entity = await tryDirect();
      resolvedEntityCache.set(id, entity);
      return entity;
    } catch {
      // Masih gagal. Abis userbot baru join, kadang satu kali refresh belum cukup —
      // server Telegram butuh sedikit waktu lagi. Tunggu sebentar, lalu paksa fetch
      // dialog yang BENERAN baru (bypass dedup di atas, karena kita sengaja mau nyoba
      // lagi dari nol, bukan nunggu hasil yang sama seperti percobaan pertama).
      try {
        await new Promise(r => setTimeout(r, 1500));
        if (typeof client.getDialogs === 'function') await client.getDialogs({ limit: 200 }).catch(() => {});
        const entity = await tryDirect();
        resolvedEntityCache.set(id, entity);
        return entity;
      } catch {
        throw e1; // error paling awal & paling informatif
      }
    }
  }
}

/**
 * Cek apakah entity adalah channel/supergroup
 */
function isChannelEntity(entity) {
  return entity?.className === 'Channel';
}

/**
 * Dapatkan numeric ID dari entity teleproto
 */
function getEntityId(entity) {
  if (!entity) return null;
  const raw = entity.id;
  if (entity.className === 'Channel' || entity.className === 'Chat') {
    return -Number(`100${raw}`);
  }
  return Number(raw);
}

/**
 * Sebagian error internal teleproto kadang gak jelas/misleading (misal
 * "Do not know how to serialize a BigInt" — ini bug internal library pas
 * nyusun pesan error untuk kegagalan resolve entity, nutupin pesan aslinya
 * yang harusnya lebih deskriptif). Ganti jadi pesan yang lebih actionable.
 */
function clarifyTeleprotoError(e) {
  const msg = e?.message || String(e);
  if (msg.includes('serialize a BigInt')) {
    return 'Gagal resolve entity channel (userbot mungkin belum sepenuhnya ke-sync sebagai member — coba ulangi perintahnya dalam beberapa detik).';
  }
  return msg;
}

/**
 * Ekstrak hash dari invite link Telegram, buat dipakai di messages.ImportChatInvite.
 * Telegram sekarang pakai format baru https://t.me/+HASH (bukan /joinchat/HASH lagi),
 * jadi split('/').pop() doang bakal ikut kebawa karakter '+' di depannya — dan ngirim
 * '+HASH' (bukan 'HASH' polos) ke ImportChatInvite selalu ditolak Telegram sebagai
 * INVITE_HASH_EXPIRED (kelihatannya kayak link basi, padahal cuma salah parsing).
 */
function extractInviteHash(inviteLink) {
  return String(inviteLink).split('/').pop().replace(/^\+/, '');
}

module.exports = { resolveChannelEntity, isChannelEntity, getEntityId, clarifyTeleprotoError, extractInviteHash };
