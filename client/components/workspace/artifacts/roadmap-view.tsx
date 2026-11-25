"use client";

import { Route } from "lucide-react";

import { CitationChip } from "@/components/workspace/citation-chip";
import type { ArtifactContent } from "@/lib/artifact-types";

type RoadmapContent = Extract<ArtifactContent, { kind: "roadmap" }>;

export function RoadmapView({ content }: { content: RoadmapContent }) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-8">
      <header className="space-y-2 border-b border-border pb-4">
        <h3 className="flex items-center gap-2 font-heading text-3xl">
          <Route className="size-5 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {content.description}
        </p>
      </header>

      <ol className="relative ml-3 space-y-5 border-l border-primary/25 pl-7">
        {content.steps.map((step, index) => (
          <li
            key={step.id}
            className="relative rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <span
              className="absolute -left-[2.03rem] top-5 flex size-7 items-center justify-center rounded-full border border-primary/40 bg-background text-xs font-semibold text-primary"
              aria-hidden="true"
            >
              {step.order || index + 1}
            </span>
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-heading text-xl">{step.title}</h4>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">
              {step.description}
            </p>
            <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">
                Why now:{" "}
              </span>
              {step.reason}
            </p>
            <div className="mt-3">
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
