"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Clock } from "lucide-react";
import type { PresentationSlide } from "@/lib/content";

interface PresentationModeProps {
  slides: PresentationSlide[];
  projectName: string;
}

export function PresentationMode({ slides, projectName }: PresentationModeProps) {
  const [current, setCurrent] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const slide = slides[current];
  const totalDuration = slides.reduce((a, s) => a + s.durationSec, 0);

  function goNext() {
    setCurrent((c) => Math.min(c + 1, slides.length - 1));
  }
  function goPrev() {
    setCurrent((c) => Math.max(c - 1, 0));
  }

  function toggleFullscreen() {
    if (!fullscreen) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50" : "min-h-[70vh]"}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 bg-card border-b border-border">
        <span className="text-sm text-muted">
          {projectName} · Slide {current + 1}/{slides.length}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" /> ~{Math.ceil(totalDuration / 60)} min total
          </span>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-card-hover"
          >
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded border border-border hover:bg-card-hover">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Main slide */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 bg-gradient-to-br from-background to-card">
          <div className="w-full max-w-3xl animate-slide-up">
            <p className="text-accent text-sm font-medium mb-4 uppercase tracking-wider">
              Slide {current + 1} · {slide.durationSec}s
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
              {slide.title}
            </h2>
            <div className="text-lg md:text-2xl text-muted leading-relaxed whitespace-pre-wrap">
              {slide.body}
            </div>
          </div>
        </div>

        {/* Speaker notes */}
        {showNotes && (
          <aside className="w-80 border-l border-border bg-card/80 p-4 overflow-y-auto scrollbar-thin hidden lg:block">
            <h4 className="text-xs font-medium text-accent uppercase mb-3">Speaker Notes</h4>
            <p className="text-sm text-muted leading-relaxed">{slide.speakerNotes}</p>
            <div className="mt-6 space-y-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    i === current ? "bg-accent/20 text-accent border border-accent/30" : "hover:bg-card-hover text-muted"
                  }`}
                >
                  {i + 1}. {s.title}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-4 bg-card border-t border-border">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>
        <button
          onClick={goNext}
          disabled={current === slides.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dim disabled:opacity-30"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
