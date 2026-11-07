// YouTube refuses to play embeds (error 150, "This video is unavailable") on
// pages served from a bare IP address — which is exactly how phones reach a
// laptop on the LAN (http://192.168.x.x:port). nip.io is public wildcard DNS
// that maps "<ip>.nip.io" back to <ip>, giving the same server a hostname
// YouTube accepts. Redirect there automatically when it's reachable.

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export const isIpHost = (hostname = window.location.hostname) => IPV4.test(hostname);

export function hostnameUrlFor(hostname = window.location.hostname): string {
  const { protocol, port } = window.location;
  const host = hostname === "127.0.0.1" ? "localhost" : `${hostname}.nip.io`;
  return `${protocol}//${host}${port ? `:${port}` : ""}`;
}

/** Resolves true if the page is navigating away to the hostname URL. */
export async function redirectOffIpAddress(): Promise<boolean> {
  const { hostname, pathname, search, hash } = window.location;
  if (!isIpHost(hostname)) return false;
  const target = hostnameUrlFor(hostname);
  try {
    // Only redirect if the hostname actually resolves and reaches this server
    // (needs internet for DNS — offline LAN use stays on the IP).
    const res = await fetch(`${target}/api/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  window.location.replace(`${target}${pathname}${search}${hash}`);
  return true;
}
