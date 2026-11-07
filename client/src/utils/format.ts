export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "–:––";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Stable hue for a string — used for avatars and generated artwork. */
export function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/?room=${code}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back for plain-HTTP LAN use.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

// YouTube titles carry a lot of packaging: "(Official Video)", "[4K]",
// "| Album Name", "ft. X" duplicates… Strip it for display.
const NOISE =
  /\s*[([【](?:[^)\]】]*?\b(?:official|video|audio|lyrics?|lyrical|visuali[sz]er|4k|hd|hq|remaster(?:ed)?|full song|music video|mv|explicit|clean|live)\b[^)\]】]*)[)\]】]/gi;

export function cleanTitle(title: string): string {
  let t = title.replace(NOISE, "");
  t = t.split(/\s+[|｜]\s+/)[0]; // "Song | Movie | Label" → "Song"
  t = t.replace(/\s*[-–—]\s*(official\s+)?(music\s+|lyric(al)?\s+)?(video|audio|lyrics?)\s*$/i, "");
  t = t.replace(/\s+official\s+(music\s+|lyric(al)?\s+)?(video|audio)\s*$/i, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t || title;
}

export function cleanArtist(artist: string): string {
  return artist.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim() || artist;
}

// Words that make up packaging, not a song name ("Lyrical Video", "Full Song"…).
const PACKAGING = /^(?:official\s+)?(?:full\s+|lyric(?:al)?\s+|music\s+|hd\s+|4k\s+|8k\s+)*(?:video|audio|song|lyrics?|mv|visuali[sz]er)(?:\s+song)?$/i;

/**
 * Split "A - B" YouTube titles into song + artist where it's safe:
 *   "Rick Astley - Never Gonna Give You Up"   → song "Never Gonna…", artist "Rick Astley" (channel matches)
 *   "Kesariya - Brahmastra" on a label channel → kept whole (could be "Song - Movie")
 *   "3 - Why This Kolaveri Di"                 → song "Why This…", artist = channel (a 1-char prefix is a movie/album, not an artist)
 *   "Why This Kolaveri Di - Lyrical Music Video" → song "Why This Kolaveri Di"
 */
export function displayTrack(track: { title: string; artist: string; source: string }): { title: string; artist: string } {
  if (track.source !== "youtube") return { title: track.title, artist: track.artist };
  let title = cleanTitle(track.title);
  const channel = cleanArtist(track.artist);
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
  if (!m) return { title: stripTrailingVideo(title), artist: channel };
  const [, left, right] = m.map((x) => x.trim());
  if (PACKAGING.test(right)) return { title: stripTrailingVideo(left), artist: channel };
  // "Song - Chipmunks Version" / "Song - Slowed + Reverb": a variant, not an artist split.
  if (/\b(version|remix|cover|edit|mix|reprise|unplugged|acoustic|slowed|reverb|lo-?fi|instrumental|karaoke)\b/i.test(right)) {
    return { title: `${stripTrailingVideo(left)} (${right})`, artist: channel };
  }
  if (left.length <= 3 || /^\d+$/.test(left)) return { title: stripTrailingVideo(right), artist: channel };
  // Only trust "Artist - Song" when the channel is that artist ("Luis Fonsi" on
  // LuisFonsiVEVO). Labels often post "Song - Movie" instead, so otherwise keep it whole.
  const norm = (x: string) => x.toLowerCase().replace(/vevo|official|music|[^a-z0-9]/g, "");
  const l = norm(left);
  const c = norm(channel);
  if (l && c && (c.includes(l) || l.includes(c))) return { title: stripTrailingVideo(right), artist: left };
  title = stripTrailingVideo(title);
  return { title, artist: channel };
}

function stripTrailingVideo(t: string): string {
  return t
    .replace(/\s+(?:\d{1,2}k|hd|hq|uhd)(?:\s*\/\s*(?:\d{1,2}k|hd))*(?=\s|$)/gi, "")
    .replace(/\s+(?:official\s+)?(?:music\s+|lyric(?:al)?\s+|full\s+)?(?:video|audio)(?:\s+song)?$/i, "")
    .trim() || t;
}
