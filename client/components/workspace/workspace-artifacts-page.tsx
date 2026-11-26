"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  CircleHelp,
  Download,
  Grid2X2,
  Headphones,
  List,
  LoaderCircle,
  MoreHorizontal,
  Network,
  Plus,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { ArtifactPreview } from "@/components/workspace/artifacts/artifact-preview";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useArtifacts, useCreateArtifact, useDeleteArtifact, useFlashcardExport, useRetryArtifact } from "@/hooks/use-artifacts";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type { Artifact, ArtifactStatus, ArtifactType, CreateArtifactInput } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";
import { cleanTitle } from "@/lib/citation-label";
import { listAllWorkspaceSources } from "@/services/source.service";

type ArtifactTile = {
  type: ArtifactType;
  title: string;
  caption: string;
  icon: LucideIcon;
  accent: string;
};

const TILES: ArtifactTile[] = [
  {
    type: "roadmap",
    title: "Roadmap",
    caption: "A step-by-step learning path",
    icon: Route,
    accent: "var(--artifact-roadmap)",
  },
  {
    type: "mindmap",
    title: "Mind map",
    caption: "See how ideas connect",
    icon: Network,
    accent: "var(--artifact-mindmap)",
  },
  {
    type: "podcast",
    title: "Podcast",
    caption: "Listen to a spoken overview",
    icon: Headphones,
    accent: "var(--artifact-podcast)",
  },
  {
    type: "quiz",
    title: "Quiz",
    caption: "Check your understanding",
    icon: CircleHelp,
    accent: "var(--artifact-quiz)",
  },
  {
    type: "flashcards",
    title: "Flashcards",
    caption: "Review with spaced repetition",
    icon: BookOpen,
    accent: "var(--artifact-flashcards)",
  },
];

const TYPE_LABELS: Record<ArtifactType, string> = {
  roadmap: "Roadmap",
  mindmap: "Mind map",
  podcast: "Podcast",
  quiz: "Quiz",
  flashcards: "Flashcards",
};

const TYPE_TAB_LABELS: Record<ArtifactType, string> = {
  roadmap: "Roadmaps",
  mindmap: "Mind maps",
  podcast: "Podcasts",
  quiz: "Quizzes",
  flashcards: "Flashcards",
};

const STATUS_TONES: Record<ArtifactStatus, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  generating: "border-primary/30 bg-primary/10 text-primary",
  ready: "border-success/30 bg-success/10 text-success",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function friendlyGenerationError(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLocaleLowerCase();
  if (normalized.includes("quota") || normalized.includes("limit")) {
    return "You’ve reached the generation limit. Try again later.";
  }
  if (normalized.includes("source") && normalized.includes("ready")) {
    return "Add and index at least one source before generating an artifact.";
  }
  if (
    normalized.includes("not configured") ||
    normalized.includes("configuration")
  ) {
    return "Artifact generation is not configured yet. Please try again later.";
  }
  return message;
}

function statusLabel(status: ArtifactStatus): string {
  return status === "pending" ? "Generating" : status;
}

function ArtifactStatusBadge({ status }: { status: ArtifactStatus }) {
  const active = status === "pending" || status === "generating";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs capitalize",
        STATUS_TONES[status]
      )}
      aria-live={active ? "polite" : undefined}
    >
      {active && <LoaderCircle className="size-3 animate-spin" />}
      {statusLabel(status)}
    </span>
  );
}

