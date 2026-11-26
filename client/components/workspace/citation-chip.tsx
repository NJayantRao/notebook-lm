"use client";

import {
  ExternalLink,
  FileText,
  Globe,
  Play,
} from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cleanTitle, shortTitle } from "@/lib/citation-label";
import type { SourceType } from "@/lib/types";

export type CitationChipData = {
  sourceId?: string | null;
  title: string;
  sourceType: SourceType | "web";
  url?: string | null;
  page?: number;
  startSeconds?: number;
  excerpt?: string;
  number?: number;
};

type CitationChipProps = {
  citation: CitationChipData;
  workspaceId: string;
  anchorId?: string;
};

function safeHttpUrl(value?: string | null): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

function youtubeVideoId(value?: string | null): string | undefined {
  const url = safeHttpUrl(value);
  if (!url) return undefined;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }
  if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) {
    return undefined;
  }

  const queryId = url.searchParams.get("v");
  if (queryId) return queryId;
  const [, pathId] = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/) ?? [];
  return pathId;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => alt)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, (_, label: string) => label)
    .replace(/`([^`]+)`/g, (_, code: string) => code)
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceListHref(workspaceId: string): string {
  return `/dashboard/workspaces/${encodeURIComponent(workspaceId)}/sources`;
}

function formatYouTubeTime(seconds?: number): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatClipTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

export function CitationChip({
  citation,
  workspaceId,
  anchorId,
}: CitationChipProps) {
  const title = cleanTitle(citation.title);
  const websiteUrl =
    citation.sourceType === "website" || citation.sourceType === "web"
      ? safeHttpUrl(citation.url)
      : undefined;
  const videoId =
    citation.sourceType === "yt_url"
      ? youtubeVideoId(citation.url)
      : undefined;
  const videoUrl = videoId
    ? new URL("https://www.youtube.com/watch")
    : undefined;

  if (videoUrl && videoId) {
    videoUrl.searchParams.set("v", videoId);
    if (citation.startSeconds !== undefined) {
      videoUrl.searchParams.set(
        "t",
        `${Math.max(0, Math.floor(citation.startSeconds))}s`
      );
    }
  }

  const externalUrl =
    websiteUrl?.toString() ?? videoUrl?.toString() ?? undefined;
  const href = externalUrl ?? sourceListHref(workspaceId);
  const label =
    citation.sourceType === "pdf"
      ? `${shortTitle(title)}${citation.page !== undefined ? ` · p.${citation.page}` : ""}`
      : citation.sourceType === "website" || citation.sourceType === "web"
        ? websiteUrl?.hostname.replace(/^www\./i, "") ?? shortTitle(title)
        : citation.sourceType === "yt_url"
          ? `YouTube${formatYouTubeTime(citation.startSeconds) ? ` · ${formatYouTubeTime(citation.startSeconds)}` : ""}`
          : shortTitle(title);
  const typeLabel =
    citation.sourceType === "pdf"
      ? citation.page !== undefined
        ? `PDF · Page ${citation.page}`
        : "PDF"
      : citation.sourceType === "website" || citation.sourceType === "web"
        ? "Website"
        : citation.sourceType === "yt_url"
          ? "YouTube"
          : citation.sourceType === "markdown"
            ? "Markdown"
            : "Text";
  const Icon =
    citation.sourceType === "website" || citation.sourceType === "web"
      ? Globe
      : citation.sourceType === "yt_url"
        ? Play
        : FileText;
  const excerpt = citation.excerpt
    ? stripMarkdown(citation.excerpt)
    : undefined;

  return (
    <HoverCard>
      <HoverCardTrigger
        id={anchorId}
        href={href}
        target={externalUrl ? "_blank" : undefined}
        rel={externalUrl ? "noopener noreferrer" : undefined}
        aria-label={`Open ${title}`}
        delay={400}
        closeDelay={100}
        className="inline-flex max-w-[200px] scroll-mt-24 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/90 transition-colors hover:bg-accent"
        render={<a />}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="top"
        className="w-72 space-y-2.5"
      >
        <div>
          <p className="line-clamp-2 font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{typeLabel}</p>
        </div>
        {excerpt && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {excerpt}
          </p>
        )}
        <a
          href={href}
          target={externalUrl ? "_blank" : undefined}
          rel={externalUrl ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Open source
          <ExternalLink className="size-3.5" />
        </a>
      </HoverCardContent>
    </HoverCard>
  );
}
