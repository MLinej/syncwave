// YouTube helpers: search (YouTube Data API v3, needs YOUTUBE_API_KEY),
// link resolution (oEmbed, no key needed) and validation of client-supplied
// YouTube tracks. Playback itself happens client-side through the official
// IFrame Player API, so no media is ever downloaded or proxied here.

const API_KEY = process.env.YOUTUBE_API_KEY?.trim() || '';
const SEARCH_CACHE_TTL_MS = 30 * 60_000; // search costs 100 quota units — cache aggressively
const SEARCH_CACHE_MAX = 300;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const searchCache = new Map();

export function youtubeSearchEnabled() {
  return Boolean(API_KEY);
}

export function thumbnailFor(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function decodeEntities(text = '') {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// ISO-8601 duration ("PT1H2M3S") -> seconds
function parseIsoDuration(iso = '') {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((v) => Number(v) || 0);
  const total = d * 86400 + h * 3600 + min * 60 + s;
  return total > 0 ? total : null;
}

export function parseVideoId(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (VIDEO_ID_RE.test(value)) return value;

  let url;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
      id = match?.[1] ?? null;
    }
  }
  return id && VIDEO_ID_RE.test(id) ? id : null;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error(`YouTube request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchVideoDetails(ids) {
  if (!API_KEY || ids.length === 0) return new Map();
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'contentDetails,snippet,status');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', API_KEY);
  const data = await fetchJson(url);
  return new Map((data.items ?? []).map((item) => [item.id, item]));
}

function toTrack(videoId, { title, artist, duration }) {
  return {
    source: 'youtube',
    id: `yt:${videoId}`,
    videoId,
    title: decodeEntities(title || 'Untitled video').slice(0, 200),
    artist: decodeEntities(artist || 'YouTube').slice(0, 120),
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    thumbnail: thumbnailFor(videoId)
  };
}

export async function searchYouTube(rawQuery) {
  const query = String(rawQuery ?? '').trim().slice(0, 120);
  if (!query) return [];
  if (!API_KEY) {
    const err = new Error('YouTube search is not configured on this server. Paste a YouTube link instead.');
    err.status = 501;
    throw err;
  }

  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return cached.items;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('maxResults', '15');
  url.searchParams.set('q', query);
  url.searchParams.set('key', API_KEY);
  const data = await fetchJson(url);

  const ids = (data.items ?? []).map((item) => item.id?.videoId).filter((id) => VIDEO_ID_RE.test(id ?? ''));
  const details = await fetchVideoDetails(ids);

  const items = ids
    .map((id) => {
      const detail = details.get(id);
      if (detail && (detail.status?.embeddable === false || detail.snippet?.liveBroadcastContent === 'live')) {
        return null;
      }
      const snippet = detail?.snippet ?? data.items.find((item) => item.id?.videoId === id)?.snippet ?? {};
      return toTrack(id, {
        title: snippet.title,
        artist: snippet.channelTitle,
        duration: parseIsoDuration(detail?.contentDetails?.duration)
      });
    })
    .filter(Boolean);

  searchCache.set(key, { at: Date.now(), items });
  if (searchCache.size > SEARCH_CACHE_MAX) {
    searchCache.delete(searchCache.keys().next().value);
  }
  return items;
}

export async function resolveYouTube(input) {
  const videoId = parseVideoId(input);
  if (!videoId) {
    const err = new Error("That doesn't look like a YouTube link");
    err.status = 400;
    throw err;
  }

  let oembed;
  try {
    const url = new URL('https://www.youtube.com/oembed');
    url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set('format', 'json');
    oembed = await fetchJson(url);
  } catch (error) {
    const err = new Error(
      error.status === 401 || error.status === 403
        ? "This video can't be played outside YouTube"
        : 'Video not found'
    );
    err.status = 404;
    throw err;
  }

  let duration = null;
  try {
    const details = await fetchVideoDetails([videoId]);
    duration = parseIsoDuration(details.get(videoId)?.contentDetails?.duration);
  } catch {
    /* duration is optional — clients report it once the player loads */
  }

  return toTrack(videoId, { title: oembed.title, artist: oembed.author_name, duration });
}

// Clients send YouTube tracks they got from search/resolve. Never trust the
// payload as-is: re-derive the id/thumbnail and clamp the free-text fields.
export function sanitizeYouTubeTrack(input) {
  const videoId = input?.videoId;
  if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) return null;
  const duration = Number(input.duration);
  return toTrack(videoId, {
    title: typeof input.title === 'string' ? input.title : '',
    artist: typeof input.artist === 'string' ? input.artist : '',
    duration: duration > 0 && duration < 6 * 3600 ? duration : null
  });
}
