"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft,
  BookOpen,
  CircleHelp,
  Download,
  Headphones,
  LoaderCircle,
  Network,
  RefreshCw,
  Route,
  Trash2,
} from "lucide-react";
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
import { FlashcardView } from "@/components/workspace/artifacts/flashcard-view";
import { PodcastPlayer } from "@/components/workspace/artifacts/podcast-player";
import { QuizView } from "@/components/workspace/artifacts/quiz-view";
import { RoadmapView } from "@/components/workspace/artifacts/roadmap-view";
import { useArtifact, useCreateArtifact, useDeleteArtifact, useFlashcardExport, useRetryArtifact } from "@/hooks/use-artifacts";
import { getErrorMessage } from "@/lib/api";
import type { Artifact, ArtifactStatus, ArtifactType, CreateArtifactInput } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";

const FullPageMindMap = dynamic(
  () =>
    import("@/components/workspace/artifacts/mind-map-view").then(
      (module) => module.MindMapView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-0 animate-pulse bg-muted/30" aria-label="Loading mind map" />
    ),
  }
);

const TYPE_LABELS: Record<ArtifactType, string> = {
  roadmap: "Roadmap",
  mindmap: "Mind map",
  podcast: "Podcast",
  quiz: "Quiz",
  flashcards: "Flashcards",
};

const TYPE_ICONS: Record<ArtifactType, typeof Route> = {
  roadmap: Route,
  mindmap: Network,
  podcast: Headphones,
  quiz: CircleHelp,
  flashcards: BookOpen,
};

const STATUS_TONES: Record<ArtifactStatus, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  generating: "border-primary/30 bg-primary/10 text-primary",
  ready: "border-success/30 bg-success/10 text-success",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function artifactStatusLabel(status: ArtifactStatus) {
  return status === "pending" ? "Generating" : status;
}

function ArtifactStatus({
  status,
  className,
}: {
  status: ArtifactStatus;
  className?: string;
}) {
  const active = status === "pending" || status === "generating";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize",
        STATUS_TONES[status],
        className
      )}
      aria-live={active ? "polite" : undefined}
    >
      {active && <LoaderCircle className="size-3 animate-spin" />}
      {artifactStatusLabel(status)}
    </span>
  );
}

function readableArtifactError(artifact: Artifact) {
  if (
    artifact.type === "podcast" &&
    artifact.errorMessage?.includes("PODCAST_TOO_LONG")
  ) {
    return "This podcast was too long to finish generating. Retry to try again.";
  }
  return artifact.errorMessage || "Generation failed. Please retry.";
}

function LoadingArtifact() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-16 animate-pulse border-b border-border bg-muted/30" />
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-6">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    </div>
  );
}

