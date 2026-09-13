// Central place for backend/socket URL resolution.
//
// Priority:
// 1. VITE_BACKEND_URL from .env (explicit override, e.g. a fixed LAN IP)
// 2. Same hostname the page was loaded from, port 3000 (works automatically
//    whether you open the app via localhost or a LAN IP, since Vite is
//    started with --host 0.0.0.0 and the server also binds 0.0.0.0)
function resolveBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
}

export const BACKEND_URL = resolveBackendUrl();
export const SOCKET_URL = BACKEND_URL;
export const API_BASE_URL = `${BACKEND_URL}/api`;
