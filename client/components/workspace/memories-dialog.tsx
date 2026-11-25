"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api";
import {
  deleteMemory,
  listMemories,
  updateMemory,
  type UserMemory,
} from "@/services/memory.service";

const memoryText = (memory: UserMemory): string =>
  memory.memory ?? memory.data?.memory ?? "";

export function MemoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memoriesQuery = useQuery({
    queryKey: ["memories"],
    queryFn: () => listMemories(),
    enabled: open,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["memories"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateMemory(id, text),
    onSuccess: async () => {
      setEditingId(null);
      setDraft("");
      setError(null);
      await refresh();
    },
    onError: (cause) => setError(getErrorMessage(cause)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: async () => {
      setDeletingId(null);
      setError(null);
      await refresh();
    },
    onError: (cause) => setError(getErrorMessage(cause)),
  });

  const memories = memoriesQuery.data?.results ?? [];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setError(null);
          onOpenChange(next);
        }}
      >
        <DialogContent className="border-border bg-popover text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Your memories
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review and edit what the assistant remembers about you.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
            Memories are stored with a third-party service (Mem0), not in this
            app&apos;s database.
          </p>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {memoriesQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading memories...
            </p>
          ) : memoriesQuery.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              {getErrorMessage(memoriesQuery.error)}
            </p>
          ) : memories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No memories saved yet.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="rounded-xl border border-border bg-muted/20 p-3"
                >
                  {editingId === memory.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        rows={3}
                        maxLength={4000}
                        disabled={updateMutation.isPending}
                        aria-label="Edit memory"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!draft.trim() || updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: memory.id,
                              text: draft.trim(),
                            })
                          }
                        >
                          {updateMutation.isPending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6">
                        {memoryText(memory) || "(empty memory)"}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Edit memory"
                        title="Edit memory"
                        onClick={() => {
                          setEditingId(memory.id);
                          setDraft(memoryText(memory));
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete memory"
                        title="Delete memory"
                        onClick={() => setDeletingId(memory.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(next) => {
          if (!next) setDeletingId(null);
        }}
      >
        <AlertDialogContent className="border-border bg-popover text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the memory from the third-party memory service. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel             className="border-border bg-transparent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
