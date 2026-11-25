"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
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
  enabled,
  conversations,
  conversationsLoading,
  conversationsError,
  selectedConversationId,
  onSelectConversation,
  onStartNewConversation,
}: {
  workspaceId: string;
  enabled: boolean;
  conversations: ConversationListItem[];
  conversationsLoading: boolean;
  conversationsError: unknown;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onStartNewConversation: () => void;
}) {
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [openSection, setOpenSection] = useState<
    "conversations" | "sources" | "artifacts" | null
  >("conversations");
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

  return (
    <aside className="flex max-h-[42dvh] min-h-0 w-full flex-col border-b border-border bg-card/30 md:max-h-none md:w-72 md:shrink-0 md:border-b-0 md:border-r lg:w-80">
      <div className="shrink-0 border-b border-border p-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Workspaces
        </Link>
        <Button
          type="button"
          onClick={onStartNewConversation}
          className="mt-3 h-10 w-full justify-start rounded-lg bg-foreground px-3 font-semibold text-background hover:bg-foreground/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3">
        <section className="min-h-0 overflow-hidden border-b border-border">
          <button
            type="button"
            onClick={() => {
              setOpenSection((current) =>
                current === "conversations" ? null : "conversations"
              );
            }}
            className="flex h-[49px] w-full shrink-0 items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span>Conversation history</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                openSection === "conversations" ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className={`h-[calc(100%-49px)] overflow-y-auto overscroll-contain px-4 pb-4 ${
              openSection === "conversations" ? "block" : "hidden"
            }`}
          >
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
          </div>
        </section>

        <section className="min-h-0 overflow-hidden border-b border-border">
          <button
            type="button"
            onClick={() => {
              setOpenSection((current) =>
                current === "sources" ? null : "sources"
              );
            }}
            className="flex h-[49px] w-full shrink-0 items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span>Knowledge sources</span>
            <span className="flex items-center gap-1.5">
              <span>{sources.length}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  openSection === "sources" ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>
          <div
            className={`h-[calc(100%-49px)] overflow-y-auto overscroll-contain px-4 pb-4 ${
              openSection === "sources" ? "block" : "hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => setAddSourceOpen(true)}
              className="mb-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add source
            </button>
            {sourcesQuery.isLoading ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                Loading sources...
              </p>
            ) : sourcesQuery.isError ? (
              <div className="flex items-start gap-2 px-1 py-2 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{getErrorMessage(sourcesQuery.error)}</span>
              </div>
            ) : sources.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                No knowledge sources yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpenSection((current) =>
                current === "artifacts" ? null : "artifacts"
              );
            }}
            className="flex h-[49px] w-full shrink-0 items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span>Artifacts</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                openSection === "artifacts" ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className={`h-[calc(100%-49px)] overflow-y-auto overscroll-contain px-4 pb-4 ${
              openSection === "artifacts" ? "block" : "hidden"
            }`}
          >
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Artifacts are coming soon.
            </p>
          </div>
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
