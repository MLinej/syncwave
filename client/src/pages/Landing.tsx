import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { appStore, readLocal, toast, useStore } from "@/state/store";
import { createRoom, joinRoom } from "@/services/room";
import { unlockAudio } from "@/sync/engines";
import Backdrop from "@/components/ui/Backdrop";
import Segmented from "@/components/ui/Segmented";
import Wordmark from "@/components/ui/Wordmark";
import ListeningFriends from "@/components/ui/Listeners";
import { EqBars } from "@/components/room/NowPlaying";
import { HeadphonesIcon, PauseIcon, SpinnerIcon, UsersIcon, YouTubeIcon } from "@/components/ui/Icons";

const EASE = [0.22, 1, 0.36, 1] as const;

function codeFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("room");
  const fromPath = /^\/join\/([A-Za-z0-9]{4,8})/.exec(window.location.pathname)?.[1];
  return (fromQuery ?? fromPath ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/** Illustrative "now playing" card for the desktop hero (static sample, not live data). */
function SampleNowPlaying() {
  const phones = ["A", "M", "R", "S"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
      className="glass relative z-10 mx-auto mt-6 w-[360px] rounded-[24px] p-4 lg:short:mt-4"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent">
          <EqBars playing className="h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">Your song here</div>
          <div className="text-sm text-muted">Playing on every phone</div>
        </div>
        <span className="grid size-10 place-items-center rounded-full bg-white text-[#0a0a0c]">
          <PauseIcon size={16} />
        </span>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-2/5 rounded-full bg-accent" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          {phones.map((p, i) => (
            <span
              key={p}
              className="grid size-8 place-items-center rounded-full text-sm font-semibold ring-2 ring-[#16161b]"
              style={{ background: `hsl(${20 + i * 55} 30% 32%)` }}
            >
              {p}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="pulse-dot size-2 rounded-full bg-ok text-ok" />4 phones · in sync
        </span>
      </div>
    </motion.div>
  );
}

const FEATURES = [
  { icon: HeadphonesIcon, title: "Tight sync", text: "Every device lands on the same beat." },
  { icon: YouTubeIcon, title: "YouTube requests", text: "Anyone suggests, the host decides." },
  { icon: UsersIcon, title: "No app needed", text: "Scan a code and you're in." },
];

export default function Landing() {
  const joining = useStore(appStore, (s) => s.joining);
  const connection = useStore(appStore, (s) => s.connection);
  const [name, setName] = useState(() => readLocal<string>("syncwave.lastName", ""));
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"join" | "host">(codeFromUrl().length === 6 ? "join" : "host");

  const nameOk = name.trim().length > 0;
  const codeOk = code.length === 6;
  const online = connection === "online";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // This tap is the user gesture mobile browsers need before audio can play.
    unlockAudio();
    if (!nameOk) return toast("Enter your name first", "error");
    try {
      if (mode === "host") await createRoom(name.trim());
      else if (codeOk) await joinRoom(code, name.trim());
      else toast("Enter the 6-character room code", "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const form = (
    <form onSubmit={submit} className="glass rounded-[24px] p-4 lg:p-6">
      <Segmented
        layoutId="landing-mode"
        value={mode}
        onChange={setMode}
        options={[
          { id: "host", label: "Host a room" },
          { id: "join", label: "Join a room" },
        ]}
      />
      <div className="mt-4 space-y-2">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="nickname"
          enterKeyHint={mode === "join" ? "next" : "go"}
        />
        {mode === "join" && (
          <input
            className="field text-center tracking-[0.3em] uppercase placeholder:tracking-normal"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="Room code"
            aria-label="Room code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={joining || !online || !nameOk || (mode === "join" && !codeOk)}>
          {joining && <SpinnerIcon size={18} className="animate-spin" />}
          {mode === "host" ? "Start listening" : "Join room"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="app-root relative isolate">
      <Backdrop />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe pb-safe lg:max-w-[1200px] lg:px-8">
        <header className="flex h-16 shrink-0 items-center">
          <Wordmark />
        </header>

        {/* Phones: visual, headline, form, features stacked.
            Desktop: copy + form on the left, illustration on the right. */}
        <main className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:py-8 lg:short:py-4">
          <section className="order-2 lg:order-1">
            <div className="pt-8 text-center lg:pt-0 lg:text-left">
              <h1 className="text-lg font-semibold tracking-[-0.01em] lg:text-[56px] lg:leading-[1.05] lg:short:text-[48px] lg:tracking-[-0.03em]">
                Listen together,
                <br className="hidden lg:block" /> perfectly in sync.
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-base text-muted lg:mx-0 lg:mt-5 lg:max-w-md">
                Turn every phone in the room into one speaker. Friends suggest songs from YouTube, the host picks what plays.
              </p>
            </div>

            <div className="mt-8 lg:max-w-[440px] lg:short:mt-6">{form}</div>

            <ul className="mt-6 mb-8 grid grid-cols-3 gap-2 text-center lg:mt-10 lg:mb-0 lg:max-w-[560px] lg:short:mt-6 lg:gap-6 lg:text-left">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex flex-col items-center gap-2 rounded-[16px] border border-line bg-white/[0.03] px-2 py-4 lg:items-start lg:border-0 lg:bg-transparent lg:p-0"
                >
                  <Icon size={20} className="text-accent" />
                  <span className="text-sm text-muted lg:font-semibold lg:text-ink">{title}</span>
                  <span className="hidden text-sm text-muted lg:block">{text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="order-1 pt-8 lg:order-2 lg:pt-0">
            <div className="lg:hidden">
              <ListeningFriends width={260} />
            </div>
            <div className="hidden lg:block">
              <ListeningFriends width={440} />
              <SampleNowPlaying />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
