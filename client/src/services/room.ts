import type { QueueMode, RoomState, Track } from "@/types";
import { appStore, CLIENT_ID, toast, writeLocal } from "@/state/store";
import { getSocket, request } from "./socket";
import { fetchConfig } from "./api";
import { clock } from "@/sync/clock";

function setSession(code: string, name: string) {
  const session = { code, name };
  appStore.set({ session });
  writeLocal("syncwave.session", session);
  writeLocal("syncwave.lastName", name);
}

function clearSession() {
  appStore.set({ session: null, room: null, me: null });
  writeLocal("syncwave.session", null);
}

export async function createRoom(name: string) {
  appStore.set({ joining: true });
  try {
    const { state, you } = await request<{ state: RoomState; you: string }>("room:create", { name, clientId: CLIENT_ID });
    setSession(state.code, name);
    appStore.set({ room: state, me: you });
  } finally {
    appStore.set({ joining: false });
  }
}

export async function joinRoom(code: string, name: string) {
  appStore.set({ joining: true });
  try {
    const { state, you } = await request<{ state: RoomState; you: string }>("room:join", { code, name, clientId: CLIENT_ID });
    setSession(state.code, name);
    appStore.set({ room: state, me: you });
  } finally {
    appStore.set({ joining: false });
  }
}

export function leaveRoom() {
  request("room:leave").catch(() => {});
  clearSession();
  if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
}

/** Fire-and-forget room action: surfaces failures as a toast. */
function act(event: string, payload: object = {}, success?: string) {
  return request(event, payload)
    .then((res) => {
      if (success) toast(success, "success");
      return res;
    })
    .catch((err: Error) => {
      toast(err.message, "error");
      throw err;
    });
}

const quiet = (p: Promise<unknown>) => void p.catch(() => {});

export const play = () => quiet(act("playback:play"));
export const pause = () => quiet(act("playback:pause"));
export const seek = (position: number) => quiet(act("playback:seek", { position }));
export const next = () => quiet(act("playback:next"));
export const previous = () => quiet(act("playback:previous"));
export const cycleRepeat = () => quiet(act("playback:repeat"));
export const shuffleQueue = () => quiet(act("queue:shuffle", {}, "Queue shuffled"));

export const addToQueue = (track: Track, mode: QueueMode) =>
  act("queue:add", { track, mode }, mode === "now" ? undefined : mode === "next" ? "Playing next" : "Song added");
export const removeFromQueue = (uid: string) => quiet(act("queue:remove", { uid }));
export const moveInQueue = (uid: string, delta: number) => quiet(act("queue:move", { uid, delta }));
export const moveInQueueTo = (uid: string, toIndex: number) => quiet(act("queue:move", { uid, toIndex }));
export const playFromQueue = (uid: string) => quiet(act("queue:play", { uid }));

export const suggest = (track: Track) =>
  request<{ duplicate?: boolean }>("suggest:add", { track })
    .then((res) => toast(res.duplicate ? "Already suggested — added your vote" : "Suggestion sent to the host", "success"))
    .catch((err: Error) => {
      toast(err.message, "error");
      throw err;
    });
export const vote = (uid: string) => quiet(act("suggest:vote", { uid }));
export const acceptSuggestion = (uid: string, mode: QueueMode) =>
  quiet(act("suggest:accept", { uid, mode }, mode === "now" ? undefined : "Added to queue"));
export const dismissSuggestion = (uid: string) => quiet(act("suggest:dismiss", { uid }));

export const transferHost = (memberId: string) => quiet(act("host:transfer", { memberId }, "Host handed over"));

export function reportTrackReady(trackUid: string, duration: number | null) {
  request("track:ready", { trackUid, duration }).catch(() => {});
}

export function reportTrackError(trackUid: string) {
  request("track:error", { trackUid }).catch(() => {});
}

// --- connection lifecycle -------------------------------------------------
let initialised = false;

export function initConnection() {
  if (initialised) return;
  initialised = true;
  const socket = getSocket();

  socket.on("connect", async () => {
    appStore.set({ connection: "online" });
    clock.start(socket);

    // Transparent rejoin after a refresh or a dropped connection.
    const { session } = appStore.get();
    if (session) {
      try {
        const { state, you } = await request<{ state: RoomState; you: string }>("room:join", {
          code: session.code,
          name: session.name,
          clientId: CLIENT_ID,
        });
        appStore.set({ room: state, me: you });
      } catch (err) {
        clearSession();
        toast(err instanceof Error ? err.message : "That room has ended", "error");
      }
    }
  });

  socket.on("disconnect", () => {
    appStore.set({ connection: "offline" });
    clock.stop();
  });

  socket.on("connect_error", () => appStore.set({ connection: "offline" }));

  socket.on("room:state", (state: RoomState) => {
    if (appStore.get().session?.code !== state.code) return;
    const prev = appStore.get().room;
    if (prev?.code === state.code) {
      // "Priya joined" — only for genuinely new people, not reconnects.
      const known = new Set(prev.members.map((m) => m.id));
      const me = appStore.get().me;
      state.members.filter((m) => !known.has(m.id) && m.id !== me).forEach((m) => toast(`${m.name} joined`));
    }
    appStore.set({ room: state });
  });

  socket.on("room:notice", ({ message }: { message: string }) => toast(message));

  socket.on("room:kicked", ({ reason }: { reason: string }) => {
    // Only this tab lets go; the stored session belongs to the newer tab.
    appStore.set({ session: null, room: null, me: null });
    toast(reason, "error");
  });

  fetchConfig()
    .then((cfg) => appStore.set({ youtubeSearch: cfg.youtubeSearch }))
    .catch(() => {});

  socket.connect();
}
