// ==========================================
// FILE: music/settings.js
// Per-group settings with full options
// ==========================================

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../database/music_settings.json');

const DEFAULTS = {
  lang:          'id',
  volume:        100,
  audioQuality:  'medium',   // low | medium | high
  videoQuality:  'medium',   // low | medium | high
  autoDelete:    0,          // 0=off, 5, 10, 30, 60 (seconds)
  playMode:      'all',      // all | admin | dj
  autoLeave:     true,
  autoLeaveTime: 15,         // minutes
  maxQueue:      50,         // max songs in queue (0 = unlimited)
  noDuplicate:   false,      // prevent duplicate songs
  logChannel:    null,       // channel ID to log songs
  djRole:        null,       // role name for DJ mode
  defaultLoop:   'off',      // off | song | queue
  djMode:        false,
};

// Quality presets
const AUDIO_QUALITY = {
  low:    { bitrate: '64k',  label: '🔈 Low (64kbps)'    },
  medium: { bitrate: '128k', label: '🔉 Medium (128kbps)' },
  high:   { bitrate: '320k', label: '🔊 High (320kbps)'   },
};

const VIDEO_QUALITY = {
  low:    { width: 640,  height: 360,  fps: 24, label: '📱 Low (360p)'    },
  medium: { width: 854,  height: 480,  fps: 30, label: '💻 Medium (480p)' },
  high:   { width: 1280, height: 720,  fps: 30, label: '🖥 High (720p)'   },
};

function loadAll() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveAll(cache) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cache, null, 2));
}

const cache = loadAll();

function getSettings(chatId) {
  const key = String(chatId);
  if (!cache[key]) cache[key] = { ...DEFAULTS };
  // Fill missing keys with defaults
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (cache[key][k] === undefined) cache[key][k] = v;
  }
  return cache[key];
}

function updateSetting(chatId, key, value) {
  const s  = getSettings(chatId);
  s[key]   = value;
  saveAll(cache);
  return s;
}

// Convenience getters/setters
const getLang         = (id) => getSettings(id).lang;
const setLang         = (id, v) => updateSetting(id, 'lang', v);
const getVolume       = (id) => getSettings(id).volume;
const setVolume       = (id, v) => updateSetting(id, 'volume', v);
const getAudioQuality = (id) => getSettings(id).audioQuality;
const setAudioQuality = (id, v) => updateSetting(id, 'audioQuality', v);
const getVideoQuality = (id) => getSettings(id).videoQuality;
const setVideoQuality = (id, v) => updateSetting(id, 'videoQuality', v);
const getAutoDelete   = (id) => getSettings(id).autoDelete;
const setAutoDelete   = (id, v) => updateSetting(id, 'autoDelete', v);
const getPlayMode     = (id) => getSettings(id).playMode;
const setPlayMode     = (id, v) => updateSetting(id, 'playMode', v);
const getAutoLeave    = (id) => getSettings(id).autoLeave;
const setAutoLeave    = (id, v) => updateSetting(id, 'autoLeave', v);
const getAutoLeaveTime= (id) => getSettings(id).autoLeaveTime;
const setAutoLeaveTime= (id, v) => updateSetting(id, 'autoLeaveTime', v);
const getMaxQueue     = (id) => getSettings(id).maxQueue;
const setMaxQueue     = (id, v) => updateSetting(id, 'maxQueue', v);
const getNoDuplicate  = (id) => getSettings(id).noDuplicate;
const setNoDuplicate  = (id, v) => updateSetting(id, 'noDuplicate', v);
const getLogChannel   = (id) => getSettings(id).logChannel;
const setLogChannel   = (id, v) => updateSetting(id, 'logChannel', v);
const getDjMode       = (id) => getSettings(id).djMode;
const setDjMode       = (id, v) => updateSetting(id, 'djMode', v);
const getDjRole       = (id) => getSettings(id).djRole;
const setDjRole       = (id, v) => updateSetting(id, 'djRole', v);
const getDefaultLoop  = (id) => getSettings(id).defaultLoop;
const setDefaultLoop  = (id, v) => updateSetting(id, 'defaultLoop', v);

// Check if user can use /play
async function canPlay(ctx, chatId) {
  const mode = getPlayMode(chatId);
  if (mode === 'all') return true;
  try {
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    const isAdmin = ['administrator', 'creator'].includes(member.status);
    if (mode === 'admin') return isAdmin;
    if (mode === 'dj') {
      const role = getDjRole(chatId);
      // Check custom title or admin
      return isAdmin || (role && member.custom_title?.toLowerCase() === role.toLowerCase());
    }
  } catch {}
  return false;
}

module.exports = {
  getSettings, updateSetting,
  getLang, setLang,
  getVolume, setVolume,
  getAudioQuality, setAudioQuality, AUDIO_QUALITY,
  getVideoQuality, setVideoQuality, VIDEO_QUALITY,
  getAutoDelete, setAutoDelete,
  getPlayMode, setPlayMode,
  getAutoLeave, setAutoLeave,
  getAutoLeaveTime, setAutoLeaveTime,
  getMaxQueue, setMaxQueue,
  getNoDuplicate, setNoDuplicate,
  getLogChannel, setLogChannel,
  getDjMode, setDjMode,
  getDjRole, setDjRole,
  getDefaultLoop, setDefaultLoop,
  canPlay,
  DEFAULTS,
};
