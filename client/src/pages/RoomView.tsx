import { useEffect, useState, type CSSProperties } from "react";
import { useIsHost, useMediaQuery, useRoom } from "@/state/selectors";
import SyncEngine from "@/sync/SyncEngine";
import { useArtworkColors } from "@/utils/artworkColor";
import { displayTrack } from "@/utils/format";
import Backdrop from "@/components/ui/Backdrop";
import Segmented from "@/components/ui/Segmented";
import Header from "@/components/room/Header";
import NowPlaying from "@/components/room/NowPlaying";
import QueuePanel from "@/components/room/QueuePanel";
import SearchPanel from "@/components/room/SearchPanel";
import PeoplePanel from "@/components/room/PeoplePanel";
import SyncSheet from "@/components/room/SyncSheet";
import MobileSheet from "@/components/room/MobileSheet";

type Panel = "queue" | "search" | "people";

export default function RoomView() {
  const r = useRoom();
  const isHost = useIsHost();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [panel, setPanel] = useState<Panel>("queue");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const colors = useArtworkColors(r.current?.track);

  // Accent lives on <html> so portaled sheets and toasts pick it up too.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", colors.accent);
    root.setProperty("--glow", colors.glow);
  }, [colors]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--glow");
    },
    [],
  );

  // Browser tab shows what's playing.
  const title = r.current ? displayTrack(r.current.track).title : null;
  useEffect(() => {
    document.title = title ? `♪ ${title} · SyncWave` : "SyncWave";
    return () => {
      document.title = "SyncWave";
    };
  }, [title]);

  const open = (p: Panel) => {
    setPanel(p);
    if (!desktop) setSheetOpen(true);
  };

  const tabs = (
    <Segmented
      layoutId={desktop ? "panel-tabs" : "sheet-tabs"}
      value={panel}
      onChange={open}
      options={[
        { id: "queue", label: "Queue", count: r.queue.length + (isHost ? r.suggestions.length : 0) },
        { id: "search", label: "Search" },
        { id: "people", label: "People", count: r.members.filter((m) => m.online).length },
      ]}
    />
  );

  const content =
    panel === "queue" ? <QueuePanel onGoToAdd={() => open("search")} /> : panel === "search" ? <SearchPanel /> : <PeoplePanel />;


  return (
    <div className="app-root relative isolate">
      <Backdrop />
      <SyncEngine />

      {desktop ? (
        <div className="flex h-dvh flex-col overflow-hidden">
          <Header onOpenSync={() => setSyncOpen(true)} onOpenPeople={() => open("people")} />
          <main className="mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 grid-cols-[minmax(0,1fr)_420px] gap-8 px-6 pb-6">
            <section className="flex min-h-0 flex-col overflow-y-auto py-2">
              <div className="m-auto w-full max-w-[460px]" style={{ "--art-size": "min(400px, 40dvh)" } as CSSProperties}>
                <NowPlaying onGoToAdd={() => open("search")} />
              </div>
            </section>
            <aside className="glass flex min-h-0 flex-col overflow-hidden rounded-[28px]">
              <div className="shrink-0 p-4">{tabs}</div>
              <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
            </aside>
          </main>
        </div>
      ) : (
        <div className="min-h-dvh">
          <Header onOpenSync={() => setSyncOpen(true)} onOpenPeople={() => open("people")} />
          <main className="px-6 pt-2 pb-[calc(120px+env(safe-area-inset-bottom))]" style={{ "--art-size": "min(82vw, 40dvh)" } as CSSProperties}>
            <NowPlaying onGoToAdd={() => open("search")} showVideo={!sheetOpen} />
          </main>
          <MobileSheet open={sheetOpen} setOpen={setSheetOpen} tabs={tabs}>
            {content}
          </MobileSheet>
        </div>
      )}

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
    </div>
  );
}
