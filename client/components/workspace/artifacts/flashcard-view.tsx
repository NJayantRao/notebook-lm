"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  { rating: 0, label: "Again", tone: "border-destructive/40 text-destructive" },
  { rating: 3, label: "Hard", tone: "border-warning/40 text-warning" },
  { rating: 4, label: "Good", tone: "border-success/40 text-success" },
  { rating: 5, label: "Easy", tone: "border-primary/40 text-primary" },
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
  const reviewFlashcard = review.mutateAsync;
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

  const current = deck[Math.min(index, Math.max(deck.length - 1, 0))];
  const filename =
    artifact.title.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") ||
    "flashcards";

  const grade = useCallback(
    async (rating: number) => {
      if (!current) return;
      try {
        await reviewFlashcard({
          artifactId: artifact.id,
          cardId: current.id,
          rating,
        });
        setRevealed(false);
        setIndex((value) => (value + 1) % Math.max(1, deck.length));
      } catch {
        // The mutation hook logs status/error name without card content.
      }
    },
    [artifact.id, current, deck.length, reviewFlashcard]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }
      if (event.code === "Space" && current) {
        event.preventDefault();
        setRevealed((value) => !value);
        return;
      }
      const ratingIndex = Number(event.key) - 1;
      if (
        revealed &&
        ratingIndex >= 0 &&
        ratingIndex < RATINGS.length &&
        !review.isPending
      ) {
        event.preventDefault();
        void grade(RATINGS[ratingIndex].rating);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, grade, revealed, review.isPending]);

  if (artifact.content.kind !== "flashcards") {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8">
      <header className="space-y-2 border-b border-border pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-3xl">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              {artifact.content.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {flashcards.length} cards · {dueFlashcards.length} due
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={studyAll}
            onClick={toggleStudyAll}
            className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
          >
            <Layers3 className="size-4" aria-hidden="true" />
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
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
          >
            <Download className="size-4" aria-hidden="true" />
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
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
          >
            <Download className="size-4" aria-hidden="true" />
            JSON
          </Button>
        </div>
        {exportDeck.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(exportDeck.error)}
          </p>
        )}
      </header>

      {!current ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-heading text-2xl">
            {studyAll ? "No cards in this deck." : "All caught up!"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {studyAll
              ? "Generate a new deck from the Study Studio tile."
              : "Switch to Study all to review the full deck."}
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{studyAll ? "Reviewing all cards" : "Cards due for review"}</span>
              <span className="tabular-nums">{index + 1} / {deck.length}</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={deck.length}
              aria-label="Flashcard progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${((index + 1) / deck.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="flex min-h-[min(48dvh,28rem)] w-full flex-col justify-center rounded-3xl border border-border bg-card p-8 text-left transition-colors hover:border-primary/40 sm:p-12"
            aria-label={revealed ? "Hide answer" : "Reveal answer"}
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span>{revealed ? "Answer" : "Question"}</span>
            </div>
            <p
              className={cn(
                "mt-8 min-h-28 text-center font-heading text-2xl leading-relaxed sm:text-3xl",
                revealed ? "text-foreground" : "font-medium"
              )}
            >
              {revealed ? current.back : current.front}
            </p>
            <p className="mt-8 text-center text-xs text-muted-foreground">
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
                className={cn("h-10 rounded-xl text-sm", tone)}
              >
                {label}
              </Button>
            ))}
          </div>
          {review.isError && (
            <p role="alert" className="text-sm text-destructive">
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
            className="w-full text-xs"
          >
            <RotateCcw className="mr-1 size-4" aria-hidden="true" />
            Skip card
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Space to flip · 1–4 to rate
          </p>
        </div>
      )}
    </div>
  );
}
