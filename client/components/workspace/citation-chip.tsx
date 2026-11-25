"use client";

import { ExternalLink } from "lucide-react";

type CitationLocation = {
  page?: number;
  startSeconds?: number;
};

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

export function citationSuffix(citation: CitationLocation): string {
  const parts: string[] = [];
  if (citation.page !== undefined) parts.push(`p. ${citation.page}`);
  if (citation.startSeconds !== undefined) {
    parts.push(formatClipTime(citation.startSeconds));
  }
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

export function citationHref(citation: {
  url?: string | null;
  startSeconds?: number;
}): string | undefined {
  if (!citation.url) return undefined;
  if (citation.startSeconds === undefined) return citation.url;
  try {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(citation.url, origin);
    url.searchParams.set("t", `${Math.floor(citation.startSeconds)}s`);
    return url.toString();
  } catch {
    return citation.url;
  }
}

type CitationChipProps = CitationLocation & {
  title: string;
  excerpt?: string;
  url?: string | null;
  /** Chat citations use a number; artifact citations use a source label. */
  number?: number;
  label?: string;
  /** DOM id used by chat markdown links to scroll to this chip. */
  anchorId?: string;
};

/** Shared source chip used by chat answers and Study Studio artifacts. */
export function CitationChip({
  title,
  excerpt,
  url,
  page,
  startSeconds,
  number,
  label,
  anchorId,
}: CitationChipProps) {
  const location = citationSuffix({ page, startSeconds });
  const href = citationHref({ url, startSeconds });
  const marker = number !== undefined ? `[${number}]` : label ? `[${label}]` : null;

  return (
    <span
      id={anchorId}
      title={excerpt ? `${excerpt}${location}` : `${title}${location}`}
      className="inline-flex scroll-mt-24 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
    >
      <span className="font-medium text-foreground/90">
        {marker ? `${marker} ` : ""}
        {title}
        {location}
      </span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Open ${title}`}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
