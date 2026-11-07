import { useEffect, useState } from "react";
import { appStore, useStore } from "@/state/store";
import { clock } from "./clock";
import { ytHost } from "./engines";
import type { PlaybackState } from "@/types";

export function positionNow(pb: PlaybackState | undefined): number {
  if (!pb) return 0;
  if (pb.status !== "playing" || pb.scheduleAt === null) return pb.position;
  return Math.max(pb.position, pb.position + (clock.serverNow() - pb.scheduleAt) / 1000);
}

/** Live playback position for display (not used for audio timing). */
export function usePlaybackPosition(intervalMs = 250): number {
  const pb = useStore(appStore, (s) => s.room?.playback);
  const [pos, setPos] = useState(() => positionNow(pb));
  useEffect(() => {
    setPos(positionNow(pb));
    if (pb?.status !== "playing") return;
    const id = setInterval(() => setPos(positionNow(pb)), intervalMs);
    return () => clearInterval(id);
  }, [pb, intervalMs]);
  return pos;
}

// Scroll containers that clip a slot (computed once per slot element).
const clipAncestors = new WeakMap<HTMLElement, HTMLElement[]>();
function clippingAncestors(el: HTMLElement): HTMLElement[] {
  let list = clipAncestors.get(el);
  if (!list) {
    list = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll" || o === "hidden") list.push(p);
    }
    clipAncestors.set(el, list);
  }
  return list;
}

/**
 * Keeps the single YouTube iframe glued to the most important visible slot
 * (`data-yt-slot="hero"` beats `"mini"`). When no slot is on screen it parks
 * off-screen but keeps playing.
 *
 * The dock is a fixed layer above the page, so it has to clip itself to the
 * part of the slot that is actually visible: inside any scrolling ancestor,
 * and (for the hero slot) below the floating header (`data-yt-ceiling`).
 */
export function useYouTubeDock(active: boolean) {
  useEffect(() => {
    const dock = ytHost.parentElement!;
    if (!active) {
      dock.style.left = "-10000px";
      return;
    }
    let raf = 0;
    let last = "";
    const loop = () => {
      const slots = Array.from(document.querySelectorAll<HTMLElement>("[data-yt-slot]"));
      const pick =
        slots.find((s) => s.dataset.ytSlot === "hero" && s.offsetParent !== null) ??
        slots.find((s) => s.dataset.ytSlot === "mini" && s.offsetParent !== null);
      const r = pick?.getBoundingClientRect();

      // Visible region of the slot.
      let top = 0, left = 0, right = window.innerWidth, bottom = window.innerHeight;
      if (pick && r) {
        for (const a of clippingAncestors(pick)) {
          const ar = a.getBoundingClientRect();
          top = Math.max(top, ar.top);
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
          bottom = Math.min(bottom, ar.bottom);
        }
        if (pick.dataset.ytSlot === "hero") {
          const ceiling = document.querySelector<HTMLElement>("[data-yt-ceiling]");
          if (ceiling) top = Math.max(top, ceiling.getBoundingClientRect().bottom);
        }
      }
      const visible = r && r.width > 0 && r.bottom > top && r.top < bottom && r.right > left && r.left < right;
      const clip = visible
        ? [Math.max(0, top - r.top), Math.max(0, r.right - right), Math.max(0, r.bottom - bottom), Math.max(0, left - r.left)].map((v) => Math.round(v))
        : null;
      const key = visible
        ? `${r.left}|${r.top}|${r.width}|${r.height}|${clip!.join(",")}|${pick!.dataset.ytRadius ?? ""}|${pick!.dataset.ytZ ?? ""}`
        : "off";
      if (key !== last) {
        last = key;
        if (visible) {
          const radius = pick!.dataset.ytRadius ?? "16px";
          Object.assign(dock.style, {
            left: `${r.left}px`,
            top: `${r.top}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
            borderRadius: radius,
            clipPath: clip!.some(Boolean) ? `inset(${clip!.map((v) => `${v}px`).join(" ")} round ${radius})` : "none",
            // Sit just above whatever the slot lives in (page content vs. the fixed mini player).
            zIndex: pick!.dataset.ytZ ?? "5",
            opacity: "1",
          });
        } else {
          Object.assign(dock.style, { left: "-10000px", width: "320px", height: "180px", clipPath: "none" });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      dock.style.left = "-10000px";
    };
  }, [active]);
}
