import type { Track } from "@/types";
import { API_BASE_URL } from "@/config";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

export const fetchConfig = () => get<{ youtubeSearch: boolean }>("/config");

export const fetchLibrary = () => get<{ items: Track[] }>("/library").then((r) => r.items);

export const searchYouTube = (q: string) =>
  get<{ items: Track[] }>(`/youtube/search?q=${encodeURIComponent(q)}`).then((r) => r.items);

export const resolveYouTube = (url: string) =>
  get<{ item: Track }>(`/youtube/resolve?url=${encodeURIComponent(url)}`).then((r) => r.item);

export function looksLikeYouTubeLink(text: string): boolean {
  return /(youtube\.com|youtu\.be)\//i.test(text.trim());
}

/** True once a pasted link contains a full 11-character video id. */
export function isCompleteYouTubeLink(text: string): boolean {
  return /(?:youtu\.be\/|[?&]v=|\/(?:shorts|embed|live)\/)[A-Za-z0-9_-]{11}(?![A-Za-z0-9_-])/.test(text.trim());
}
