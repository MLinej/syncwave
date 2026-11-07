// Backend URL resolution.
//
// By default the client talks to the same origin it was loaded from:
// - in development Vite proxies /api, /audio and /socket.io to the server
//   (see vite.config.ts), so phones on the LAN only need the Vite address;
// - in production the server serves the built client itself.
// Set VITE_BACKEND_URL only when the server lives on a different origin.
function resolveBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }
  return window.location.origin;
}

export const BACKEND_URL = resolveBackendUrl();
export const SOCKET_URL = BACKEND_URL;
export const API_BASE_URL = `${BACKEND_URL}/api`;
