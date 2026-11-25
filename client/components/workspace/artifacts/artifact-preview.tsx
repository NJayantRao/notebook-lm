import type { CSSProperties } from "react";
import type { Artifact } from "@/lib/artifact-types";

const typeAccent: Record<Artifact["type"], string> = {
  roadmap: "var(--artifact-roadmap)",
  mindmap: "var(--artifact-mindmap)",
  podcast: "var(--artifact-podcast)",
  quiz: "var(--artifact-quiz)",
  flashcards: "var(--artifact-flashcards)",
};

function MindMapPreview({ artifact }: { artifact: Artifact }) {
  const nodes =
    artifact.content.kind === "mindmap" ? artifact.content.nodes.slice(0, 3) : [];
  return (
    <svg viewBox="0 0 360 160" className="h-full w-full" aria-hidden="true">
      <path d="M75 50 177 80 275 45M177 80l98 38" fill="none" stroke="currentColor" strokeOpacity=".35" />
      {[
        [75, 50],
        [177, 80],
        [275, 45],
        [275, 118],
      ].map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <rect
            x={x - 37}
            y={y - 14}
            width="74"
            height="28"
            rx="9"
            fill="var(--surface)"
            stroke="currentColor"
            strokeOpacity=".45"
          />
          <text
            x={x}
            y={y + 3}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize="8"
          >
            {(nodes[index]?.label ?? `Concept ${index + 1}`).slice(0, 13)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PodcastPreview({ artifact }: { artifact: Artifact }) {
  const duration = artifact.durationSec ?? 0;
  const bars = Array.from({ length: 42 }, (_, index) => {
    const height = 14 + ((index * 17 + artifact.id.length * 11) % 46);
    return (
      <rect
        key={index}
        x={index * 8 + 12}
        y={(100 - height) / 2}
        width="4"
        height={height}
        rx="2"
        fill="currentColor"
        opacity={index % 4 === 0 ? 0.9 : 0.55}
      />
    );
  });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 360 100" className="h-20 w-full" aria-hidden="true">
        {bars}
      </svg>
      <span className="text-xs tabular-nums text-foreground/75">
        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

function QuizPreview({ artifact }: { artifact: Artifact }) {
  const question =
    artifact.content.kind === "quiz" ? artifact.content.questions[0] : null;
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {artifact.content.kind === "quiz"
          ? `${artifact.content.questions.length} questions`
          : "Quiz"}
      </p>
      <p className="line-clamp-3 font-heading text-lg leading-snug">
        {question?.questionText ?? "A focused set of questions from your sources"}
      </p>
    </div>
  );
}

function FlashcardsPreview({ artifact }: { artifact: Artifact }) {
  const front =
    artifact.content.kind === "flashcards" ? artifact.content.cards[0]?.front : "";
  return (
    <div className="relative flex h-full items-center justify-center px-7">
      <div className="absolute h-24 w-40 translate-x-4 translate-y-2 rotate-6 rounded-xl border border-border bg-background/70" />
      <div className="absolute h-24 w-40 -translate-x-3 -translate-y-2 -rotate-6 rounded-xl border border-border bg-background/85" />
      <div className="relative flex h-24 w-40 items-center justify-center rounded-xl border border-border bg-background p-3 text-center text-sm font-medium shadow-sm">
        <span className="line-clamp-3">
          {front || "Your first review card"}
        </span>
      </div>
    </div>
  );
}

function RoadmapPreview({ artifact }: { artifact: Artifact }) {
  const steps =
    artifact.content.kind === "roadmap" ? artifact.content.steps.slice(0, 4) : [];
  return (
    <div className="flex h-full items-center px-6">
      <ol className="relative space-y-3 border-l border-current/40 pl-5">
        {[0, 1, 2, 3].map((index) => (
          <li key={steps[index]?.id ?? index} className="relative">
            <span className="absolute -left-[1.63rem] top-1 size-3 rounded-full border-2 border-current bg-background" />
            <span className="line-clamp-1 text-xs font-medium">
              {steps[index]?.title ?? `Step ${index + 1}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const accent = typeAccent[artifact.type];
  return (
    <div
      className="aspect-video overflow-hidden rounded-t-2xl p-4 text-[color:var(--preview-accent)]"
      style={
        {
          "--preview-accent": accent,
          backgroundImage:
            "radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--preview-accent) 22%, transparent), transparent 56%), linear-gradient(135deg, color-mix(in oklch, var(--preview-accent) 12%, var(--surface)), var(--surface-2))",
        } as CSSProperties & { "--preview-accent": string }
      }
    >
      {artifact.type === "mindmap" && <MindMapPreview artifact={artifact} />}
      {artifact.type === "podcast" && <PodcastPreview artifact={artifact} />}
      {artifact.type === "quiz" && <QuizPreview artifact={artifact} />}
      {artifact.type === "flashcards" && <FlashcardsPreview artifact={artifact} />}
      {artifact.type === "roadmap" && <RoadmapPreview artifact={artifact} />}
    </div>
  );
}
