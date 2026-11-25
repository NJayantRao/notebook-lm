"use client";

import { Route } from "lucide-react";

import { CitationChip } from "@/components/workspace/citation-chip";
import type { ArtifactContent } from "@/lib/artifact-types";

type RoadmapContent = Extract<ArtifactContent, { kind: "roadmap" }>;

export function RoadmapView({ content }: { content: RoadmapContent }) {
  return (
    <div className="space-y-4">
      <header className="space-y-1 border-b border-border pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Route className="h-4 w-4 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {content.description}
        </p>
      </header>

      <ol className="relative ml-3 space-y-3 border-l border-primary/25 pl-5">
        {content.steps.map((step, index) => (
          <li
            key={step.id}
            className="relative rounded-xl border border-border bg-card p-3"
          >
            <span
              className="absolute -left-[1.72rem] top-3 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-background text-[10px] font-semibold text-primary"
              aria-hidden="true"
            >
              {step.order || index + 1}
            </span>
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">{step.title}</h4>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">
              {step.description}
            </p>
            <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">
                Why now:{" "}
              </span>
              {step.reason}
            </p>
            <div className="mt-2">
              <CitationChip
                label={step.citation.label}
                title={step.citation.title}
                url={step.citation.url}
                page={step.citation.page}
                startSeconds={step.citation.startSeconds}
                excerpt={`${step.citation.label} · source chunk ${step.citation.chunkIndex}`}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
