import { WebAudioEngine } from "./webAudioEngine";
import { YouTubeEngine } from "./youtubeEngine";

// Engines are app-lifetime singletons: an unlocked AudioContext and a
// YouTube player the user has tapped are both "earned" with a gesture, and
// recreating them would make every device ask for another tap.
export const webAudio = new WebAudioEngine();

// The embed lives in one fixed element that is never re-parented (moving an
// iframe in the DOM reloads it). It's positioned over whichever video slot
// the UI currently shows — see useYouTubeDock().
export const ytHost: HTMLDivElement = (() => {
  // Drop any dock left behind by a hot reload so there is only ever one.
  document.getElementById("yt-dock")?.remove();
  const el = document.createElement("div");
  el.id = "yt-dock";
  el.setAttribute("aria-label", "YouTube player");
  Object.assign(el.style, {
    position: "fixed",
    left: "-10000px",
    top: "0px",
    width: "320px",
    height: "180px",
    zIndex: "5",
    overflow: "hidden",
    borderRadius: "16px",
    background: "#000",
    transition: "opacity 160ms ease",
  } satisfies Partial<CSSStyleDeclaration>);
  const inner = document.createElement("div");
  inner.style.width = "100%";
  inner.style.height = "100%";
  el.appendChild(inner);
  document.body.appendChild(el);
  return inner;
})();

export const youtube = new YouTubeEngine(ytHost);

// Dev-only handle for inspecting live engine state from the console.
if (import.meta.env.DEV) Object.assign(window, { __syncwave: { webAudio, youtube } });

/** Call from any click/tap handler: unlocks audio output on mobile browsers. */
export function unlockAudio() {
  if (!webAudio.unlocked) void webAudio.unlock();
}

// Engines hold live audio state; hot-swapping them would orphan the playing
// context/iframe, so edits to them trigger a full reload instead.
import.meta.hot?.accept(() => window.location.reload());
