"use client";

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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SourceListItem, SourceStatus, SourceType } from "@/lib/types";

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
            {sources.map((source) => {
              const meta = statusMeta(source.status);
              return (
                <div
                  key={source.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#42D8F5]">
                      <SourceIcon type={source.sourceType} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {source.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{typeLabel(source.sourceType)}</span>
                        <span className="text-white/20">•</span>
                        <span>Added {formatDate(source.createdAt)}</span>
                      </div>
                      {source.status === "failed" &&
                        source.processingError && (
                          <p
                            className="mt-1 line-clamp-2 text-xs text-red-300"
                            title={source.processingError}
                          >
                            {source.processingError}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center sm:justify-end">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
