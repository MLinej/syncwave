import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/types";
import { useIsHost, useRoom } from "@/state/selectors";
import { appStore, readLocal, toast, useStore, writeLocal } from "@/state/store";
import { fetchLibrary, isCompleteYouTubeLink, looksLikeYouTubeLink, resolveYouTube, searchYouTube } from "@/services/api";
import * as room from "@/services/room";
import TrackRow from "./TrackRow";
import Segmented from "@/components/ui/Segmented";
import { CheckIcon, ClockIcon, CloseIcon, LinkIcon, PlusIcon, SearchIcon, SpinnerIcon, YouTubeIcon } from "@/components/ui/Icons";

type Source = "youtube" | "library";
const RECENT_KEY = "syncwave.recentSearches";
const EASE = [0.22, 1, 0.36, 1] as const;

/** One-tap "+" that becomes a check once the song is queued (host) or suggested (guest). */
function AddButton({ track }: { track: Track }) {
  const isHost = useIsHost();
  const r = useRoom();
  const [busy, setBusy] = useState(false);
  const done =
    r.current?.track.id === track.id || r.queue.some((q) => q.track.id === track.id) || (!isHost && r.suggestions.some((s) => s.track.id === track.id));

  const add = async () => {
    setBusy(true);
    try {
      if (isHost) await room.addToQueue(track, "last");
      else await room.suggest(track);
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`grid size-10 place-items-center rounded-full transition active:scale-90 ${
        done ? "bg-ok/15 text-ok" : "border border-line bg-white/[0.06] text-ink hover:bg-white/[0.12]"
      }`}
      onClick={add}
      disabled={busy || done}
      aria-label={done ? (isHost ? "Added" : "Suggested") : isHost ? `Add ${track.title} to queue` : `Suggest ${track.title}`}
    >
      {busy ? <SpinnerIcon size={16} className="animate-spin" /> : done ? <CheckIcon size={18} strokeWidth={2.25} /> : <PlusIcon size={18} strokeWidth={2.25} />}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="shimmer size-12 rounded-[12px]" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-3 w-3/4 rounded-full" />
            <div className="shimmer h-2.5 w-1/3 rounded-full" />
          </div>
          <div className="shimmer size-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ResultList({ items }: { items: Track[] }) {
  return (
    <ul>
      {items.map((t, i) => (
        <motion.li key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: EASE, delay: Math.min(i, 8) * 0.025 }}>
          <TrackRow track={t} actions={<AddButton track={t} />} />
        </motion.li>
      ))}
    </ul>
  );
}

function YouTubeSearch() {
  const searchEnabled = useStore(appStore, (s) => s.youtubeSearch);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readLocal<string[]>(RECENT_KEY, []));
  const reqId = useRef(0);
  const isLink = looksLikeYouTubeLink(query);

  const remember = (text: string) => {
    const next = [text, ...recent.filter((q) => q !== text)].slice(0, 6);
    setRecent(next);
    writeLocal(RECENT_KEY, next);
  };

  const run = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const items = looksLikeYouTubeLink(text) ? [await resolveYouTube(text)] : await searchYouTube(text);
      if (id !== reqId.current) return;
      setResults(items);
      if (!looksLikeYouTubeLink(text)) remember(text);
    } catch (err) {
      if (id === reqId.current) {
        setResults(null);
        setError(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isLink && !searchEnabled) {
      toast("Paste a YouTube link — search isn't enabled on this server", "error");
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur(); // close the phone keyboard
    void run(query);
  };

  const clear = () => {
    setQuery("");
    setResults(null);
    setError(null);
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
          {isLink ? <LinkIcon size={20} /> : <SearchIcon size={20} />}
        </span>
        <input
          className="field h-14 rounded-[20px] pr-12 pl-12"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Pasted links resolve instantly — no need to hit search.
            if (isCompleteYouTubeLink(e.target.value)) void run(e.target.value);
          }}
          placeholder={searchEnabled ? "Search songs or paste a YouTube link" : "Paste a YouTube link"}
          enterKeyHint="search"
          autoCorrect="off"
          aria-label="Search YouTube"
        />
        {query && (
          <button type="button" className="icon-btn absolute top-1/2 right-1.5 -translate-y-1/2 text-muted" onClick={clear} aria-label="Clear search">
            <CloseIcon size={18} />
          </button>
        )}
      </form>

      <div className="mt-4">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <p className="rounded-[16px] bg-danger/10 p-4 text-sm font-semibold text-danger">{error}</p>
        ) : results ? (
          results.length ? (
            <ResultList items={results} />
          ) : (
            <p className="py-8 text-center text-base text-muted">No results. Try different words.</p>
          )
        ) : searchEnabled && recent.length > 0 ? (
          <div>
            <div className="flex items-center justify-between px-2 pb-2">
              <h3 className="text-sm font-semibold text-muted">Recent searches</h3>
              <button
                className="text-sm text-faint hover:text-ink"
                onClick={() => {
                  setRecent([]);
                  writeLocal(RECENT_KEY, null);
                }}
              >
                Clear
              </button>
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {recent.map((q) => (
                  <motion.li key={q} exit={{ opacity: 0 }}>
                    <button
                      className="row w-full text-left"
                      onClick={() => {
                        setQuery(q);
                        void run(q);
                      }}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-muted">
                        <ClockIcon size={18} />
                      </span>
                      <span className="truncate text-base">{q}</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-white/[0.06] text-ink">
              <YouTubeIcon size={22} />
            </span>
            <p className="mt-4 text-base font-semibold">{searchEnabled ? "Search YouTube" : "Paste a YouTube link"}</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              {searchEnabled ? "Find any song, or paste a link from the YouTube app." : "In the YouTube app tap Share → Copy link, then paste it above."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryList() {
  const [items, setItems] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLibrary()
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="rounded-[16px] bg-danger/10 p-4 text-sm font-semibold text-danger">{error}</p>;
  if (!items) return <Skeleton />;
  if (!items.length) return <p className="py-8 text-center text-base text-muted">No songs in the library yet.</p>;
  return <ResultList items={items} />;
}

export default function SearchPanel() {
  const [source, setSource] = useState<Source>("youtube");

  return (
    <div className="px-4 pt-2 pb-6">
      <Segmented
        layoutId="search-source"
        className="mb-4"
        value={source}
        onChange={setSource}
        options={[
          { id: "youtube", label: "YouTube" },
          { id: "library", label: "Library" },
        ]}
      />
      {source === "youtube" ? <YouTubeSearch /> : <LibraryList />}
    </div>
  );
}
