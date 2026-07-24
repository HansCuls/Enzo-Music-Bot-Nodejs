// ==========================================
// FILE: music/userpool.js
// Multi-userbot pool (max 4 userbot)
// Login via Telegram wizard
// ==========================================

const { TelegramClient, Api } = require('teleproto');
const { StringSession }       = require('teleproto/sessions');
const fs   = require('fs');
const path = require('path');

const POOL_FILE = path.join(__dirname, '../database/userbot_pool.json');
const MAX_BOTS  = 4;

// ─── Persistent storage ───────────────────
function loadPool() {
  try {
    if (!fs.existsSync(POOL_FILE)) return [];
    return JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
  } catch { return []; }
}

function savePool(pool) {
  const dir = path.dirname(POOL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
}

// Pool: array of { id, session, phone, name, active, assignedGroups[] }
let pool = loadPool();

// Active TelegramClient instances
const clients = new Map(); // id => TelegramClient

// Group → userbot assignment
const groupAssignment = new Map(); // chatId => userbot id

// ─── Init all userbots on startup ─────────
async function initPool() {
  for (const bot of pool) {
    if (!bot.session) continue;
    try {
      const client = new TelegramClient(
        new StringSession(bot.session),
        global.API_ID, global.API_HASH,
        { connectionRetries: 5, useWSS: false }
      );
      await client.connect();
      await client.getMe();
      clients.set(bot.id, client);
      bot.active = true;
      console.log(`[pool] ✅ Userbot #${bot.id} (${bot.name}) terhubung`);
    } catch (e) {
      bot.active = false;
      console.warn(`[pool] ⚠️ Userbot #${bot.id} gagal connect: ${e.message}`);
      try {
        const { writeLog } = require('./error_handler');
        writeLog(`[pool.initPool] userbot #${bot.id} connect failed: ${e.message}\n${e.stack?.split('\n').slice(0,3).join('\n')}`);
      } catch {}
    }
  }
  savePool(pool);
}

// ─── Get best available userbot for a group ─
function getClientForGroup(chatId) {
  const key = String(chatId);

  // Already assigned?
  if (groupAssignment.has(key)) {
    const id     = groupAssignment.get(key);
    const client = clients.get(id);
    if (client) return { client, id };
  }

  // Assign the bot with fewest groups
  const active = pool.filter(b => b.active && clients.has(b.id));
  if (!active.length) return null;

  active.sort((a, b) => (a.assignedGroups?.length || 0) - (b.assignedGroups?.length || 0));
  const chosen = active[0];
  groupAssignment.set(key, chosen.id);
  if (!chosen.assignedGroups) chosen.assignedGroups = [];
  if (!chosen.assignedGroups.includes(key)) chosen.assignedGroups.push(key);
  savePool(pool);
  return { client: clients.get(chosen.id), id: chosen.id };
}

function getClientById(id) {
  return clients.get(id) || null;
}

function getAllBots() {
  return pool.map(b => ({ ...b, session: undefined })); // strip session from output
}

function getPoolCount()  { return pool.length; }
function getActiveCount(){ return pool.filter(b => b.active && clients.has(b.id)).length; }
function hasSlot()       { return pool.length < MAX_BOTS; }

// ─── Add new userbot after login ──────────
function addBotToPool(session, phone, name) {
  const id = pool.length ? Math.max(...pool.map(b => b.id)) + 1 : 1;
  const entry = { id, session, phone, name, active: false, assignedGroups: [] };
  pool.push(entry);
  savePool(pool);
  return entry;
}

// ─── Connect a newly added bot ────────────
async function connectBot(id) {
  const entry = pool.find(b => b.id === id);
  if (!entry) throw new Error(`Bot #${id} tidak ditemukan`);
  const client = new TelegramClient(
    new StringSession(entry.session),
    global.API_ID, global.API_HASH,
    { connectionRetries: 5, useWSS: false }
  );
  await client.connect();
  const me = await client.getMe();
  entry.name   = `${me.firstName || ''} ${me.lastName || ''}`.trim();
  entry.active = true;
  clients.set(id, client);
  savePool(pool);
  return entry;
}

// ─── Remove userbot ───────────────────────
async function removeBot(id) {
  const client = clients.get(id);
  if (client) { try { await client.disconnect(); } catch {} clients.delete(id); }
  pool = pool.filter(b => b.id !== id);
  // Remove assignments
  for (const [k, v] of groupAssignment.entries()) {
    if (v === id) groupAssignment.delete(k);
  }
  savePool(pool);
}

// Return all active clients with name
function getMusicClients() {
  const result = [];
  for (const bot of pool) {
    const client = clients.get(bot.id);
    if (bot.active && client) {
      result.push({ client, name: bot.name || `Userbot #${bot.id}`, id: bot.id });
    }
  }
  return result;
}

module.exports = {
  initPool, getClientForGroup, getClientById,
  getAllBots, getPoolCount, getActiveCount, hasSlot,
  addBotToPool, connectBot, removeBot, getMusicClients,
  MAX_BOTS,
};