export function WorkspaceArtifactPage({
  workspaceId,
  artifactId,
}: {
  workspaceId: string;
  artifactId: string;
}) {
  const router = useRouter();
  const { data: artifact, isLoading, isError, error } = useArtifact(
    workspaceId,
    artifactId
  );
  const retry = useRetryArtifact(workspaceId);
  const remove = useDeleteArtifact(workspaceId);
  const create = useCreateArtifact(workspaceId);
  const exportDeck = useFlashcardExport(workspaceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading && !artifact) {
    return <LoadingArtifact />;
  }

  if (!artifact && isError) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const notFound = status === 403 || status === 404;
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-heading text-3xl">
          {notFound ? "Artifact not found" : "Could not load this artifact"}
        </h1>
        <p role={notFound ? undefined : "alert"} className="max-w-md text-sm text-muted-foreground">
          {notFound
            ? "This artifact may have been removed or you may not have access to it."
            : getErrorMessage(error)}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(`/dashboard/workspaces/${workspaceId}/artifacts`)
          }
        >
          <ArrowLeft className="size-4" />
          Back to artifacts
        </Button>
      </main>
    );
  }

  if (!artifact) {
    return <LoadingArtifact />;
  }

  const TypeIcon = TYPE_ICONS[artifact.type];
  const isMindMap = artifact.content.kind === "mindmap";
  const regenerate = () => {
    setActionError(null);
    const params = artifact.input.params;
    const input: CreateArtifactInput = {
      type: artifact.type,
      sourceIds: params.sourceIds,
      ...(params.focus ? { focus: params.focus } : {}),
      ...(params.cardCount ? { cardCount: params.cardCount } : {}),
      ...(params.questionCount ? { questionCount: params.questionCount } : {}),
    };
    create.mutate(input, {
      onError: (cause) => setActionError(getErrorMessage(cause)),
    });
  };
  const deleteArtifact = () => {
    remove.mutate(artifact.id, {
      onSuccess: () =>
        router.push(`/dashboard/workspaces/${workspaceId}/artifacts`),
      onError: (cause) => setActionError(getErrorMessage(cause)),
    });
  };
  const filename =
    artifact.title.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") ||
    "flashcards";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-7">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to artifacts"
          title="Back to artifacts"
          onClick={() =>
            router.push(`/dashboard/workspaces/${workspaceId}/artifacts`)
          }
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-xl sm:text-2xl">
            {artifact.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <TypeIcon className="size-3.5" />
              {TYPE_LABELS[artifact.type]}
            </span>
            <ArtifactStatus status={artifact.status} />
            {artifact.isStale && (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs text-warning">
                Sources changed
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {artifact.type === "flashcards" && artifact.status === "ready" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDeck.isPending}
              onClick={() =>
                exportDeck.mutate({
                  artifactId: artifact.id,
                  filename: `${filename}.apkg`,
                  format: "apkg",
                })
              }
              className="hidden rounded-full sm:inline-flex"
            >
              <Download className="size-4" />
              Export
            </Button>
          )}
          {artifact.status === "failed" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate(artifact.id)}
              className="rounded-full"
            >
              {retry.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Retry
            </Button>
          )}
          {(artifact.status === "ready" || artifact.status === "failed") && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Regenerate artifact"
              title="Regenerate artifact"
              disabled={create.isPending}
              onClick={regenerate}
            >
              <RefreshCw className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete artifact"
            title="Delete artifact"
            disabled={remove.isPending}
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="border-b border-border px-5 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {exportDeck.isError && (
        <p role="alert" className="border-b border-border px-5 py-2 text-sm text-destructive">
          {getErrorMessage(exportDeck.error)}
        </p>
      )}
      {retry.isError && (
        <p role="alert" className="border-b border-border px-5 py-2 text-sm text-destructive">
          {getErrorMessage(retry.error)}
        </p>
      )}

      {artifact.status === "pending" || artifact.status === "generating" ? (
        <section
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
          aria-live="polite"
        >
          <LoaderCircle className="size-8 animate-spin text-primary" />
          <h2 className="font-heading text-3xl">Creating your {TYPE_LABELS[artifact.type].toLocaleLowerCase()}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            This page will update automatically when generation is complete.
          </p>
        </section>
      ) : artifact.status === "failed" ? (
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="font-heading text-3xl">Generation failed</h2>
          <p role="alert" className="text-sm text-muted-foreground">
            {readableArtifactError(artifact)}
          </p>
          <Button
            type="button"
            disabled={retry.isPending}
            onClick={() => retry.mutate(artifact.id)}
          >
            <RefreshCw className="size-4" />
            Retry generation
          </Button>
        </section>
      ) : (
        <>
          {artifact.isStale && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/20 bg-warning/5 px-5 py-3">
              <p className="text-sm text-warning">
                Sources changed since this artifact was created.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={create.isPending}
                onClick={regenerate}
                className="rounded-full"
              >
                Regenerate
              </Button>
            </div>
          )}
          <section
            className={
              isMindMap
                ? "min-h-0 flex-1"
                : "min-h-0 flex-1 overflow-y-auto px-5 sm:px-8"
            }
          >
            {artifact.content.kind === "mindmap" && (
              <div className="h-full min-h-0">
                <FullPageMindMap content={artifact.content} fullPage />
              </div>
            )}
            {artifact.content.kind === "roadmap" && (
              <RoadmapView content={artifact.content} />
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
              <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
                This artifact has no content yet.
              </div>
            )}
          </section>
        </>
      )}

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirmDelete(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this artifact?</AlertDialogTitle>
            <AlertDialogDescription>
              “{artifact.title}” will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
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
    </div>
  );
}
