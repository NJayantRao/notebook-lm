"use client";

import { useMemo, useState } from "react";
import { BookOpen, Download, Layers3, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CitationChip } from "@/components/workspace/citation-chip";
import { getErrorMessage } from "@/lib/api";
import {
  useDueFlashcards,
  useFlashcardExport,
  useFlashcards,
  useReviewFlashcard,
} from "@/hooks/use-artifacts";
import { cn } from "@/lib/utils";
import type { Artifact, Flashcard } from "@/lib/artifact-types";

const RATINGS: Array<{ rating: number; label: string; tone: string }> = [
  { rating: 0, label: "Again", tone: "border-rose-500/40 text-rose-500" },
  { rating: 3, label: "Hard", tone: "border-amber-500/40 text-amber-500" },
  { rating: 4, label: "Good", tone: "border-emerald-500/40 text-emerald-500" },
  { rating: 5, label: "Easy", tone: "border-sky-500/40 text-sky-500" },
];

export function FlashcardView({ artifact }: { artifact: Artifact }) {
  const { data: flashcards = [] } = useFlashcards(
    artifact.workspaceId,
    artifact.id,
    artifact.content.kind === "flashcards"
  );
  const { data: dueFlashcards = [] } = useDueFlashcards(
    artifact.workspaceId,
    artifact.id,
    artifact.content.kind === "flashcards"
  );
  const review = useReviewFlashcard(artifact.workspaceId);
  const exportDeck = useFlashcardExport(artifact.workspaceId);
  const [studyAll, setStudyAll] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const deck: Flashcard[] = useMemo(
    () => (studyAll ? flashcards : dueFlashcards),
    [studyAll, flashcards, dueFlashcards]
  );

  const toggleStudyAll = () => {
    setStudyAll((value) => !value);
    setIndex(0);
    setRevealed(false);
  };

  if (artifact.content.kind !== "flashcards") {
    return null;
  }

  const current = deck[Math.min(index, Math.max(deck.length - 1, 0))];
  const filename =
    artifact.title.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") ||
    "flashcards";

  const grade = async (rating: number) => {
    if (!current) return;
    try {
      await review.mutateAsync({
        artifactId: artifact.id,
        cardId: current.id,
        rating,
      });
      setRevealed(false);
      setIndex((value) => (value + 1) % Math.max(1, deck.length));
    } catch {
      // The mutation hook logs status/error name without card content.
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2 border-b border-border pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
              {artifact.content.title}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {flashcards.length} cards · {dueFlashcards.length} due
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={studyAll}
            onClick={toggleStudyAll}
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
          >
            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
            {studyAll ? "Due only" : "Study all"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportDeck.isPending}
            onClick={() =>
              exportDeck.mutate({
                artifactId: artifact.id,
                filename: `${filename}.apkg`,
                format: "apkg",
              })
            }
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Anki (.apkg)
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={exportDeck.isPending}
            onClick={() =>
              exportDeck.mutate({
                artifactId: artifact.id,
                filename: `${filename}.json`,
                format: "json",
              })
            }
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            JSON
          </Button>
        </div>
        {exportDeck.isError && (
          <p role="alert" className="text-[11px] text-rose-400">
            {getErrorMessage(exportDeck.error)}
          </p>
        )}
      </header>

      {!current ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">
            {studyAll ? "No cards in this deck." : "All caught up!"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {studyAll
              ? "Generate a new deck from the Study Studio tile."
              : "Switch to Study all to review the full deck."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="w-full rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
            aria-label={revealed ? "Hide answer" : "Reveal answer"}
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span>{revealed ? "Answer" : "Question"}</span>
              <span>
                {index + 1} / {deck.length}
              </span>
            </div>
            <p
              className={cn(
                "mt-4 min-h-24 text-center text-sm leading-relaxed",
                revealed ? "text-foreground" : "font-medium"
              )}
            >
              {revealed ? current.back : current.front}
            </p>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              {revealed ? "Tap to hide" : "Tap to reveal"}
            </p>
          </button>

          {current.citation && (
            <div className="flex flex-wrap gap-1">
              <CitationChip
                label={current.citation.label}
                title={current.citation.title}
                url={current.citation.url}
                page={current.citation.page}
                startSeconds={current.citation.startSeconds}
              />
            </div>
          )}

          <div
            className={cn(
              "grid grid-cols-2 gap-2 sm:grid-cols-4",
              !revealed && "opacity-50"
            )}
          >
            {RATINGS.map(({ rating, label, tone }) => (
              <Button
                key={rating}
                type="button"
                variant="outline"
                disabled={!revealed || review.isPending}
                onClick={() => void grade(rating)}
                className={cn("h-8 text-[11px]", tone)}
              >
                {label}
              </Button>
            ))}
          </div>
          {review.isError && (
            <p role="alert" className="text-[11px] text-rose-400">
              {getErrorMessage(review.error)}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setRevealed(false);
              setIndex((value) => (value + 1) % Math.max(1, deck.length));
            }}
            className="w-full text-[11px]"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Skip card
          </Button>
        </div>
      )}
    </div>
  );
}
