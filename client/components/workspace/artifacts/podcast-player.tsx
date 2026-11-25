"use client";

import { useMemo, useRef, useState } from "react";
import { Headphones, Play, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CitationChip,
  formatClipTime,
} from "@/components/workspace/citation-chip";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifact-types";

export function PodcastPlayer({ artifact }: { artifact: Artifact }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const content = artifact.content;

  const turns = useMemo(
    () => (content.kind === "podcast" ? content.turns : []),
    [content]
  );

  const activeIndex = useMemo(() => {
    let active = -1;
    turns.forEach((turn, index) => {
      if (turn.startSec <= currentTime + 0.25) active = index;
    });
    return active;
  }, [turns, currentTime]);

  if (content.kind !== "podcast") {
    return null;
  }

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
    void audio.play().catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1 border-b border-border pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Alex and Sam · {turns.length} turns
          {artifact.durationSec
            ? ` · ${formatClipTime(artifact.durationSec)}`
            : ""}
        </p>
      </header>

      {artifact.audioUrl ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Generated narration
          </div>
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={artifact.audioUrl}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime)
            }
            className="w-full"
            aria-label={`Audio for ${content.title}`}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Audio is still being prepared. The transcript is available below.
        </div>
      )}

      <section aria-label="Podcast transcript" className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Transcript
        </h4>
        {turns.map((turn, index) => {
          const isAlex = turn.speaker === "Alex";
          return (
            <article
              key={`${turn.startSec}-${index}`}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                index === activeIndex
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                      isAlex
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                    aria-hidden="true"
                  >
                    {isAlex ? "A" : "S"}
                  </span>
                  <span className="text-[11px] font-semibold">{turn.speaker}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => seekTo(turn.startSec)}
                  disabled={!artifact.audioUrl}
                  className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                  aria-label={`Play from ${formatClipTime(turn.startSec)}`}
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  {formatClipTime(turn.startSec)}
                </Button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                {turn.text}
              </p>
              {turn.citationLabels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {turn.citationLabels.map((label) => {
                    const source = artifact.sourceIndex.find(
                      (item) => item.label === label
                    );
                    if (!source) return null;
                    return (
                      <CitationChip
                        key={label}
                        label={label}
                        title={source.title}
                        url={source.url}
                        page={source.page}
                        startSeconds={source.startSeconds}
                      />
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
