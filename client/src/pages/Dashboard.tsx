import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import Sidebar from "@/components/Sidebar/Sidebar";
import Header from "@/components/Header/Header";
import NowPlayingCard from "@/components/NowPlayingCard/NowPlayingCard";
import SongTable from "@/components/SongTable/SongTable";
import RoomInfo from "@/components/RoomInfo/RoomInfo";
import BottomPlayer from "@/components/BottomPlayer/BottomPlayer";
import GlobalAudio from "@/components/GlobalAudio/GlobalAudio";
import Toast from "@/components/Toast/Toast";
import CreateRoom from "@/components/CreateRoom/CreateRoom";
import JoinRoom from "@/components/JoinRoom/JoinRoom";

export default function Dashboard() {
  const { setSongs, setLoading, setError, activeNav } = useApp();
  useSocketListeners();

  useEffect(() => {
    async function loadSongs() {
      setLoading(true);
      try {
        const songs = await api.getSongs();
        setSongs(songs);
      } catch {
        // Backend not available — render empty state
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }
    loadSongs();
  }, [setSongs, setLoading, setError]);

  return (
    <div
      className="relative w-full min-h-screen pb-[150px] overflow-hidden"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 1280 1174' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(133.71 0 0 133.71 640 0)'><stop stop-color='rgba(62,31,122,1)' offset='0'/><stop stop-color='rgba(46,25,98,1)' offset='0.225'/><stop stop-color='rgba(30,18,74,1)' offset='0.45'/><stop stop-color='rgba(21,13,52,1)' offset='0.725'/><stop stop-color='rgba(12,8,30,1)' offset='1'/></radialGradient></defs></svg>\")",
      }}
    >
      {/* Atmospheric glows */}
      <div className="absolute -top-[250px] -left-[250px] w-[500px] h-[500px] rounded-full bg-[rgba(198,191,255,0.2)] blur-[75px] pointer-events-none" />
      <div className="absolute -bottom-[150px] -right-[150px] w-[600px] h-[600px] rounded-full bg-[rgba(255,179,174,0.1)] blur-[90px] pointer-events-none" />

      {/* Layout */}
      <div className="relative flex gap-8 p-8 min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 gap-8 overflow-hidden">
          <Header />
          
          {activeNav === "create-room" ? (
            <CreateRoom />
          ) : activeNav === "join-room" ? (
            <JoinRoom />
          ) : (
            <>
              <NowPlayingCard />
              <SongTable />
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="shrink-0 w-[236px]">
          <RoomInfo />
        </div>
      </div>

      {/* Floating playback bar */}
      <BottomPlayer />

      <GlobalAudio />
      <Toast />
    </div>
  );
}
