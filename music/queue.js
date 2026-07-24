// ==========================================
// FILE: music/queue.js
// Queue manager per grup/chat
// Enhanced: shuffle, history, volume, skipTo
// ==========================================

class MusicQueue {
  constructor() {
    this.queues = new Map();
  }

  get(chatId) {
    const key = String(chatId);
    if (!this.queues.has(key)) {
      this.queues.set(key, {
        tracks:       [],
        currentIndex: 0,
        isPlaying:    false,
        isPaused:     false,
        volume:       100,
        loop:         false,
        loopQueue:    false,
        startedAt:    null,
        msgId:        null,
        chatId:       chatId,
        connection:   null,
        stream:       null,
        history:      [],       // last 20 played
        queuePage:    0,        // current queue display page
      });
    }
    return this.queues.get(key);
  }

  add(chatId, track) {
    const state = this.get(chatId);
    state.tracks.push(track);
    return state;
  }

  current(chatId) {
    const state = this.get(chatId);
    if (!state.tracks.length) return null;
    return state.tracks[state.currentIndex] || null;
  }

  next(chatId) {
    const state = this.get(chatId);
    // Push current to history before advancing
    const cur = this.current(chatId);
    if (cur) {
      state.history.unshift({ ...cur, playedAt: Date.now() });
      if (state.history.length > 20) state.history.pop();
    }

    if (state.loopQueue && state.currentIndex >= state.tracks.length - 1) {
      state.currentIndex = 0;
      return state.tracks[0] || null;
    }
    if (state.currentIndex < state.tracks.length - 1) {
      state.currentIndex++;
      return state.tracks[state.currentIndex];
    }
    return null;
  }

  prev(chatId) {
    const state = this.get(chatId);
    if (state.currentIndex > 0) {
      state.currentIndex--;
      return state.tracks[state.currentIndex];
    }
    return null;
  }

  skipTo(chatId, index) {
    const state = this.get(chatId);
    if (index >= 0 && index < state.tracks.length) {
      const cur = this.current(chatId);
      if (cur) {
        state.history.unshift({ ...cur, playedAt: Date.now() });
        if (state.history.length > 20) state.history.pop();
      }
      state.currentIndex = index;
      return state.tracks[index];
    }
    return null;
  }

  remove(chatId, index) {
    const state = this.get(chatId);
    if (index < 0 || index >= state.tracks.length) return false;
    if (index === state.currentIndex) return false; // cannot remove current
    state.tracks.splice(index, 1);
    if (index < state.currentIndex) state.currentIndex--;
    if (state.currentIndex >= state.tracks.length) {
      state.currentIndex = Math.max(0, state.tracks.length - 1);
    }
    return true;
  }

  move(chatId, fromIndex, toIndex) {
    const state = this.get(chatId);
    if (
      fromIndex < 0 || fromIndex >= state.tracks.length ||
      toIndex   < 0 || toIndex   >= state.tracks.length ||
      fromIndex === toIndex
    ) return false;

    const [track] = state.tracks.splice(fromIndex, 1);
    state.tracks.splice(toIndex, 0, track);

    // Adjust currentIndex
    if (state.currentIndex === fromIndex) {
      state.currentIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
      state.currentIndex--;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
      state.currentIndex++;
    }
    return true;
  }

  shuffle(chatId) {
    const state = this.get(chatId);
    if (state.tracks.length <= 1) return false;

    const current = state.tracks[state.currentIndex];
    // Remove current from array
    const rest = state.tracks.filter((_, i) => i !== state.currentIndex);
    // Fisher-Yates shuffle
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    // Put current track first
    state.tracks = [current, ...rest];
    state.currentIndex = 0;
    return true;
  }

  clear(chatId) {
    const state = this.get(chatId);
    state.tracks        = [];
    state.currentIndex  = 0;
    state.isPlaying     = false;
    state.isPaused      = false;
    state.startedAt     = null;
    state.connection    = null;
    state.stream        = null;
  }

  delete(chatId) {
    this.queues.delete(String(chatId));
  }

  isEmpty(chatId) {
    return this.get(chatId).tracks.length === 0;
  }

  size(chatId) {
    return this.get(chatId).tracks.length;
  }

  getHistory(chatId) {
    return this.get(chatId).history || [];
  }

  // Get a page of the queue (10 tracks per page)
  getPage(chatId, page = 0) {
    const state  = this.get(chatId);
    const perPage = 10;
    const total   = state.tracks.length;
    const pages   = Math.ceil(total / perPage) || 1;
    const p       = Math.max(0, Math.min(page, pages - 1));
    const start   = p * perPage;
    const items   = state.tracks.slice(start, start + perPage);
    return { items, page: p, pages, total, start, currentIndex: state.currentIndex };
  }
}

const queue = new MusicQueue();
module.exports = queue;
