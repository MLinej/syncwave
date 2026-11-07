import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/config";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      // WebSocket only: long-polling has asymmetric latency, which skews
      // the clock-sync round trips the whole sync model depends on.
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

type Ack<T> = { ok: true } & T;

/** Emit with an acknowledgement; rejects with the server's error message. */
export function request<T = object>(event: string, payload: object = {}, timeoutMs = 8000): Promise<Ack<T>> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    if (!s.connected) {
      reject(new Error("You're offline — reconnecting…"));
      return;
    }
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: { ok: boolean; error?: string } & T) => {
      if (err) reject(new Error("The server didn't respond. Check your connection."));
      else if (!res?.ok) reject(new Error(res?.error || "Something went wrong"));
      else resolve(res as Ack<T>);
    });
  });
}
