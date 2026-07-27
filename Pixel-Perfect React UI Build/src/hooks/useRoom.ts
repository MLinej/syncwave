import { useCallback, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";
import { emitJoinRoom, emitLeaveRoom } from "@/services/socket";

export function useRoom() {
  const { room, setRoom, setError, setLoading, setActiveNav } = useApp();
  const [joinRoomId, setJoinRoomId] = useState("");

  const create = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const newRoom = await api.createRoom();
      setRoom(newRoom);
      setActiveNav("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }, [setRoom, setError, setLoading]);

  const join = useCallback(async (roomId: string) => {
    if (!roomId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const joinedRoom = await api.joinRoom(roomId.trim());
      setRoom(joinedRoom);
      emitJoinRoom(joinedRoom.id);
      setActiveNav("dashboard");
      setJoinRoomId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  }, [setRoom, setError, setLoading]);

  const leave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.leaveRoom(room?.id);
      emitLeaveRoom(room?.id);
      setRoom(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    } finally {
      setLoading(false);
    }
  }, [setRoom, setError, setLoading]);

  const copyRoomId = useCallback(() => {
    const code = room?.code ?? "";
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setError("✅ Copied!");
  }, [room, setError]);

  const shareInvitation = useCallback(async () => {
    const code = room?.code ?? "";
    if (!code) return;
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my SonicSync room", url });
      } catch {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }, [room]);

  return { room, create, join, leave, copyRoomId, shareInvitation, joinRoomId, setJoinRoomId };
}
