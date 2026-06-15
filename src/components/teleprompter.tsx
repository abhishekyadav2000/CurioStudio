"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Type,
  ArrowLeft,
} from "lucide-react";

interface TeleprompterProps {
  script: string;
  title: string;
  outline?: string;
  projectId: string;
}

const MOUSE_DEAD_ZONE = 48;
const MOUSE_MAX_SPEED = 140;

export function Teleprompter({ script, title, outline, projectId }: TeleprompterProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [fontSize, setFontSize] = useState(32);
  const [mirror, setMirror] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [position, setPosition] = useState(0);
  const [mouseActive, setMouseActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const mouseYRef = useRef<number | null>(null);

  const text = showOutline && outline ? outline : script;

  const getMaxPosition = useCallback(() => {
    return Math.max(0, (contentRef.current?.scrollHeight ?? 0) - window.innerHeight + 200);
  }, []);

  const tick = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const max = getMaxPosition();
      const mouseY = mouseYRef.current;

      if (mouseY !== null) {
        const centerY = window.innerHeight / 2;
        const offset = mouseY - centerY;

        if (Math.abs(offset) > MOUSE_DEAD_ZONE) {
          setMouseActive(true);
          const range = Math.max(window.innerHeight / 2 - MOUSE_DEAD_ZONE, 1);
          const intensity = Math.min((Math.abs(offset) - MOUSE_DEAD_ZONE) / range, 1);
          const mouseSpeed = intensity * MOUSE_MAX_SPEED;
          const direction = offset > 0 ? 1 : -1;

          setPosition((prev) => {
            const next = prev + direction * mouseSpeed * delta;
            return Math.max(0, Math.min(max, next));
          });

          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        setMouseActive(false);
      }

      if (playing) {
        setPosition((prev) => {
          const next = prev + speed * delta;
          return next >= max ? max : next;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [speed, playing, getMaxPosition]
  );

  useEffect(() => {
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      mouseYRef.current = e.clientY;
    }
    function onMouseLeave() {
      mouseYRef.current = null;
      setMouseActive(false);
    }
    const scrollArea = scrollAreaRef.current;
    window.addEventListener("mousemove", onMouseMove);
    scrollArea?.addEventListener("mouseleave", onMouseLeave);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      scrollArea?.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  useEffect(() => {
    if (mouseActive && playing) setPlaying(false);
  }, [mouseActive, playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.code === "ArrowUp") setSpeed((s) => Math.min(s + 5, 120));
      if (e.code === "ArrowDown") setSpeed((s) => Math.max(s - 5, 5));
      if (e.code === "Home") setPosition(0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-black" : "h-[calc(100vh-8rem)]"}`}
    >
      <div className="flex items-center gap-3 p-3 bg-card border-b border-border flex-wrap shrink-0">
        <Link
          href={`/studio/${projectId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-card-hover text-sm font-medium shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </Link>
        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{title}</span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-2 rounded-lg bg-accent text-white hover:bg-accent-dim"
            title="Space to play/pause"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              setPosition(0);
              setPlaying(false);
            }}
            className="p-2 rounded-lg bg-card border border-border hover:bg-card-hover"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`p-2 rounded-lg border ${showOutline ? "bg-accent/20 border-accent text-accent" : "bg-card border-border"}`}
            title="Toggle outline"
          >
            <Type className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-card border border-border hover:bg-card-hover">
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 bg-background/50 border-b border-border text-xs shrink-0 flex-wrap">
        <label className="flex items-center gap-2 text-muted">
          Speed: {speed}
          <input type="range" min={5} max={120} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24 accent-accent" />
        </label>
        <label className="flex items-center gap-2 text-muted">
          Size: {fontSize}px
          <input type="range" min={20} max={72} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-24 accent-accent" />
        </label>
        <label className="flex items-center gap-2 text-muted cursor-pointer">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="accent-accent" />
          Mirror (for glass teleprompter)
        </label>
        <span className="text-muted">
          Space = play/pause · ↑↓ = speed · Move cursor up/down to scroll
          {mouseActive && " · Mouse scroll active"}
        </span>
      </div>

      <div ref={scrollAreaRef} className="flex-1 overflow-hidden relative bg-black">
        <div className="absolute top-1/3 left-0 right-0 h-px bg-accent/30 z-10 pointer-events-none" />
        <div
          ref={contentRef}
          className={`absolute left-0 right-0 px-[10%] transition-none ${mirror ? "scale-x-[-1]" : ""}`}
          style={{ transform: `translateY(-${position}px)${mirror ? " scaleX(-1)" : ""}`, top: "33vh" }}
        >
          <p
            className="text-white leading-relaxed whitespace-pre-wrap font-sans"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          >
            {text}
          </p>
          <div className="h-[50vh]" />
        </div>
      </div>
    </div>
  );
}
