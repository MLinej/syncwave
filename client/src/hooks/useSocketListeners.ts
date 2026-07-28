import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { getSocket } from "@/services/socket";
import { mapBackendRoom } from "@/services/api";

export function useSocketListeners() {
  const { setRoom, setPlayback, setError, setSocketStatus, setLatency, setCurrentUser, songs } = useApp();

  useEffect(() => {
    const socket = getSocket();
    let pingInterval: ReturnType<typeof setInterval>;

    const onConnect = () => {
      setSocketStatus("connected");
      pingInterval = setInterval(() => {
        const start = Date.now();
        socket.volatile.emit("ping", () => {
          setLatency(Date.now() - start);
        });
      }, 2000);
    };
    
    const onDisconnect = () => {
      setSocketStatus("disconnected");
      if (pingInterval) clearInterval(pingInterval);
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
        setPlayback({
          isPlaying: data.playbackState.status === "playing",
          position: data.playbackState.position || 0,
        });
      }
    };

    const onTrackSelected = (data: any) => {
      const song = songs.find(s => s.id === data.track.id);
      if (song) {
        setPlayback({ 
          currentSong: song,
          isPlaying: false,
          position: 0 
        });
      }
    };

    const onPlaybackStateUpdated = (data: any) => {
      setPlayback({
        isPlaying: data.playbackState.status === "playing",
        position: data.playbackState.position || 0,
      });
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
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-users", onRoomUsers);
      socket.off("track-selected", onTrackSelected);
      socket.off("playback-state-updated", onPlaybackStateUpdated);
      socket.off("room-error", onRoomError);
      socket.disconnect();
    };
  }, [setRoom, setPlayback, setError, setSocketStatus, setLatency, setCurrentUser, songs]);
}
