import { useApp } from "@/context/AppContext";
import StatusBadge from "@/components/StatusBadge/StatusBadge";
import MemberList from "@/components/MemberList/MemberList";
import QRCard from "@/components/QRCard/QRCard";

export default function RoomInfo() {
  const { room, loading, connectedUsers, currentUser } = useApp();

  const hostUser = connectedUsers.find((u) => u.isHost);
  const hostName = hostUser?.name ?? currentUser?.name ?? "Unknown";

  return (
    <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] rounded-3xl border border-[rgba(255,255,255,0.08)] w-full flex flex-col gap-4 p-6">
      {/* Title */}
      <h2 className="text-white text-[20px] font-semibold font-[Inter,sans-serif]">Room Information</h2>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge variant="host" label={`HOST: ${hostName.toUpperCase()}`} />
        {room?.isLive && <StatusBadge variant="live" />}
        {room?.isSynced && <StatusBadge variant="synced" />}
      </div>

      {/* Members */}
      <div className="flex flex-col gap-3">
        <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold tracking-[1px] uppercase font-[Inter,sans-serif]">
          CONNECTED MEMBERS
        </p>
        <MemberList users={connectedUsers} isLoading={loading} />
      </div>

      {/* Divider + QR */}
      <div className="border-t border-[rgba(255,255,255,0.05)] pt-8 mt-2">
        <QRCard />
      </div>
    </div>
  );
}
