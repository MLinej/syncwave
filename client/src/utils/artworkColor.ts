import { useEffect, useState } from "react";
import type { Track } from "@/types";
import { hueOf } from "./format";

// Accent colors from the current album art. YouTube thumbnails (i.ytimg.com)
// are CORS-enabled, so they can be sampled on a canvas; library songs get a
// stable hue derived from their title.
//   accent — bright, for the progress fill, active tab, "now playing" text
//   glow   — deep, for the aurora blobs and the play-button glow

export interface ArtworkColors {
  accent: string;
  glow: string;
}

const DEFAULT: ArtworkColors = { accent: "hsl(29 89% 63%)", glow: "hsl(26 37% 18%)" };
const hueCache = new Map<string, { h: number; s: number }>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function fromHue(h: number, s: number): ArtworkColors {
  // Near-grey art still gets a gentle tint rather than a muddy grey accent.
  const sat = Math.max(0.35, Math.min(0.85, s));
  return {
    accent: `hsl(${h.toFixed(0)} ${(sat * 100).toFixed(0)}% 72%)`,
    glow: `hsl(${h.toFixed(0)} ${(Math.min(sat, 0.7) * 100).toFixed(0)}% 30%)`,
  };
}

export function libraryColor(title: string): string {
  return `hsl(${hueOf(title)} 55% 45%)`;
}

function sampleImage(url: string): Promise<{ h: number; s: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        // Weight colourful mid-tones; skip letterbox black/white.
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (l < 0.08 || l > 0.92) continue;
          const weight = 0.15 + s * s * 2;
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
          w += weight;
        }
        if (!w) return resolve(null);
        const [h, s] = rgbToHsl(r / w, g / w, b / w);
        resolve({ h, s });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function useArtworkColors(track: Track | null | undefined): ArtworkColors {
  const key = track ? (track.thumbnail ?? `lib:${track.title}`) : "";
  const [colors, setColors] = useState<ArtworkColors>(DEFAULT);

  useEffect(() => {
    if (!track) {
      setColors(DEFAULT);
      return;
    }
    if (!track.thumbnail) {
      setColors(fromHue(hueOf(track.title), 0.6));
      return;
    }
    const cached = hueCache.get(track.thumbnail);
    if (cached) {
      setColors(fromHue(cached.h, cached.s));
      return;
    }
    let alive = true;
    void sampleImage(track.thumbnail).then((hs) => {
      if (!hs) return;
      hueCache.set(track.thumbnail!, hs);
      if (alive) setColors(fromHue(hs.h, hs.s));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return colors;
}
