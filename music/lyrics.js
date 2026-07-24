// ==========================================
// FILE: music/lyrics.js
// Fetch lyrics from lyrics.ovh (free, no key)
// Fallback: search via title parsing
// ==========================================

/**
 * Parse "Artist - Title" or just "Title" from a string
 */
function parseArtistTitle(str) {
  if (!str) return { artist: '', title: str || '' };
  // Common separators: " - ", " – ", " | "
  const sep = str.match(/\s[-–|]\s/);
  if (sep) {
    const idx    = str.indexOf(sep[0]);
    const artist = str.slice(0, idx).trim();
    const title  = str.slice(idx + sep[0].length).trim();
    return { artist, title };
  }
  return { artist: '', title: str.trim() };
}

/**
 * Clean up title: remove "(Official Video)", "ft.", etc.
 */
function cleanTitle(title) {
  return title
    .replace(/\(.*?(official|video|audio|lyrics|lyric|mv|hd|4k|clip|music).*?\)/gi, '')
    .replace(/\[.*?(official|video|audio|lyrics|lyric|mv|hd|4k|clip|music).*?\]/gi, '')
    .replace(/ft\..*$/i, '')
    .replace(/feat\..*$/i, '')
    .replace(/\|.*$/,  '')
    .replace(/【.*?】/g, '')
    .trim();
}

/**
 * Fetch lyrics from lyrics.ovh
 * @param {string} artist
 * @param {string} title
 * @returns {Promise<string|null>}
 */
async function fetchFromLyricsOvh(artist, title) {
  try {
    const a = encodeURIComponent(artist || 'unknown');
    const t = encodeURIComponent(cleanTitle(title));
    const res = await fetch(`https://api.lyrics.ovh/v1/${a}/${t}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics || null;
  } catch {
    return null;
  }
}

/**
 * Try multiple strategies to find lyrics
 * @param {string} query - full title or "Artist - Title"
 * @returns {Promise<{lyrics: string, title: string, artist: string}|null>}
 */
async function getLyrics(query) {
  if (!query) return null;

  let { artist, title } = parseArtistTitle(query);

  // Strategy 1: With artist from parse
  if (artist) {
    const lyrics = await fetchFromLyricsOvh(artist, title);
    if (lyrics) return { lyrics, title, artist };
  }

  // Strategy 2: Swap (maybe the format is "Title - Artist")
  const swapped = await fetchFromLyricsOvh(title, artist);
  if (swapped) return { lyrics: swapped, title: artist, artist: title };

  // Strategy 3: No artist, just cleaned title
  const noArtist = await fetchFromLyricsOvh('', cleanTitle(query));
  if (noArtist) return { lyrics: noArtist, title: query, artist: '' };

  return null;
}

module.exports = { getLyrics, parseArtistTitle, cleanTitle };
