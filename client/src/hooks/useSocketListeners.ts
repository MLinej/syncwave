import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useApp } from "@/context/AppContext";
import { getSocket } from "@/services/socket";
import { mapBackendRoom } from "@/services/api";

// --- Clock sync tuning -------------------------------------------------
const CLOCK_SYNC_SAMPLES = 5; // samples taken per sync round; lowest RTT wins
const CLOCK_SYNC_SAMPLE_GAP_MS = 150; // gap between samples within a round
const CLOCK_SYNC_RESYNC_INTERVAL_MS = 45000; // re-sync period to correct for clock drift

type ClockSyncAck = { serverTime: number; clientTime: number | null };

function runClockSyncRound(socket: Socket, onOffset: (offsetMs: number) => void) {
  let best: { rtt: number; offset: number } | null = null;
  let completed = 0;

  const takeSample = () => {
    const clientSendTime = Date.now();
    socket.emit("clock-sync", { clientTime: clientSendTime }, (ack: ClockSyncAck) => {
      const rtt = Date.now() - clientSendTime;
      const offset = ack.serverTime - (clientSendTime + rtt / 2);
      console.log(`[ClockSync] sample ${completed + 1}/${CLOCK_SYNC_SAMPLES}: rtt=${rtt}ms offset=${offset.toFixed(1)}ms`);

      if (!best || rtt < best.rtt) {
        best = { rtt, offset };
      }
      completed += 1;

      if (completed >= CLOCK_SYNC_SAMPLES) {
        console.log(`[ClockSync] round complete — chosen offset=${best!.offset.toFixed(1)}ms (best rtt=${best!.rtt}ms)`);
        onOffset(best!.offset);
      } else {
        setTimeout(takeSample, CLOCK_SYNC_SAMPLE_GAP_MS);
      }
    });
  };

  takeSample();
}

function mapPlaybackStatePayload(ps: any) {
  return {
    status: ps?.status ?? "stopped",
    isPlaying: ps?.status === "playing",
    position: ps?.position ?? 0,
    anchorPosition: ps?.position ?? 0,
    scheduleAt: ps?.scheduleAt ?? null,
  };
}

export function useSocketListeners() {
  const { setRoom, setPlayback, setError, setSocketStatus, setLatency, setClockOffsetMs, setCurrentUser, songs } = useApp();

  useEffect(() => {
    const socket = getSocket();
    let pingInterval: ReturnType<typeof setInterval>;
    let clockSyncInterval: ReturnType<typeof setInterval>;

    const onConnect = () => {
      setSocketStatus("connected");
      pingInterval = setInterval(() => {
        const start = Date.now();
        socket.volatile.emit("ping", () => {
          setLatency(Date.now() - start);
        });
      }, 2000);

      runClockSyncRound(socket, setClockOffsetMs);
      clockSyncInterval = setInterval(() => {
        runClockSyncRound(socket, setClockOffsetMs);
      }, CLOCK_SYNC_RESYNC_INTERVAL_MS);
    };

    const onDisconnect = () => {
      setSocketStatus("disconnected");
      if (pingInterval) clearInterval(pingInterval);
      if (clockSyncInterval) clearInterval(clockSyncInterval);
    };

    const onRoomUsers = (data: any) => {
      const roomData = mapBackendRoom(data);
      setRoom(roomData);

      const me = roomData.connectedUsers.find((u: any) => u.id === socket.id);
      if (me) setCurrentUser(me);

      // Also sync initial playback state if provided
      if (data.currentTrack) {
        const song = songs.find(s => s.id === data.currentTrack.id);
        if (song) {
          setPlayback({ currentSong: song });
        }
      }
      if (data.playbackState) {
        setPlayback(mapPlaybackStatePayload(data.playbackState));
      }
    };

    const onTrackSelected = (data: any) => {
      const song = songs.find(s => s.id === data.track.id);
      if (song) {
        setPlayback({
          currentSong: song,
          isPlaying: false,
          status: "stopped",
          position: 0,
          anchorPosition: 0,
          scheduleAt: null,
        });
      }
    };

    const onPlaybackStateUpdated = (data: any) => {
      setPlayback(mapPlaybackStatePayload(data.playbackState));
    };

    const onRoomError = (data: any) => {
      setError(data.message || "An error occurred");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-users", onRoomUsers);
    socket.on("track-selected", onTrackSelected);
    socket.on("playback-state-updated", onPlaybackStateUpdated);
    socket.on("room-error", onRoomError);

    // Initial status
    setSocketStatus(socket.connected ? "connected" : "disconnected");
    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (clockSyncInterval) clearInterval(clockSyncInterval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-users", onRoomUsers);
      socket.off("track-selected", onTrackSelected);
      socket.off("playback-state-updated", onPlaybackStateUpdated);
      socket.off("room-error", onRoomError);
      // Deliberately NOT calling socket.disconnect() here: `socket` is a
      // module-level singleton meant to live for the app's lifetime. In dev,
      // React 18 StrictMode runs this effect's cleanup immediately after its
      // first mount (mount -> cleanup -> mount) — disconnecting the shared
      // socket here raced the handshake and caused repeated reconnects (and
      // repeated clock-sync rounds) on every load. Removing our listeners is
      // enough; the socket itself is torn down by disconnectSocket() if the
      // app ever needs to fully reset the connection.
    };
  }, [setRoom, setPlayback, setError, setSocketStatus, setLatency, setClockOffsetMs, setCurrentUser, songs]);
}
