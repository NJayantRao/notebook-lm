"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Pause, Play, Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  CitationChip,
  formatClipTime,
} from "@/components/workspace/citation-chip";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifact-types";
import { artifactKeys } from "@/hooks/use-artifacts";

export function PodcastPlayer({ artifact }: { artifact: Artifact }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTurnRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [refreshingAudio, setRefreshingAudio] = useState(false);
  const content = artifact.content;
  const realDuration = audioDuration ?? artifact.durationSec ?? 0;

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

  useEffect(() => {
    activeTurnRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (content.kind !== "podcast") {
    return null;
  }

  const seekTo = (seconds: number, play = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
    if (play) {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaybackError("Could not start audio playback.")
      );
    }
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);
    if (audio.paused) {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaybackError("Could not start audio playback.")
      );
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const refreshAudioUrl = () => {
    if (refreshingAudio) return;
    setRefreshingAudio(true);
    setPlaybackError("Refreshing the audio link…");
    const queryKey = artifactKeys.detail(artifact.workspaceId, artifact.id);
    void queryClient
      .invalidateQueries({ queryKey })
      .then(() => {
        const refreshed = queryClient.getQueryData<Artifact>(queryKey);
        if (refreshed?.audioUrl !== artifact.audioUrl) {
          setRefreshingAudio(false);
          setPlaybackError(null);
          return;
        }
        setRefreshingAudio(false);
        setPlaybackError("The audio link could not be refreshed.");
      })
      .catch(() => {
        setRefreshingAudio(false);
        setPlaybackError("The audio link could not be refreshed.");
      });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-8">
      <header className="space-y-1 border-b border-border pb-3">
        <h3 className="flex items-center gap-2 font-heading text-3xl">
          <Headphones className="size-5 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          Alex and Sam · {turns.length} turns
          {realDuration > 0 ? ` · ${formatClipTime(realDuration)}` : ""}
        </p>
      </header>

      {artifact.audioUrl ? (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-8">
          <audio
            key={artifact.audioUrl}
            ref={audioRef}
            preload="metadata"
            src={artifact.audioUrl}
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration) && duration > 0) {
                setAudioDuration(Math.round(duration));
              }
              event.currentTarget.playbackRate = speed;
              setRefreshingAudio(false);
              setPlaybackError(null);
            }}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime)
            }
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={refreshAudioUrl}
            className="sr-only"
            aria-label={`Audio for ${content.title}`}
          />
          <div className="mb-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Volume2 className="size-4 text-primary" aria-hidden="true" />
              Generated narration
            </span>
            <span className="tabular-nums">
              {formatClipTime(currentTime)} / {formatClipTime(realDuration)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(realDuration, 1)}
            step={1}
            value={Math.min(currentTime, realDuration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek podcast"
            className="h-2 w-full cursor-pointer accent-primary"
          />
          <div className="mt-5 flex items-center justify-center gap-4">
            <Button
              type="button"
              size="icon-lg"
              className="size-12 rounded-full"
              onClick={togglePlayback}
              aria-label={playing ? "Pause podcast" : "Play podcast"}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Speed
              <select
                value={speed}
                onChange={(event) => {
                  const nextSpeed = Number(event.target.value);
                  setSpeed(nextSpeed);
                  if (audioRef.current) {
                    audioRef.current.playbackRate = nextSpeed;
                  }
                }}
                aria-label="Playback speed"
                className="rounded-lg border border-input bg-background px-2 py-1.5 text-foreground"
              >
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          {playbackError && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground"
            >
              {refreshingAudio ? "Refreshing the audio link…" : playbackError}
              {!refreshingAudio && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={refreshAudioUrl}
                >
                  Refresh audio link
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Audio is still being prepared. The transcript is available below.
        </div>
      )}

      <section aria-label="Podcast transcript" className="space-y-3">
        <h4 className="font-heading text-2xl">
          Transcript
        </h4>
        {turns.map((turn, index) => {
          const isAlex = turn.speaker === "Alex";
          return (
            <article
              key={`${turn.startSec}-${index}`}
              ref={index === activeIndex ? activeTurnRef : undefined}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                index === activeIndex
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border text-xs font-bold",
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
                  onClick={() => seekTo(turn.startSec, true)}
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
