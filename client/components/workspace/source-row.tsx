"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileType,
  Globe,
  LoaderCircle,
  MoreHorizontal,
  PlayCircle,
  RotateCw,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/api";
import { cleanTitle } from "@/lib/citation-label";
import type { SourceListItem, SourceType } from "@/lib/types";
import { deleteSource, reindexSource } from "@/services/source.service";

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
  pending: "border-warning/25 bg-warning/10 text-warning",
  processing: "border-primary/25 bg-primary/10 text-primary",
  ready: "border-success/25 bg-success/10 text-success",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function WorkspaceSourceRow({ source }: { source: SourceListItem }) {
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
  const retryMutation = useMutation({
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
  const actionPending = retryMutation.isPending || deleteMutation.isPending;
  const title = cleanTitle(source.title);

  return (
    <>
      <li
        title={source.processingError ?? title}
        className="rounded-2xl border border-border bg-card px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {SOURCE_LABELS[source.sourceType]}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                  aria-label={`Actions for ${title}`}
                  disabled={actionPending}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {source.status === "failed" && (
                <DropdownMenuItem
                  disabled={actionPending}
                  onClick={() => {
                    setActionError(null);
                    retryMutation.mutate();
                  }}
                >
                  {retryMutation.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RotateCw />
                  )}
                  Retry
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={actionPending}
                onClick={() => {
                  setActionError(null);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[source.status]}`}
          >
            {busy && <LoaderCircle className="size-3 animate-spin" />}
            {source.status}
          </span>
          {source.status === "failed" && source.processingError && (
            <span className="truncate text-xs text-destructive">
              {source.processingError}
            </span>
          )}
        </div>
        {actionError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{title}&quot; and its indexed content will be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
