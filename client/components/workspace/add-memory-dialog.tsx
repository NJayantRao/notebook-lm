"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api";
import { addUserMemory } from "@/services/memory.service";

export function AddMemoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: addUserMemory,
    onSuccess: () => {
      setContent("");
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && !mutation.isPending) {
      setContent("");
      setError(null);
    }
    if (!mutation.isPending) {
      onOpenChange(next);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const memory = content.trim();
    if (!memory || mutation.isPending) return;
    setError(null);
    mutation.mutate(memory);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-popover text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Add a memory
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Save a detail or preference for the assistant to remember in future
            conversations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-memory">Memory</Label>
            <Textarea
              id="user-memory"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="For example: I prefer concise answers with practical examples."
              maxLength={4000}
              rows={4}
              disabled={mutation.isPending}
              autoFocus
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="border-border bg-muted/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
              className="border-border bg-transparent hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add memory"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
