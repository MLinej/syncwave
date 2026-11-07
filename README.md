# SyncWave

Turn every phone in the room into one speaker. One person hosts a room, friends join by QR code or link, and every device plays the same song in tight sync. Anyone can suggest songs from YouTube; the host decides what plays.

## Quick start (development)

```bash
cd server && npm install && npm run dev      # API + realtime on :3000
cd client && npm install && npm run dev      # app on :8443 (proxies to :3000)
```

Open `http://localhost:8443` on the laptop. On phones (same Wi-Fi), open `http://<laptop-LAN-IP>:8443` or scan the QR code in the room's **Invite** sheet. Find the IP with `hostname -I` (Linux), `ipconfig getifaddr en0` (macOS) or `ipconfig` (Windows).

Vite proxies `/api`, `/audio` and `/socket.io` to the server, so phones only need the one address.

> **YouTube and IP addresses.** YouTube refuses to play embeds on pages opened by bare IP ("This video is unavailable", error 150). The app detects this and redirects to `http://<LAN-IP>.nip.io:8443`, a public DNS name that points back to your laptop. That needs internet for the DNS lookup, which YouTube needs anyway. You can also open that address directly. Library songs work on either address.

## Deploy: frontend on Vercel, backend on Render

The repo is set up for this split (`render.yaml` at the root, `client/vercel.json`). Do the backend first so you have its URL.

**1. Backend → Render**
1. Render dashboard → **New → Blueprint** → select this GitHub repo. It reads `render.yaml` and creates the `syncwave-server` web service (root `server/`, Node 22, health check `/api/health`).
2. When prompted, set `CORS_ORIGIN` to your Vercel URL. You don't know it yet, so enter a placeholder like `https://syncwave.vercel.app` and fix it after step 2. Optionally set `YOUTUBE_API_KEY`.
3. Deploy, then copy the service URL, e.g. `https://syncwave-server.onrender.com`. Check `…/api/health` returns `{"ok":true}`.

**2. Frontend → Vercel**
1. Vercel → **Add New → Project** → import the repo.
2. Set **Root Directory** to `client`. Framework, build and output come from `client/vercel.json`.
3. Under **Environment Variables**, add `VITE_BACKEND_URL` = your Render URL (no trailing slash). The build fails with a clear message if it's missing.
4. Deploy and copy the URL, e.g. `https://syncwave.vercel.app`.

**3. Connect them**
- In Render → `syncwave-server` → **Environment**, set `CORS_ORIGIN` to the exact Vercel URL. To also allow preview deploys, add a wildcard entry: `https://syncwave.vercel.app,https://syncwave-*.vercel.app`. Save; Render redeploys.
- If you later add a custom domain on Vercel, add it to `CORS_ORIGIN` too. If you move the backend, update `VITE_BACKEND_URL` and redeploy Vercel; the variable is baked in at build time.

**Good to know**
- Render's **free** plan sleeps after ~15 minutes without traffic. The first visit then takes ~30-60s to wake up, and any open rooms are lost when it sleeps or redeploys (rooms live in memory). A paid instance stays awake.
- The server only accepts browser connections (HTTP and WebSocket) from origins in `CORS_ORIGIN`.

## Single-server alternative

```bash
cd client && npm run build                   # outputs client/dist
cd server && npm start                       # serves client/dist + API on one port
```

Put it behind HTTPS (Caddy, nginx, Cloudflare Tunnel…). HTTPS unlocks the clipboard API, screen wake lock and share sheets on phones.

### Server environment

Put these in `server/.env` (copy `server/.env.example`). It's loaded automatically by `npm run dev` / `npm start` and is git-ignored.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket port |
| `YOUTUBE_API_KEY` | — | Enables YouTube **search**. Without it, users can still paste YouTube links. |
| `CORS_ORIGIN` | `*` | Allowed frontend origins, comma-separated, one `*` wildcard per entry (e.g. `https://syncwave.vercel.app,https://syncwave-*.vercel.app`). Applies to the API and to WebSocket connections. |
| `TRUST_PROXY` | `1` | Number of reverse proxies in front of the server (Render = 1), so rate limits see real client IPs |

YouTube Data API search costs 100 quota units per query (the free tier is 10,000 units/day). Results are cached for 30 minutes, and the endpoint is rate-limited per IP.

Client: set `VITE_BACKEND_URL` only if the API runs on a different origin than the page.

## How the sync works

All devices share one clock: the server's monotonic clock.

1. **Clock sync.** Each client runs NTP-style ping bursts over the WebSocket and keeps the median offset of its lowest-latency samples. It re-measures after every reconnect or wake-up.
2. **Scheduled changes.** Play, pause and seek are never applied on receipt. The server sends *"position P at server time T"*, with T 0.7–1.4 s in the future, so every device can pre-roll.
3. **Library songs (Web Audio).** The file is decoded and started with `AudioBufferSourceNode.start(when, offset)`. `when` is mapped through `getOutputTimestamp()`, so the moment sound leaves the speaker lines up, output latency included. A drift loop trims `playbackRate` by up to ±0.3% (inaudible) and crossfades to a re-sync if a device slips more than 40 ms. Typical spread between devices: a few milliseconds. Files over 40 MB stream through a media element with closed-loop correction instead, because decoding them could exhaust a phone's memory.
4. **YouTube songs.** These play through the official IFrame embed, which can't be scheduled sample-accurately. Each device instead runs a closed loop against the shared clock: it starts muted, seeks with a learned per-device seek latency until within 45 ms, then unmutes. A ±5% pitch-preserving tempo trim then holds it within about ±10 ms.
5. **Bluetooth.** Headphones and speakers add delay the browser can't see. Each device has a *Device delay compensation* slider (Sync & audio sheet) with presets.

Other mobile details:
- Audio unlocks on the first tap.
- The iOS mute switch is bypassed via `navigator.audioSession`.
- Screen wake lock is held while playing.
- Lock-screen controls go through the Media Session API.
- Reconnects are automatic and keep the same seat, including the host role. The host role passes on only after 20 s offline.

## Features

- Host a room, or join with a 6-character code, link or QR code
- YouTube search or link paste, plus a library of files in `server/public/audio`
- Guests **suggest** songs and **upvote** each other's picks. The host can play now, play next, queue or dismiss.
- Queue: reorder, remove, play now, auto-advance
- Waits for every device to load before starting (max 8 s, then late devices join mid-song in sync)
- Per-device volume and delay calibration, plus live sync diagnostics
- Mobile-first layout with bottom tabs and a mini player; two columns on desktop

## Project layout

```
server/
  server.js            rooms, membership, queue, suggestions, playback scheduler
  lib/youtube.js       search / link resolution / validation
  public/audio/        room library (any mp3/m4a/wav/ogg/flac/opus/webm)
client/src/
  sync/                clock sync, Web Audio engine, YouTube engine, glue
  services/            socket, REST API, room actions + reconnect
  state/               tiny external stores (room, sync, toasts)
  pages/               Landing, RoomView
  components/room/     NowPlaying, Queue, Search, People, Sync & Invite sheets
```

State is in memory: restarting the server ends all rooms.
