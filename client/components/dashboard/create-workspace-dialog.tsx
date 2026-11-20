"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/services/workspace.service";
import { getErrorMessage } from "@/lib/api";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["recent-sources"] });
      setTitle("");
      setDescription("");
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Please enter a workspace title.");
      return;
    }
    mutation.mutate({
      title: trimmed,
      description: description.trim() ? description.trim() : null,
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null);
      setTitle("");
      setDescription("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#101522] text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Create workspace
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Start a new space to bring your knowledge together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-title">Title</Label>
            <Input
              id="ws-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Research"
              disabled={mutation.isPending}
              className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-description">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="ws-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              disabled={mutation.isPending}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus-visible:border-[#477BFF]/50 focus-visible:ring-3 focus-visible:ring-[#477BFF]/30 disabled:opacity-50"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <DialogFooter className="border-white/10 bg-white/[0.02]">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
              className="border-white/10 bg-transparent hover:bg-white/[0.05]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="btn-gradient-primary"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
