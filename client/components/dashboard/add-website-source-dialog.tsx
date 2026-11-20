"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2 } from "lucide-react";
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
import { getErrorMessage } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { createWebsiteSource } from "@/services/source.service";

export function AddWebsiteSourceDialog({
  open,
  onOpenChange,
  workspaces,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: Workspace[];
}) {
  const queryClient = useQueryClient();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const workspaceId =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.id ??
    workspaces[0]?.id ??
    "";

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      return createWebsiteSource(workspaceId, {
        sourceType: "website",
        url: url.trim(),
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recent-sources"] });
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      setUrl("");
      setTitle("");
      setError(null);
      onOpenChange(false);
    },
    onError: (cause) => setError(getErrorMessage(cause)),
  });

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending && !next) return;
    if (!next) {
      setUrl("");
      setTitle("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!workspaceId) {
      setError("Create a workspace before adding a website.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#101522] text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-4 w-4 text-[#42D8F5]" />
            Add a website
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Scrape a page and save its readable content to a workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {workspaces.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
              Create a workspace before adding a website.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="website-workspace">Workspace</Label>
                <select
                  id="website-workspace"
                  value={workspaceId}
                  onChange={(event) =>
                    setSelectedWorkspaceId(event.target.value)
                  }
                  disabled={mutation.isPending}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#101522] px-3 text-sm text-foreground outline-none focus-visible:border-[#477BFF]/50 focus-visible:ring-3 focus-visible:ring-[#477BFF]/30 disabled:opacity-50"
                  required
                >
                  <option value="" disabled>
                    Choose a workspace
                  </option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website-url">Website URL</Label>
                <Input
                  id="website-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/article"
                  disabled={mutation.isPending}
                  required
                  className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website-title">
                  Title <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="website-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Use the page title"
                  disabled={mutation.isPending}
                  className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                />
              </div>
            </>
          )}

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
              disabled={mutation.isPending || workspaces.length === 0}
              className="btn-gradient-primary"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                "Scrape website"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
