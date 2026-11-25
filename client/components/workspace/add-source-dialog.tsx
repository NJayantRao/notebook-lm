"use client";

import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileType,
  FileUp,
  Globe,
  LoaderCircle,
  PlayCircle,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { Source, SourceType } from "@/lib/types";
import {
  createTextSource,
  importWebsiteSource,
  importYouTubeSource,
  uploadPdfSource,
} from "@/services/source.service";

const SOURCE_OPTIONS: Array<{
  type: SourceType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: "text", label: "Text", icon: FileText },
  { type: "markdown", label: "Markdown", icon: FileType },
  { type: "pdf", label: "PDF", icon: FileUp },
  { type: "website", label: "Website", icon: Globe },
  { type: "yt_url", label: "YouTube", icon: PlayCircle },
];

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_LENGTH = 500_000;

const inputClass =
  "h-10 rounded-lg border-input bg-background focus-visible:ring-primary/30";

export function AddSourceDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<SourceType>("pdf");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setSourceType("pdf");
    setTitle("");
    setContent("");
    setUrl("");
    setFile(null);
    setFileInputKey((key) => key + 1);
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<Source> => {
      if (sourceType === "text" || sourceType === "markdown") {
        const sourceContent = (file ? await file.text() : content).trim();
        if (!sourceContent) {
          throw new Error("Add some text or choose a file.");
        }
        if (sourceContent.length > MAX_TEXT_LENGTH) {
          throw new Error("Text sources must be 500,000 characters or fewer.");
        }
        return createTextSource(workspaceId, {
          sourceType,
          title: title.trim(),
          content: sourceContent,
        });
      }

      if (sourceType === "pdf") {
        if (!file) {
          throw new Error("Choose a PDF file to upload.");
        }
        if (file.size > MAX_PDF_SIZE_BYTES) {
          throw new Error("PDF files must be 25 MB or smaller.");
        }
        return uploadPdfSource(workspaceId, file);
      }

      if (sourceType === "website") {
        return importWebsiteSource(workspaceId, {
          url: url.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
        });
      }

      return importYouTubeSource(workspaceId, {
        url: url.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sources"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      resetForm();
      onOpenChange(false);
    },
    onError: (cause) => {
      setError(
        cause instanceof Error ? cause.message : "Could not add source."
      );
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (mutation.isPending && !nextOpen) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const selectSourceType = (nextType: SourceType) => {
    setSourceType(nextType);
    setTitle("");
    setContent("");
    setUrl("");
    setFile(null);
    setFileInputKey((key) => key + 1);
    setError(null);
  };

  const handleSelectedFile = (selectedFile: File | null) => {
    setError(null);
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase();
      const validFile =
        sourceType === "pdf"
          ? fileName.endsWith(".pdf")
          : sourceType === "markdown"
            ? fileName.endsWith(".md") || fileName.endsWith(".markdown")
            : sourceType === "text"
              ? fileName.endsWith(".txt")
              : true;
      if (!validFile) {
        setFile(null);
        setFileInputKey((key) => key + 1);
        setError(
          sourceType === "pdf"
            ? "Choose a PDF file."
            : sourceType === "markdown"
              ? "Choose a Markdown file."
              : "Choose a plain text file."
        );
        return;
      }
    }

    if (
      sourceType === "pdf" &&
      selectedFile &&
      selectedFile.size > MAX_PDF_SIZE_BYTES
    ) {
      setFile(null);
      setFileInputKey((key) => key + 1);
      setError("PDF files must be 25 MB or smaller.");
      return;
    }

    setFile(selectedFile);
    if (selectedFile && !title.trim()) {
      setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleFileDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleSelectedFile(event.dataTransfer.files[0] ?? null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  };

  const textSource = sourceType === "text" || sourceType === "markdown";
  const acceptsFile =
    sourceType === "pdf"
      ? ".pdf,application/pdf"
      : sourceType === "markdown"
        ? ".md,.markdown,text/markdown,text/plain"
        : ".txt,text/plain";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-popover text-foreground sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileUp className="h-4 w-4 text-primary" />
            Add a source
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add material to this workspace for grounded conversations.
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Source type"
          className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-muted/40 p-1"
        >
          {SOURCE_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={sourceType === type}
              disabled={mutation.isPending}
              onClick={() => selectSourceType(type)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                sourceType === type
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 text-primary" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {sourceType === "website" || sourceType === "yt_url" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="source-url">
                  {sourceType === "website" ? "Website URL" : "YouTube URL"}
                </Label>
                <Input
                  id="source-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={
                    sourceType === "website"
                      ? "https://example.com/article"
                      : "https://www.youtube.com/watch?v=..."
                  }
                  disabled={mutation.isPending}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-title">
                  Title{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Use the source title"
                  disabled={mutation.isPending}
                  className={inputClass}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="source-title">
                  Title{sourceType !== "pdf" && " *"}
                </Label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Source title"
                  disabled={mutation.isPending}
                  required={sourceType !== "pdf"}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-file">
                  {sourceType === "pdf"
                    ? "Choose a PDF"
                    : `Upload a ${sourceType === "markdown" ? "Markdown" : "text"} file (optional)`}
                </Label>
                <Input
                  key={fileInputKey}
                  id="source-file"
                  type="file"
                  accept={acceptsFile}
                  onChange={handleFileChange}
                  disabled={mutation.isPending}
                  className="sr-only"
                />
                <label
                  htmlFor="source-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleFileDrop}
                  className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring/40"
                >
                  <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drag and drop or{" "}
                    <span className="text-primary">browse your file</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sourceType === "pdf"
                      ? "PDF up to 25 MB"
                      : sourceType === "markdown"
                        ? "Markdown file, or paste content below"
                        : "Plain text file, or paste content below"}
                  </p>
                  {file && (
                    <p className="mt-3 max-w-full truncate text-xs text-foreground/80">
                      {file.name}
                    </p>
                  )}
                </label>
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>
              {textSource && (
                <div className="space-y-2">
                  <Label htmlFor="source-content">Text content</Label>
                  <Textarea
                    id="source-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={`Paste ${sourceType === "markdown" ? "Markdown" : "plain text"} here, or upload a file above.`}
                    disabled={mutation.isPending}
                    required={!file}
                    maxLength={MAX_TEXT_LENGTH}
                    className="min-h-36 resize-y rounded-lg border-input bg-background"
                  />
                </div>
              )}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
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
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Adding source...
                </>
              ) : (
                "Add source"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
