import { useApp } from "@/context/AppContext";
import { usePlayback } from "@/hooks/usePlayback";
import SongRow from "@/components/SongRow/SongRow";
import Loader, { SongRowSkeleton } from "@/components/Loader/Loader";
import type { Song } from "@/types";

export default function SongTable() {
  const { songs, loading, currentTrack, isHost } = useApp();
  const { select } = usePlayback();

  const handlePlay = (song: Song) => {
    if (isHost) select(song.id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Header */}
      <div className="flex items-center justify-between pl-2 pr-2 mb-4 shrink-0">
        <h2 className="text-white text-[20px] font-semibold font-[Inter,sans-serif]">Available Songs</h2>
        <button className="text-[#c6bfff] text-[12px] font-semibold font-[Inter,sans-serif] hover:text-white transition-colors">
          Show all
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center shrink-0 mb-1 pr-4">
        <div className="w-[51px] flex justify-center">
          <span className="text-[rgba(255,255,255,0.3)] text-[11px] font-bold tracking-[1.1px] uppercase font-[Inter,sans-serif]">#</span>
        </div>
        <div className="w-[169px] pl-4">
          <span className="text-[rgba(255,255,255,0.3)] text-[11px] font-bold tracking-[1.1px] uppercase font-[Inter,sans-serif]">TITLE</span>
        </div>
        <div className="w-[153px] pl-8">
          <span className="text-[rgba(255,255,255,0.3)] text-[11px] font-bold tracking-[1.1px] uppercase font-[Inter,sans-serif]">ARTIST</span>
        </div>
        <div className="w-[65px] px-4">
          <span className="text-[rgba(255,255,255,0.3)] text-[11px] font-bold tracking-[1.1px] uppercase font-[Inter,sans-serif]">TIME</span>
        </div>
        <div className="flex-1 px-4">
          <span className="text-[rgba(255,255,255,0.3)] text-[11px] font-bold tracking-[1.1px] uppercase font-[Inter,sans-serif]">ALBUM</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-[6px] pr-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)
        ) : songs.length === 0 ? (
          <Loader variant="empty" message="No songs available" />
        ) : (
          songs.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              index={i}
              isActive={currentTrack?.id === song.id}
              onPlay={handlePlay}
            />
          ))
        )}
      </div>
    </div>
  );
}
