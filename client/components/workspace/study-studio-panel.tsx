"use client";

import {
  BookOpen,
  CircleHelp,
  Headphones,
  Network,
  Route,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STUDY_TOOLS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Roadmap",
    description: "Timeline guide of key concepts.",
    icon: Route,
  },
  {
    title: "Mind Map",
    description: "Interconnect concepts in a graph.",
    icon: Network,
  },
  {
    title: "Podcast",
    description: "A synthetic dialogue show.",
    icon: Headphones,
  },
  {
    title: "Quizzes",
    description: "Test your understanding of sources.",
    icon: CircleHelp,
  },
  {
    title: "Flashcards",
    description: "Spaced repetition cards.",
    icon: BookOpen,
  },
];

export function StudyStudioPanel() {
  return (
    <aside className="hidden min-h-0 w-64 shrink-0 flex-col border-l border-border bg-card/30 lg:flex xl:w-80">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Study Studio
          </h2>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            AI cognitive assets
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
          5 tools
        </span>
      </header>

      <div className="grid min-h-0 grid-cols-1 content-start gap-2.5 overflow-y-auto p-3 xl:grid-cols-2">
        {STUDY_TOOLS.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="flex min-h-40 flex-col rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
                <Icon className="h-4 w-4" />
              </span>
              <span
                className="h-2 w-2 rounded-full bg-muted-foreground/40"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-3 text-base font-semibold">{title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            <div className="mt-3 border-t border-border pt-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Coming soon
              </span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
