"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  FileType,
  Globe,
  LoaderCircle,
  MessageSquareText,
  PlayCircle,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AddSourceDialog } from "@/components/workspace/add-source-dialog";
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
import { getErrorMessage } from "@/lib/api";
import type {
  ConversationListItem,
  SourceListItem,
  SourceType,
} from "@/lib/types";
import {
  deleteSource,
  listAllWorkspaceSources,
  reindexSource,
} from "@/services/source.service";

const SOURCE_LABELS: Record<SourceType, string> = {
  text: "Text",
  markdown: "Markdown",
  pdf: "PDF",
  website: "Website",
  yt_url: "YouTube",
};

const SOURCE_ICONS: Record<SourceType, LucideIcon> = {
  text: FileText,
  markdown: FileType,
  pdf: FileText,
  website: Globe,
  yt_url: PlayCircle,
};

const STATUS_STYLES: Record<SourceListItem["status"], string> = {
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  processing: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  ready: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/25 bg-red-500/10 text-red-300",
};

function SourceRow({ source }: { source: SourceListItem }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const Icon = SOURCE_ICONS[source.sourceType];
  const busy = source.status === "pending" || source.status === "processing";

  const invalidateSources = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["sources", source.workspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["workspace", source.workspaceId],
      }),
      queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
    ]);
  };
  const reindexMutation = useMutation({
    mutationFn: () => reindexSource(source.workspaceId, source.id),
    onSuccess: invalidateSources,
    onError: (cause) => setActionError(getErrorMessage(cause)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteSource(source.workspaceId, source.id),
    onSuccess: async () => {
      setConfirmDelete(false);
      await invalidateSources();
    },
    onError: (cause) => setActionError(getErrorMessage(cause)),
  });
  const actionPending = reindexMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <li
        title={source.processingError ?? source.title}
        className="group rounded-xl border border-border bg-card px-3 py-2.5"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {source.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#c75a25]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c75a25]" />
              {SOURCE_LABELS[source.sourceType]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              type="button"
              aria-label={`Reindex ${source.title}`}
              title="Reindex source"
              disabled={actionPending}
              onClick={() => {
                setActionError(null);
                reindexMutation.mutate();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {reindexMutation.isPending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Delete ${source.title}`}
              title="Delete source"
              disabled={actionPending}
              onClick={() => {
                setActionError(null);
                setConfirmDelete(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[source.status]}`}
          >
            {busy && <LoaderCircle className="h-3 w-3 animate-spin" />}
            {source.status}
          </span>
          {source.status === "failed" && source.processingError && (
            <span className="truncate text-xs text-red-300">
              {source.processingError}
            </span>
          )}
        </div>
        {actionError && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {actionError}
          </p>
        )}
      </li>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(nextOpen) => {
          if (!deleteMutation.isPending) setConfirmDelete(nextOpen);
        }}
      >
        <AlertDialogContent className="border-border bg-popover text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{source.title}&quot; and its indexed content will be
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="border-border bg-transparent"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
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

export function WorkspaceSourcesSidebar({
  workspaceId,
  workspaceTitle,
  enabled,
  conversations,
  conversationsLoading,
  conversationsError,
  selectedConversationId,
  onSelectConversation,
}: {
  workspaceId: string;
  workspaceTitle: string;
  enabled: boolean;
  conversations: ConversationListItem[];
  conversationsLoading: boolean;
  conversationsError: unknown;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const sourcesQuery = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => listAllWorkspaceSources(workspaceId),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) =>
          source.status === "pending" || source.status === "processing"
      )
        ? 3000
        : false,
  });
  const sources = sourcesQuery.data ?? [];
  const readyCount = sources.filter(
    (source) => source.status === "ready"
  ).length;

  return (
    <aside className="flex max-h-[42dvh] min-h-0 w-full flex-col border-b border-border bg-card/30 md:max-h-none md:w-72 md:shrink-0 md:border-b-0 md:border-r lg:w-80">
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Workspaces
        </Link>
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground/90">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h1 className="truncate text-base font-semibold">
              {workspaceTitle}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {readyCount} indexed {readyCount === 1 ? "source" : "sources"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setAddSourceOpen(true)}
          className="h-10 w-full rounded-lg bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add source
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Knowledge sources
            </h2>
            <span className="text-xs text-muted-foreground">
              {sources.length}
            </span>
          </div>
          {sourcesQuery.isLoading ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">
              Loading sources...
            </p>
          ) : sourcesQuery.isError ? (
            <div className="flex items-start gap-2 px-1 py-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{getErrorMessage(sourcesQuery.error)}</span>
            </div>
          ) : sources.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No sources yet. Add a document or link to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 border-t border-border pt-4">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conversation history
          </h2>
          {conversationsLoading ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Loading conversations...
            </p>
          ) : conversationsError ? (
            <p className="px-1 py-2 text-sm text-red-300">
              {getErrorMessage(conversationsError)}
            </p>
          ) : conversations.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Your conversations will appear here.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    aria-current={
                      selectedConversationId === conversation.id
                        ? "true"
                        : undefined
                    }
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selectedConversationId === conversation.id
                        ? "bg-white/[0.07] text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-sm">
                      {conversation.title || "New conversation"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AddSourceDialog
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
        workspaceId={workspaceId}
      />
    </aside>
  );
}
