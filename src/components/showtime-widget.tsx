"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Mic, Calendar, Loader2 } from "lucide-react";

interface ShowtimeData {
  nextVideo: {
    id: string;
    title: string;
    scheduledAt: string;
    project?: { id: string; name: string | null } | null;
  } | null;
  recordingToday: {
    id: string;
    title: string;
    scheduledAt: string;
    project?: { id: string; name: string | null } | null;
  } | null;
  publishThisWeek: {
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    project?: { id: string; name: string | null } | null;
  }[];
}

function Countdown({ target }: { target: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setText("Now!");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const d = Math.floor(diff / 86400000);
      setText(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [target]);

  return <span className="font-mono text-accent">{text}</span>;
}

export function ShowtimeWidget({ compact }: { compact?: boolean }) {
  const [data, setData] = useState<ShowtimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar?view=showtime")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl bg-card border border-border flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className={compact ? "h-full" : "mb-8"}>
      <h3 className={`font-semibold flex items-center gap-2 ${compact ? "text-sm mb-2" : "text-lg mb-3"}`}>
        <Clock className={`text-accent ${compact ? "w-4 h-4" : "w-5 h-5"}`} />
        Today&apos;s Showtime
      </h3>
      <div className={`grid sm:grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
        <div className={`rounded-xl bg-gradient-to-br from-accent/15 to-card border border-accent/25 ${compact ? "p-3" : "p-4"}`}>
          <p className={`text-muted mb-1 ${compact ? "text-[10px]" : "text-xs"}`}>Next video</p>
          {data.nextVideo ? (
            <>
              <p className="font-semibold text-sm truncate">{data.nextVideo.title}</p>
              <p className="text-xs mt-2">
                <Countdown target={data.nextVideo.scheduledAt} />
              </p>
              {data.nextVideo.project && (
                <Link href={`/studio/${data.nextVideo.project.id}`} className="text-xs text-accent mt-2 inline-block hover:underline">
                  Open Studio →
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No upcoming video — <Link href="/calendar" className="text-accent hover:underline">schedule</Link></p>
          )}
        </div>
        <div className={`rounded-xl bg-card border border-border ${compact ? "p-3" : "p-4"}`}>
          <p className={`text-muted mb-1 flex items-center gap-1 ${compact ? "text-[10px]" : "text-xs"}`}><Mic className="w-3 h-3" /> Recording today</p>
          {data.recordingToday ? (
            <>
              <p className="font-semibold text-sm truncate">{data.recordingToday.title}</p>
              <p className="text-xs text-muted mt-1">{new Date(data.recordingToday.scheduledAt).toLocaleTimeString()}</p>
            </>
          ) : (
            <p className="text-sm text-muted">No recording slot today</p>
          )}
        </div>
        <div className={`rounded-xl bg-card border border-border ${compact ? "p-3" : "p-4"}`}>
          <p className={`text-muted mb-1 flex items-center gap-1 ${compact ? "text-[10px]" : "text-xs"}`}><Calendar className="w-3 h-3" /> This week</p>
          {data.publishThisWeek.length > 0 ? (
            <ul className="text-xs space-y-1">
              {data.publishThisWeek.slice(0, 3).map((s) => (
                <li key={s.id} className="truncate">
                  {new Date(s.scheduledAt).toLocaleDateString(undefined, { weekday: "short" })} — {s.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing scheduled</p>
          )}
          <Link href="/calendar" className="text-xs text-accent mt-2 inline-block hover:underline">Full calendar →</Link>
        </div>
      </div>
    </section>
  );
}

export function CalendarMiniWidget() {
  const [slots, setSlots] = useState<{ id: string; title: string; scheduledAt: string; status: string }[]>([]);

  useEffect(() => {
    fetch("/api/calendar?view=week").then((r) => r.json()).then((d) => setSlots(d.slots ?? []));
  }, []);

  return (
    <section className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Next 7 days
        </h3>
        <Link href="/calendar" className="text-xs text-accent hover:underline">View all</Link>
      </div>
      {slots.length === 0 ? (
        <p className="text-xs text-muted">No slots — batch schedule from Projects</p>
      ) : (
        <div className="space-y-1.5">
          {slots.slice(0, 5).map((s) => (
            <div key={s.id} className="flex justify-between text-xs">
              <span className="truncate flex-1">{s.title}</span>
              <span className="text-muted ml-2 shrink-0">{new Date(s.scheduledAt).toLocaleDateString(undefined, { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
