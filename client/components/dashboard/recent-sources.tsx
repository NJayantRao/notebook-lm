"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileCode,
  Globe,
  PlayCircle,
  File,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/api";
import { cleanTitle } from "@/lib/citation-label";
import type { SourceListItem, SourceStatus, SourceType } from "@/lib/types";
import { deleteSource, reindexSource } from "@/services/source.service";

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

function SourceIcon({ type }: { type: SourceType }) {
  switch (type) {
    case "markdown":
      return <FileCode className="h-4 w-4" />;
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "website":
      return <Globe className="h-4 w-4" />;
    case "yt_url":
      return <PlayCircle className="h-4 w-4" />;
    case "text":
    default:
      return <File className="h-4 w-4" />;
  }
}

function statusMeta(status: SourceStatus) {
  switch (status) {
    case "ready":
      return {
        label: "Ready",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "processing":
      return {
        label: "Processing",
        className: "border-sky-500/20 bg-sky-500/10 text-sky-300",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-red-500/20 bg-red-500/10 text-red-300",
        icon: <AlertCircle className="h-3 w-3" />,
      };
    case "pending":
    default:
      return {
        label: "Pending",
        className: "border-white/10 bg-white/[0.04] text-muted-foreground",
        icon: <Clock3 className="h-3 w-3" />,
      };
  }
}

function typeLabel(type: SourceType) {
  switch (type) {
    case "yt_url":
      return "YouTube";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "website":
      return "Website";
    case "text":
    default:
      return "Text";
  }
}

function SourceRow({ source }: { source: SourceListItem }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["recent-sources"] });
    await queryClient.invalidateQueries({
      queryKey: ["sources", source.workspaceId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["workspace", source.workspaceId],
    });
  };

  const retryMutation = useMutation({
    mutationFn: () => reindexSource(source.workspaceId, source.id),
    onSuccess: invalidate,
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSource(source.workspaceId, source.id),
    onSuccess: async () => {
      setConfirmDelete(false);
      await invalidate();
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const meta = statusMeta(source.status);

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#42D8F5]">
            <SourceIcon type={source.sourceType} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {cleanTitle(source.title)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{typeLabel(source.sourceType)}</span>
              <span className="text-white/20">•</span>
              <span>Added {formatDate(source.createdAt)}</span>
            </div>
            {source.status === "failed" && source.processingError && (
              <p
                className="mt-1 line-clamp-2 text-xs text-red-300"
                title={source.processingError}
              >
                {source.processingError}
              </p>
            )}
            {actionError && (
              <p role="alert" className="mt-1 text-xs text-red-300">
                {actionError}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label={`Actions for ${cleanTitle(source.title)}`}
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {source.status === "failed" && (
                <DropdownMenuItem
                  disabled={retryMutation.isPending || deleteMutation.isPending}
                  onClick={() => {
                    setActionError(null);
                    retryMutation.mutate();
                  }}
                >
                  <RotateCw className="h-4 w-4" />
                  Retry
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={retryMutation.isPending || deleteMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!deleteMutation.isPending) setConfirmDelete(next);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#101522] text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              &quot;{cleanTitle(source.title)}&quot; and its indexed content will be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500/80 hover:bg-red-500"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function RecentSources({
  sources,
  loading,
  hasWorkspaces,
}: {
  sources: SourceListItem[];
  loading: boolean;
  hasWorkspaces: boolean;
}) {
  return (
    <section id="recent" className="scroll-mt-24 space-y-4 pb-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Recent Sources
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest sources added across your workspaces.
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.02]">
        {!hasWorkspaces ? (
          <div className="p-6 text-sm text-muted-foreground">
            Create a workspace to start adding sources.
          </div>
        ) : loading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No sources yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sources you add to your workspaces will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
