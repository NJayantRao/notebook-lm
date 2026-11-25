"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CircleHelp,
  Headphones,
  LoaderCircle,
  Network,
  RefreshCw,
  Route,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { listAllWorkspaceSources } from "@/services/source.service";
import {
  useArtifact,
  useArtifacts,
  useCreateArtifact,
  useDeleteArtifact,
  useRetryArtifact,
} from "@/hooks/use-artifacts";
import type {
  Artifact,
  ArtifactStatus,
  ArtifactType,
  CreateArtifactInput,
} from "@/lib/artifact-types";
import { FlashcardView } from "@/components/workspace/artifacts/flashcard-view";
import { MindMapView } from "@/components/workspace/artifacts/mind-map-view";
import { PodcastPlayer } from "@/components/workspace/artifacts/podcast-player";
import { QuizView } from "@/components/workspace/artifacts/quiz-view";
import { RoadmapView } from "@/components/workspace/artifacts/roadmap-view";

type Tool = {
  type: ArtifactType;
  title: string;
  description: string;
  icon: LucideIcon;
};

const TOOLS: Tool[] = [
  {
    type: "roadmap",
    title: "Roadmap",
    description: "A step-by-step path through the material.",
    icon: Route,
  },
  {
    type: "mindmap",
    title: "Mind Map",
    description: "Concepts and how they connect.",
    icon: Network,
  },
  {
    type: "podcast",
    title: "Podcast",
    description: "Two-host audio overview, up to 5 minutes",
    icon: Headphones,
  },
  {
    type: "quiz",
    title: "Quiz",
    description: "Questions with graded feedback.",
    icon: CircleHelp,
  },
  {
    type: "flashcards",
    title: "Flashcards",
    description: "Spaced-repetition review cards.",
    icon: BookOpen,
  },
];

const statusTone: Record<ArtifactStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  generating: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-600",
};

function StatusBadge({ status }: { status: ArtifactStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        statusTone[status]
      )}
    >
      {status}
    </span>
  );
}

