// ==========================================
// FILE: music/playlist.js
// Save / load named playlists per group
// Stored in database/playlists.json
// ==========================================

const fs   = require('fs');
const path = require('path');

const PLAYLIST_FILE = path.join(__dirname, '../database/playlists.json');

function loadAll() {
  try {
    if (!fs.existsSync(PLAYLIST_FILE)) return {};
    return JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
  } catch { return {}; }
}

function saveAll(data) {
  const dir = path.dirname(PLAYLIST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2));
}

let db = loadAll();

/**
 * Save current tracks as a named playlist
 * @param {string|number} chatId
 * @param {string} name - playlist name
 * @param {Array} tracks - array of track objects
 */
function savePlaylist(chatId, name, tracks) {
  const key = String(chatId);
  if (!db[key]) db[key] = {};
  db[key][name.toLowerCase()] = {
    name,
    tracks: tracks.map(t => ({
      title:       t.title,
      url:         t.url,
      videoId:     t.videoId,
      duration:    t.duration,
      durationFmt: t.durationFmt,
      uploader:    t.uploader,
      thumbnail:   t.thumbnail,
      viewsFmt:    t.viewsFmt,
    })),
    savedAt: Date.now(),
    count:   tracks.length,
  };
  saveAll(db);
  return db[key][name.toLowerCase()];
}

/**
 * Load a named playlist for a chat
 * @returns {Object|null}
 */
function loadPlaylist(chatId, name) {
  const key = String(chatId);
  return db[key]?.[name.toLowerCase()] || null;
}

/**
 * Delete a named playlist
 */
function deletePlaylist(chatId, name) {
  const key = String(chatId);
  if (!db[key]?.[name.toLowerCase()]) return false;
  delete db[key][name.toLowerCase()];
  saveAll(db);
  return true;
}

/**
 * List all playlists for a chat
 * @returns {Array<{name, count, savedAt}>}
 */
function listPlaylists(chatId) {
  const key = String(chatId);
  if (!db[key]) return [];
  return Object.values(db[key]).map(p => ({
    name:    p.name,
    count:   p.count,
    savedAt: p.savedAt,
  }));
}

module.exports = { savePlaylist, loadPlaylist, deletePlaylist, listPlaylists };
