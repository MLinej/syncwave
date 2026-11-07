import { appStore, useStore } from "@/state/store";
import { leaveRoom } from "@/services/room";
import Landing from "@/pages/Landing";
import RoomView from "@/pages/RoomView";
import Toasts from "@/components/ui/Toasts";
import { SpinnerIcon } from "@/components/ui/Icons";

export default function App() {
  const session = useStore(appStore, (s) => s.session);
  const hasRoom = useStore(appStore, (s) => !!s.room);

  return (
    <>
      {hasRoom ? (
        <RoomView />
      ) : session ? (
        // Rejoining a saved session after a refresh.
        <div className="grid min-h-dvh place-items-center">
          <div className="flex flex-col items-center gap-3">
            <SpinnerIcon size={24} className="animate-spin text-accent" />
            <span className="text-base text-muted">Rejoining room {session.code}…</span>
            <button className="btn btn-secondary mt-2" onClick={leaveRoom}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <Landing />
      )}
      <Toasts />
    </>
  );
}