function ArtifactDetail({
  workspaceId,
  artifactId,
  onBack,
}: {
  workspaceId: string;
  artifactId: string;
  onBack: () => void;
}) {
  const { data: artifact, isLoading, isError, error } = useArtifact(
    workspaceId,
    artifactId
  );
  const retry = useRetryArtifact(workspaceId);
  const remove = useDeleteArtifact(workspaceId);
  const create = useCreateArtifact(workspaceId);

  if (isLoading && !artifact) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading artifact…
      </div>
    );
  }

  if (isError || !artifact) {
    return (
      <div className="space-y-3 p-3">
        <p role="alert" className="text-xs text-rose-400">
          {getErrorMessage(error)}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Back to tools
        </Button>
      </div>
    );
  }

  const regenerate = () => {
    create.mutate({
      type: artifact.type,
      ...artifact.input.params,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Studio
          </Button>
          <div className="flex items-center gap-1">
            {artifact.status === "failed" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={retry.isPending}
                onClick={() => retry.mutate(artifact.id)}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={remove.isPending}
              onClick={() => {
                void remove.mutateAsync(artifact.id).then(() => onBack());
              }}
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-rose-400"
              aria-label="Delete artifact"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div>
          <h3 className="truncate text-sm font-semibold">{artifact.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={artifact.status} />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {artifact.type}
            </span>
            {artifact.isStale && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">
                Sources changed
              </span>
            )}
          </div>
        </div>
        {(retry.isError || remove.isError || create.isError) && (
          <p role="alert" className="text-[11px] text-rose-400">
            {getErrorMessage(retry.error ?? remove.error ?? create.error)}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {(artifact.status === "pending" || artifact.status === "generating") && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
            <LoaderCircle
              className="h-6 w-6 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="text-xs font-medium">Generating your artifact…</p>
            <p className="text-[11px] text-muted-foreground">
              This panel updates automatically when generation finishes.
              Podcasts also synthesize audio, which takes longer.
            </p>
          </div>
        )}

        {artifact.status === "failed" && (
          <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
            <p className="text-xs font-medium text-rose-500">
              Generation failed
            </p>
            <p role="alert" className="text-[11px] leading-relaxed text-muted-foreground">
              {artifact.type === "podcast" &&
              artifact.errorMessage?.includes("PODCAST_TOO_LONG")
                ? "The podcast came out too long. Try again."
                : (artifact.errorMessage ?? "An unknown error occurred.")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate(artifact.id)}
              className="h-7 text-[11px]"
            >
              {artifact.type === "podcast" &&
              artifact.errorMessage?.includes("PODCAST_TOO_LONG")
                ? "Retry"
                : "Retry generation"}
            </Button>
          </div>
        )}

        {artifact.status === "ready" && artifact.isStale && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Sources changed since this artifact was created.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={create.isPending}
              onClick={regenerate}
              className="h-7 text-[11px]"
            >
              Regenerate
            </Button>
          </div>
        )}

        {artifact.status === "ready" && (
          <div className="animate-in fade-in-0">
            {artifact.content.kind === "roadmap" && (
              <RoadmapView content={artifact.content} />
            )}
            {artifact.content.kind === "mindmap" && (
              <MindMapView content={artifact.content} />
            )}
            {artifact.content.kind === "podcast" && (
              <PodcastPlayer artifact={artifact} />
            )}
            {artifact.content.kind === "quiz" && (
              <QuizView artifact={artifact} />
            )}
            {artifact.content.kind === "flashcards" && (
              <FlashcardView
                key={`${artifact.id}:${artifact.updatedAt}`}
                artifact={artifact}
              />
            )}
            {artifact.content.kind === "empty" && (
              <p className="text-xs text-muted-foreground">
                This artifact has no content yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function StudyStudioPanel({
  workspaceId,
  enabled = true,
  onClose,
  className,
}: {
  workspaceId: string;
  enabled?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const artifactsQuery = useArtifacts(workspaceId, enabled);
  const artifacts = useMemo(
    () => artifactsQuery.data ?? [],
    [artifactsQuery.data]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [optionsOpenFor, setOptionsOpenFor] = useState<ArtifactType | null>(null);
  const [focus, setFocus] = useState("");
  // null means "every ready source"; an array is an explicit user selection.
  const [sourceSelection, setSourceSelection] = useState<string[] | null>(null);
  const [cardCount, setCardCount] = useState(10);
  const [questionCount, setQuestionCount] = useState(8);

  const sourcesQuery = useQuery({
    queryKey: ["sources", workspaceId, "studio-all"],
    queryFn: () => listAllWorkspaceSources(workspaceId),
    enabled,
  });
  const readySources = useMemo(
    () => (sourcesQuery.data ?? []).filter((source) => source.status === "ready"),
    [sourcesQuery.data]
  );

  const create = useCreateArtifact(workspaceId);
  const remove = useDeleteArtifact(workspaceId);
  const retry = useRetryArtifact(workspaceId);

  const readySourceIds = useMemo(
    () => readySources.map((source) => source.id),
    [readySources]
  );
  const effectiveSourceIds = useMemo(() => {
    const ids = sourceSelection ?? readySourceIds;
    const readySet = new Set(readySourceIds);
    return ids.filter((id) => readySet.has(id));
  }, [sourceSelection, readySourceIds]);

  const toggleSource = (sourceId: string, checked: boolean) => {
    setSourceSelection((current) => {
      const ids = current ?? readySourceIds;
      return checked
        ? [...new Set([...ids, sourceId])]
        : ids.filter((id) => id !== sourceId);
    });
  };

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const latestByType = useMemo(() => {
    const map = new Map<ArtifactType, Artifact>();
    for (const artifact of artifacts) {
      if (!map.has(artifact.type)) map.set(artifact.type, artifact);
    }
    return map;
  }, [artifacts]);

  const generate = (type: ArtifactType) => {
    if (effectiveSourceIds.length === 0) return;

    const input: CreateArtifactInput = {
      type,
      sourceIds: effectiveSourceIds,
      ...(focus.trim() ? { focus: focus.trim() } : {}),
      ...(type === "flashcards" ? { cardCount } : {}),
      ...(type === "quiz" ? { questionCount } : {}),
    };

    create.mutate(input, {
      onSuccess: (artifact) => {
        setSelectedId(artifact.id);
        setOptionsOpenFor(null);
        setFocus("");
      },
    });
  };

  if (selectedId) {
    return (
      <section
        className={cn(
          "flex min-h-0 w-full flex-col border-l border-border bg-card/30",
          className
        )}
        aria-label="Study Studio artifact"
      >
        <ArtifactDetail
          workspaceId={workspaceId}
          artifactId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-0 w-full flex-col border-l border-border bg-card/30",
        className
      )}
      aria-label="Study Studio"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Study Studio
          </h2>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            AI cognitive assets
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
            {artifacts.length} artifacts
          </span>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close Study Studio"
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {readySources.length === 0 && (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
            Add and index a source before generating an artifact.
          </p>
        )}

        <div className="grid grid-cols-1 content-start gap-2.5 xl:grid-cols-2">
          {TOOLS.map(({ type, title, description, icon: Icon }) => {
            const latest = latestByType.get(type);
            const open = optionsOpenFor === type;
            return (
              <article
                key={type}
                className="flex min-h-40 flex-col rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {latest ? (
                    <StatusBadge status={latest.status} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">New</span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
                {type === "podcast" && (
                  <span className="mt-1 w-fit rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Up to 5 min
                  </span>
                )}

                {latest && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(latest.id)}
                    className="mt-2 truncate rounded-lg bg-muted/60 px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                  >
                    {latest.title}
                    {latest.isStale ? " · stale" : ""}
                  </button>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
                  <Popover
                    open={open}
                    onOpenChange={(next) =>
                      setOptionsOpenFor(next ? type : null)
                    }
                  >
                    <PopoverTrigger
                      type="button"
                      disabled={readySources.length === 0 || create.isPending}
                      className="inline-flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    >
                      {latest ? "Generate new" : "Generate"}
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                      <PopoverHeader>
                        <PopoverTitle>Generate {title.toLowerCase()}</PopoverTitle>
                      </PopoverHeader>
                      <label className="text-[11px] font-medium" htmlFor={`focus-${type}`}>
                        Focus (optional)
                      </label>
                      <textarea
                        id={`focus-${type}`}
                        value={focus}
                        maxLength={2000}
                        rows={2}
                        onChange={(event) => setFocus(event.target.value)}
                        placeholder="Emphasise a topic or question"
                        className="w-full rounded-lg border border-border bg-background p-2 text-[11px] outline-none focus:border-primary"
                      />

                      {(type === "quiz" || type === "flashcards") && (
                        <label className="flex items-center justify-between text-[11px]">
                          {type === "quiz" ? "Questions" : "Cards"}
                          <select
                            value={type === "quiz" ? questionCount : cardCount}
                            onChange={(event) =>
                              type === "quiz"
                                ? setQuestionCount(Number(event.target.value))
                                : setCardCount(Number(event.target.value))
                            }
                            className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                          >
                            {Array.from(
                              {
                                length: type === "quiz" ? 6 : 11,
                              },
                              (_, index) => (type === "quiz" ? index + 5 : index + 5)
                            ).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <fieldset className="space-y-1">
                        <legend className="text-[11px] font-medium">
                          Sources ({effectiveSourceIds.length} selected)
                        </legend>
                        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                          {readySources.map((source) => (
                            <label
                              key={source.id}
                              className="flex items-start gap-2 text-[11px] text-muted-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={effectiveSourceIds.includes(source.id)}
                                onChange={(event) =>
                                  toggleSource(source.id, event.target.checked)
                                }
                                className="mt-0.5 accent-[var(--primary)]"
                              />
                              <span className="line-clamp-2">{source.title}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          effectiveSourceIds.length === 0 || create.isPending
                        }
                        onClick={() => generate(type)}
                        className="h-8 text-[11px]"
                      >
                        {create.isPending ? "Starting…" : "Generate"}
                      </Button>
                    </PopoverContent>
                  </Popover>

                  {latest && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(latest.id)}
                        className="h-7 px-2 text-[11px]"
                      >
                        Open
                      </Button>
                      {latest.status === "failed" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(latest.id)}
                          className="h-7 px-2 text-[11px]"
                          aria-label={`Retry ${title}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => void remove.mutateAsync(latest.id)}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-rose-400"
                        aria-label={`Delete ${title} artifact`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {(create.isError || remove.isError || retry.isError) && (
          <p role="alert" className="text-[11px] text-rose-400">
            {getErrorMessage(create.error ?? remove.error ?? retry.error)}
          </p>
        )}

        {artifacts.length > 0 && (
          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recent artifacts
            </h3>
            <ul className="space-y-1">
              {artifacts.slice(0, 12).map((artifact) => (
                <li key={artifact.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(artifact.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-left text-[11px] hover:border-primary/40"
                  >
                    <span className="min-w-0 truncate">{artifact.title}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {artifact.isStale && (
                        <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-600">
                          stale
                        </span>
                      )}
                      <StatusBadge status={artifact.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {artifactsQuery.isError && (
          <p role="alert" className="text-[11px] text-rose-400">
            {getErrorMessage(artifactsQuery.error)}
          </p>
        )}
      </div>
    </section>
  );
}
