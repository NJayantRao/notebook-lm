"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { WorkspaceListItem } from "@/lib/types";
import { getErrorMessage } from "@/lib/api";
import {
  createWorkspace,
  deleteWorkspace,
} from "@/services/workspace.service";

const CARD_CLASS =
  "relative flex min-h-52 flex-col rounded-2xl border p-4";

const LABEL_CLASS =
  "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function NewWorkspaceCard() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      setTitle("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (cause) => setError(getErrorMessage(cause)),
  });

  const trimmed = title.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || mutation.isPending) return;
    setError(null);
    mutation.mutate({ title: trimmed, description: null });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${CARD_CLASS} justify-between border-dashed border-foreground/15 bg-card/40`}
    >
      <div className="space-y-2">
        <p className={`${LABEL_CLASS} text-foreground/80`}>
          <span className="h-2 w-2 rounded-full bg-foreground/60" />
          New workspace
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Workspace name..."
          aria-label="Workspace name"
          maxLength={120}
          disabled={mutation.isPending}
          className="h-10 w-full rounded-lg border border-border bg-background/60 px-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="px-2 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!trimmed || mutation.isPending}
        className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-background transition-colors disabled:cursor-not-allowed ${
          trimmed
            ? "bg-foreground hover:bg-foreground/90"
            : "bg-muted-foreground/60"
        }`}
      >
        {mutation.isPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create Notebook
      </button>
    </form>
  );
}

function WorkspaceCardItem({ workspace }: { workspace: WorkspaceListItem }) {
  const count = workspace.sourceCount ?? 0;
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace(workspace.id),
    onSuccess: async () => {
      setConfirmDelete(false);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (cause) => setActionError(getErrorMessage(cause)),
  });

  return (
    <>
      <div
        className={`${CARD_CLASS} group border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/25 focus-within:ring-2 focus-within:ring-ring`}
      >
        <Link
          href={`/dashboard/workspaces/${workspace.id}`}
          aria-label={`Open ${workspace.title}`}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none"
        />

        <button
          type="button"
          aria-label={`Delete ${workspace.title}`}
          title="Delete workspace"
          disabled={deleteMutation.isPending}
          onClick={() => {
            setActionError(null);
            setConfirmDelete(true);
          }}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="pointer-events-none relative z-10 flex h-full flex-col">
          <div className="flex items-start gap-3 pr-10">
            <div className="relative shrink-0">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                {workspace.icon ? (
                  <span className="text-xl leading-none">{workspace.icon}</span>
                ) : (
                  <BookOpen className="h-6 w-6" />
                )}
              </span>
              <span className="absolute -bottom-1 -right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background shadow-md transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <p className={`${LABEL_CLASS} text-[#d9480f]`}>
                <span className="h-2 w-2 rounded-full bg-[#d9480f]" />
                {count} {count === 1 ? "Document" : "Documents"}
              </p>
              <h3 className="mt-1.5 line-clamp-3 break-words text-lg font-medium leading-snug text-foreground">
                {workspace.title}
              </h3>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-sm font-medium text-foreground/75">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(workspace.createdAt)}</span>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setConfirmDelete(open);
        }}
      >
        <AlertDialogContent className="border-border bg-popover text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{workspace.title}&quot; and all of its sources will be
              removed. This cannot be undone.
            </AlertDialogDescription>
            {actionError && (
              <p role="alert" className="text-sm text-red-400">
                {actionError}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function WorkspaceGrid({
  workspaces,
  loading,
  error,
}: {
  workspaces: WorkspaceListItem[];
  loading: boolean;
  error: unknown;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.title.toLowerCase().includes(q));
  }, [workspaces, query]);

  return (
    <section>
      <div className="flex flex-col gap-3 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            My Research Notebooks
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm font-normal leading-relaxed text-muted-foreground sm:text-base">
            Create a workspace or select a research notebook below to begin
            querying your ingested sources.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notebooks..."
              aria-label="Search notebooks"
              className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <span className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground">
            {workspaces.length} Active Workspaces
          </span>
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Unable to load workspaces</p>
              <p className="mt-1 opacity-80">{getErrorMessage(error)}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <NewWorkspaceCard />
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${CARD_CLASS} border-border bg-card`}
                  >
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-6 w-3/4" />
                      </div>
                    </div>
                    <Skeleton className="mt-auto h-4 w-28" />
                  </div>
                ))
              : filtered.map((workspace) => (
                  <WorkspaceCardItem key={workspace.id} workspace={workspace} />
                ))}
          </div>
        )}
        {!loading && !error && query.trim() && filtered.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            No notebooks match &quot;{query.trim()}&quot;.
          </p>
        )}
      </div>
    </section>
  );
}