function CardActions({
  artifact,
  workspaceId,
  onDelete,
  onActionError,
}: {
  artifact: Artifact;
  workspaceId: string;
  onDelete: (artifact: Artifact) => void;
  onActionError: (message: string | null) => void;
}) {
  const router = useRouter();
  const retry = useRetryArtifact(workspaceId);
  const create = useCreateArtifact(workspaceId);
  const exportDeck = useFlashcardExport(workspaceId);
  const route = `/dashboard/workspaces/${workspaceId}/artifacts/${artifact.id}`;
  const regenerate = () => {
    onActionError(null);
    const params = artifact.input.params;
    const input: CreateArtifactInput = {
      type: artifact.type,
      sourceIds: params.sourceIds,
      ...(params.focus ? { focus: params.focus } : {}),
      ...(params.cardCount ? { cardCount: params.cardCount } : {}),
      ...(params.questionCount ? { questionCount: params.questionCount } : {}),
    };
    create.mutate(input, {
      onError: (error) => onActionError(friendlyGenerationError(error)),
    });
  };
  const filename =
    artifact.title.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") ||
    "flashcards";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative z-10 size-8 rounded-full bg-background/80 text-muted-foreground"
            aria-label={`Actions for ${artifact.title}`}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(route)}>
          <Sparkles />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={create.isPending}
          onClick={regenerate}
        >
          <RefreshCw />
          Regenerate
        </DropdownMenuItem>
        {artifact.status === "failed" && (
          <DropdownMenuItem
            disabled={retry.isPending}
            onClick={() => {
              onActionError(null);
              retry.mutate(artifact.id, {
                onError: (error) => onActionError(getErrorMessage(error)),
              });
            }}
          >
            <RefreshCw />
            Retry
          </DropdownMenuItem>
        )}
        {artifact.type === "flashcards" && (
          <DropdownMenuItem
            disabled={exportDeck.isPending}
            onClick={() =>
              exportDeck.mutate(
                {
                  artifactId: artifact.id,
                  filename: `${filename}.apkg`,
                  format: "apkg",
                },
                {
                  onError: (error) => onActionError(getErrorMessage(error)),
                }
              )
            }
          >
            <Download />
            Export to Anki
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(artifact)}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ArtifactCard({
  artifact,
  workspaceId,
  view,
  onDelete,
  onActionError,
}: {
  artifact: Artifact;
  workspaceId: string;
  view: "grid" | "list";
  onDelete: (artifact: Artifact) => void;
  onActionError: (message: string | null) => void;
}) {
  const href = `/dashboard/workspaces/${workspaceId}/artifacts/${artifact.id}`;
  const created = new Date(artifact.createdAt);
  const formattedDate = Number.isNaN(created.getTime())
    ? ""
    : created.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20",
        view === "list" && "flex items-stretch"
      )}
    >
      <Link
        href={href}
        aria-label={`Open ${artifact.title}`}
        className={cn(
          "relative z-0 block min-w-0 flex-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          view === "list" && "flex items-center"
        )}
      >
        <div
          className={cn(
            "relative min-w-0",
            view === "list" && "flex items-center gap-4"
          )}
        >
          <div
            className={cn(
              "overflow-hidden",
              view === "list" && "w-40 shrink-0 rounded-l-2xl"
            )}
          >
            <ArtifactPreview artifact={artifact} />
          </div>
          <div className="min-w-0 p-4">
            <h2 className="truncate text-sm font-medium text-foreground">
              {artifact.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {TYPE_LABELS[artifact.type]}{formattedDate ? ` · ${formattedDate}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ArtifactStatusBadge status={artifact.status} />
              {artifact.isStale && (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
                  Sources changed
                </span>
              )}
              {artifact.status === "failed" && artifact.errorMessage && (
                <span className="line-clamp-1 text-xs text-destructive">
                  {artifact.errorMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <CardActions
          artifact={artifact}
          workspaceId={workspaceId}
          onDelete={onDelete}
          onActionError={onActionError}
        />
      </div>
    </article>
  );
}

export function WorkspaceArtifactsPage({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { data: session } = useAuthSession();
  const [typeFilter, setTypeFilter] = useState<ArtifactType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ready" | "generating" | "failed"
  >("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dialogType, setDialogType] = useState<ArtifactType | null>(null);
  const [focus, setFocus] = useState("");
  const [sourceSelection, setSourceSelection] = useState<string[] | null>(null);
  const [questionCount, setQuestionCount] = useState(8);
  const [cardCount, setCardCount] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<Artifact | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const createRowRef = useRef<HTMLDivElement>(null);
  const artifactsQuery = useArtifacts(workspaceId, !!session);
  const create = useCreateArtifact(workspaceId);
  const remove = useDeleteArtifact(workspaceId);
  const sourcesQuery = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => listAllWorkspaceSources(workspaceId),
    enabled: !!session,
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) =>
          source.status === "pending" || source.status === "processing"
      )
        ? 3000
        : false,
  });
  const readySources = useMemo(
    () => (sourcesQuery.data ?? []).filter((source) => source.status === "ready"),
    [sourcesQuery.data]
  );
  const readyIds = useMemo(
    () => readySources.map((source) => source.id),
    [readySources]
  );
  const selectedSourceIds = useMemo(() => {
    const ids = sourceSelection ?? readyIds;
    const readySet = new Set(readyIds);
    return ids.filter((id) => readySet.has(id));
  }, [readyIds, sourceSelection]);
  const artifacts = useMemo(
    () =>
      [...(artifactsQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      ),
    [artifactsQuery.data]
  );
  const filteredArtifacts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return artifacts.filter((artifact) => {
      const typeMatches = typeFilter === "all" || artifact.type === typeFilter;
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "generating" &&
          (artifact.status === "pending" || artifact.status === "generating")) ||
        artifact.status === statusFilter;
      const textMatches =
        !normalizedSearch ||
        artifact.title.toLocaleLowerCase().includes(normalizedSearch);
      return typeMatches && statusMatches && textMatches;
    });
  }, [artifacts, search, statusFilter, typeFilter]);

  const openGenerateDialog = (type: ArtifactType) => {
    setDialogType(type);
    setDialogError(null);
    setFocus("");
    setSourceSelection(null);
  };
  const toggleSource = (sourceId: string, checked: boolean) => {
    setSourceSelection((current) => {
      const selected = current ?? readyIds;
      return checked
        ? [...new Set([...selected, sourceId])]
        : selected.filter((id) => id !== sourceId);
    });
  };
  const generate = () => {
    if (!dialogType) return;
    if (selectedSourceIds.length === 0) {
      setDialogError("Add and index at least one source before generating.");
      return;
    }
    const input: CreateArtifactInput = {
      type: dialogType,
      sourceIds: selectedSourceIds,
      ...(focus.trim() ? { focus: focus.trim() } : {}),
      ...(dialogType === "quiz" ? { questionCount } : {}),
      ...(dialogType === "flashcards" ? { cardCount } : {}),
    };
    setDialogError(null);
    create.mutate(input, {
      onSuccess: () => {
        setDialogType(null);
        setFocus("");
      },
      onError: (error) => setDialogError(friendlyGenerationError(error)),
    });
  };
  const deleteArtifact = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => setActionError(getErrorMessage(error)),
    });
  };
  const tabs: Array<{ value: ArtifactType | "all"; label: string }> = [
    { value: "all", label: "All" },
    ...TILES.map(({ type }) => ({ value: type, label: TYPE_TAB_LABELS[type] })),
  ];

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">
            Artifacts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore and create study materials from your sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden w-48 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search artifacts"
              className="h-9 rounded-full pl-9"
            />
          </div>
          <label className="sr-only" htmlFor="artifact-status-filter">
            Filter artifacts by status
          </label>
          <select
            id="artifact-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "ready" | "generating" | "failed"
              )
            }
            className="h-9 rounded-full border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="generating">Generating</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex rounded-full border border-border p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn("rounded-full", view === "grid" && "bg-muted")}
            >
              <Grid2X2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn("rounded-full", view === "list" && "bg-muted")}
            >
              <List />
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Make something new"
            onClick={() =>
              createRowRef.current?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "center",
              })
            }
          >
            <Plus />
          </Button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={typeFilter === value}
            onClick={() => setTypeFilter(value)}
            className={cn(
              "rounded-t-lg border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              typeFilter === value &&
                "border-primary bg-muted/50 font-medium text-foreground"
            )}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto mb-2 w-full md:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search artifacts"
            aria-label="Search artifacts"
            className="h-9 rounded-full pl-9"
          />
        </div>
      </div>

      <section ref={createRowRef} className="mt-6 scroll-mt-6">
        <p className="mb-3 text-sm text-muted-foreground">Make something new</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TILES.map(({ type, title, caption, icon: Icon, accent }) => (
            <button
              key={type}
              type="button"
              onClick={() => openGenerateDialog(type)}
              className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="relative flex aspect-[1.4] items-center justify-center overflow-hidden rounded-2xl border border-border text-[color:var(--tile-accent)] transition-transform group-hover:-translate-y-0.5"
                style={
                  {
                    "--tile-accent": accent,
                    backgroundImage:
                      "radial-gradient(circle at 75% 15%, color-mix(in oklch, var(--tile-accent) 24%, transparent), transparent 55%), linear-gradient(140deg, color-mix(in oklch, var(--tile-accent) 16%, var(--surface)), var(--surface-2))",
                  } as CSSProperties
                }
              >
                <Icon className="size-10 stroke-[1.4]" />
                <span className="absolute inset-0 opacity-20 [background-image:radial-gradient(var(--tile-accent)_0.7px,transparent_0.7px)] [background-size:8px_8px]" />
              </span>
              <span className="mt-2 block text-sm font-medium text-foreground">
                {title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {caption}
              </span>
            </button>
          ))}
        </div>
      </section>

      {actionError && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <section className="mt-8 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl">
            {typeFilter === "all" ? "Your artifacts" : TYPE_TAB_LABELS[typeFilter]}
          </h2>
          <span className="text-xs text-muted-foreground">
            {filteredArtifacts.length} {filteredArtifacts.length === 1 ? "item" : "items"}
          </span>
        </div>
        {artifactsQuery.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="aspect-[1.2] animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : artifactsQuery.isError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {getErrorMessage(artifactsQuery.error)}
          </div>
        ) : filteredArtifacts.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
            <Sparkles className="size-6 text-muted-foreground" />
            <h3 className="mt-3 font-heading text-2xl">
              {artifacts.length === 0
                ? "Your first artifact starts here"
                : "No artifacts match"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {artifacts.length === 0
                ? "Choose a format above to turn your sources into something useful."
                : "Try another search or filter."}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              view === "grid"
                ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                : "space-y-3"
            )}
          >
            {filteredArtifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                workspaceId={workspaceId}
                view={view}
                onDelete={(target) => setDeleteTarget(target)}
                onActionError={setActionError}
              />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={dialogType !== null}
        onOpenChange={(open) => {
          if (!open && !create.isPending) {
            setDialogType(null);
            setDialogError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              Create {dialogType ? TYPE_LABELS[dialogType].toLocaleLowerCase() : "artifact"}
            </DialogTitle>
            <DialogDescription>
              Choose the sources and focus for this study material.
            </DialogDescription>
          </DialogHeader>
          {readySources.length === 0 ? (
            <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>Add and index at least one source before generating an artifact.</p>
            </div>
          ) : (
            <>
              <label className="space-y-2 text-sm font-medium" htmlFor="artifact-focus">
                <span>Focus (optional)</span>
                <textarea
                  id="artifact-focus"
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Emphasize a topic or question"
                  className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              {dialogType === "quiz" && (
                <label className="flex items-center justify-between text-sm">
                  Questions
                  <select
                    value={questionCount}
                    onChange={(event) => setQuestionCount(Number(event.target.value))}
                    className="rounded-lg border border-input bg-background px-3 py-2"
                  >
                    {Array.from({ length: 6 }, (_, index) => index + 5).map(
                      (count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
              {dialogType === "flashcards" && (
                <label className="flex items-center justify-between text-sm">
                  Cards
                  <select
                    value={cardCount}
                    onChange={(event) => setCardCount(Number(event.target.value))}
                    className="rounded-lg border border-input bg-background px-3 py-2"
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 5).map(
                      (count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Sources ({selectedSourceIds.length} selected)
                </legend>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                  {readySources.map((source) => (
                    <label
                      key={source.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={(event) =>
                          toggleSource(source.id, event.target.checked)
                        }
                        className="mt-1 accent-primary"
                      />
                      <span className="line-clamp-2">{cleanTitle(source.title)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => setDialogType(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                create.isPending ||
                readySources.length === 0 ||
                selectedSourceIds.length === 0
              }
              onClick={generate}
            >
              {create.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this artifact?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteArtifact();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
