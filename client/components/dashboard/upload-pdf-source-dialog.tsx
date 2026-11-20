"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
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
import { uploadPdfSource } from "@/services/source.service";

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export function UploadPdfSourceDialog({
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
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workspaceId =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.id ??
    workspaces[0]?.id ??
    "";

  const mutation = useMutation({
    mutationFn: ({ workspaceId, file }: { workspaceId: string; file: File }) =>
      uploadPdfSource(workspaceId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recent-sources"] });
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      setFile(null);
      setFileInputKey((key) => key + 1);
      setError(null);
      onOpenChange(false);
    },
    onError: (cause) => setError(getErrorMessage(cause)),
  });

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending && !next) return;
    if (!next) {
      setFile(null);
      setFileInputKey((key) => key + 1);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);

    if (selectedFile && selectedFile.size > MAX_PDF_SIZE_BYTES) {
      setFile(null);
      setFileInputKey((key) => key + 1);
      setError("PDF files must be 25 MB or smaller.");
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!workspaceId) {
      setError("Create a workspace before uploading a PDF.");
      return;
    }
    if (!file) {
      setError("Choose a PDF file to upload.");
      return;
    }

    mutation.mutate({ workspaceId, file });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#101522] text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileUp className="h-4 w-4 text-[#42D8F5]" />
            Upload a PDF
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            PDFs are saved locally on the server. Maximum file size: 25 MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {workspaces.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
              Create a workspace before uploading a PDF.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="pdf-workspace">Workspace</Label>
                <select
                  id="pdf-workspace"
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
                <Label htmlFor="pdf-file">PDF file</Label>
                <Input
                  key={fileInputKey}
                  id="pdf-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  disabled={mutation.isPending}
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/[0.03]"
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
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
                  Uploading...
                </>
              ) : (
                "Upload PDF"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
