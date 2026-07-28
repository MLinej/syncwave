import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useRoom } from "@/hooks/useRoom";
import type { NavItem } from "@/types";

// SVG Icon components
function DashboardIcon({ opacity = 1 }: { opacity?: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 2H8V8H2V2ZM10 2H16V8H10V2ZM2 10H8V16H2V10ZM10 10H16V16H10V10Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function CreateRoomIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Zm4 9h-3v3H9v-3H6V9h3V6h2v3h3v2Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function JoinRoomIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      <path d="M0 0H24V2H0V0ZM0 7H18V9H0V7ZM0 14H24V16H0V14Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function MyRoomsIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 3h14v14H3V3Zm2 2v10h10V5H5Zm2 2h6v2H7V7Zm0 4h6v2H7v-2Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function UsersIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="20.5" height="19.5" viewBox="0 0 20.5 19.5" fill="none">
      <path d="M7.5 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4Zm8-1a3 3 0 0 0 0-6v1.5a1.5 1.5 0 0 1 0 3V10Zm0 2h-.5c-.85.44-1.75.76-2.75.96C13.18 13.65 14.5 14.7 14.5 16v1.5h6V16c0-1.86-2.7-3.35-5-3.5Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function SettingsIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="20.1" height="20" viewBox="0 0 20.1 20" fill="none">
      <path d="M17.14 10.94c.04-.31.06-.63.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 12 .5H8c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.477.477 0 0 0-.59.22L.63 7.08a.468.468 0 0 0 .12.62l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94L.73 12.74a.468.468 0 0 0-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.468.468 0 0 0-.12-.62l-2.03-1.8ZM10 13.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function AboutIcon({ opacity = 0.6 }: { opacity?: number }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM10.75 14.5h-1.5V9h1.5v5.5Zm0-7h-1.5V6h1.5v1.5Z"
        fill={`rgba(255,255,255,${opacity})`} />
    </svg>
  );
}

function SonicSyncIcon() {
  return (
    <svg width="27" height="30" viewBox="0 0 27 30" fill="none">
      <path d="M13.5 0L27 7.5V22.5L13.5 30L0 22.5V7.5L13.5 0Z" fill="#C6BFFF" />
    </svg>
  );
}

interface NavLinkProps {
  id: NavItem;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function NavLink({ label, icon, activeIcon, active, onClick }: NavLinkProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-[10px] rounded-lg text-left transition-colors ${
        active ? "bg-[rgba(255,255,255,0.1)]" : "hover:bg-[rgba(255,255,255,0.05)]"
      }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="shrink-0">{active ? activeIcon : icon}</span>
      <span className={`text-[14px] font-[Inter,sans-serif] leading-[21px] ${
        active ? "text-white font-normal" : "text-[rgba(255,255,255,0.6)] font-normal"
      }`}>
        {label}
      </span>
    </motion.button>
  );
}

export default function Sidebar() {
  const { activeNav, setActiveNav, currentUser, socketStatus, roomCode } = useApp();
  const { leave } = useRoom();

  const navItems: Array<{ id: NavItem; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <DashboardIcon opacity={0.6} />, activeIcon: <DashboardIcon opacity={1} /> },
    { id: "create-room", label: "Create Room", icon: <CreateRoomIcon />, activeIcon: <CreateRoomIcon opacity={1} /> },
    { id: "join-room", label: "Join Room", icon: <JoinRoomIcon />, activeIcon: <JoinRoomIcon opacity={1} /> },
    { id: "my-rooms", label: "My Rooms", icon: <MyRoomsIcon />, activeIcon: <MyRoomsIcon opacity={1} /> },
    { id: "connected-users", label: "Connected Users", icon: <UsersIcon />, activeIcon: <UsersIcon opacity={1} /> },
  ];

  const systemItems: Array<{ id: NavItem; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }> = [
    { id: "settings", label: "Settings", icon: <SettingsIcon />, activeIcon: <SettingsIcon opacity={1} /> },
    { id: "about", label: "About", icon: <AboutIcon />, activeIcon: <AboutIcon opacity={1} /> },
  ];

  const isConnected = socketStatus === "connected";

  return (
    <aside className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] h-full rounded-3xl shrink-0 w-[215px] border border-[rgba(255,255,255,0.08)] flex flex-col px-6 py-8 gap-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <SonicSyncIcon />
        <span className="text-white text-[32px] font-black tracking-[-0.32px] font-[Inter,sans-serif] leading-none">
          SonicSync
        </span>
      </div>

      {/* Main nav */}
      <div className="flex flex-col gap-1 flex-1">
        <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold tracking-[1px] uppercase px-3 pb-2 font-[Inter,sans-serif]">
          MAIN MENU
        </p>
        {navItems.map((item) => (
          <NavLink key={item.id} {...item} active={activeNav === item.id} onClick={() => setActiveNav(item.id)} />
        ))}
        {roomCode && (
          <NavLink
            id={"dashboard" as NavItem}
            label="Leave Room"
            icon={<JoinRoomIcon opacity={0.6} />}
            activeIcon={<JoinRoomIcon opacity={1} />}
            active={false}
            onClick={() => { leave(); setActiveNav("dashboard"); }}
          />
        )}

        {/* System section */}
        <div className="pt-6">
          <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold tracking-[1px] uppercase px-3 pb-2 font-[Inter,sans-serif]">
            SYSTEM
          </p>
          {systemItems.map((item) => (
            <NavLink key={item.id} {...item} active={activeNav === item.id} onClick={() => setActiveNav(item.id)} />
          ))}
        </div>
      </div>

      {/* User profile */}
      <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] rounded-2xl border border-[rgba(255,255,255,0.08)] p-4 flex items-center gap-3">
        <div className="relative shrink-0">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[rgba(198,191,255,0.2)] flex items-center justify-center">
              <span className="text-[#c6bfff] text-sm font-bold font-[Inter,sans-serif]">
                {currentUser?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[14px] font-semibold truncate font-[Inter,sans-serif]">
            {currentUser?.name ?? "Guest"}
          </p>
          <p className="text-[rgba(255,255,255,0.4)] text-[12px] truncate font-[Inter,sans-serif]">
            {currentUser?.name ? "Premium member" : "Not signed in"}
          </p>
        </div>
        <div className={`w-[4.55px] h-2 rounded-full shrink-0 ${isConnected ? "bg-[#22c55e]" : "bg-[rgba(255,255,255,0.2)]"}`} />
      </div>
    </aside>
  );
}
