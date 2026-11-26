"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationChip } from "@/components/workspace/citation-chip";
import { getErrorMessage } from "@/lib/api";
import { useQuizAttempts, useSubmitQuizAttempt } from "@/hooks/use-artifacts";
import { cn } from "@/lib/utils";
import type { Artifact, QuizAttempt, QuizQuestion } from "@/lib/artifact-types";

const QUESTION_TYPES: Record<QuizQuestion["type"], string> = {
  mcq: "Multiple choice",
  true_false: "True or false",
  short_answer: "Short answer",
};

export function QuizView({ artifact }: { artifact: Artifact }) {
  const content = artifact.content;
  const { data: attempts } = useQuizAttempts(
    artifact.workspaceId,
    artifact.id,
    content.kind === "quiz"
  );
  const submitAttempt = useSubmitQuizAttempt(artifact.workspaceId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const questions = useMemo(
    () => (content.kind === "quiz" ? content.questions : []),
    [content]
  );
  const latestAttempt = attempts?.[0] ?? null;
  const visibleResult = result ?? (retaking ? null : latestAttempt);

  if (content.kind !== "quiz") {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.every(
    (question) => Boolean(answers[question.id]?.trim())
  );

  const submit = async () => {
    if (!allAnswered || submitAttempt.isPending) return;
    try {
      const graded = await submitAttempt.mutateAsync({
        artifactId: artifact.id,
        answers: questions.map((question) => ({
          questionId: question.id,
          userAnswer: answers[question.id]!.trim(),
        })),
      });
      setResult(graded);
      setRetaking(false);
    } catch {
      // The mutation hook logs status/error name without answer text.
    }
  };

  if (visibleResult) {
    return (
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-2 border-b border-border pb-4">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-3xl">
              <CircleHelp className="size-5 text-primary" aria-hidden="true" />
              {content.title} · results
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You scored {visibleResult.score} of {visibleResult.totalQuestions}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
            onClick={() => {
              setResult(null);
              setRetaking(true);
              setAnswers({});
              setCurrentIndex(0);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>
        </header>

        <div className="space-y-3">
          {questions.map((question, index) => {
            const gradedAnswer = visibleResult.answers.find(
              (answer) => answer.questionId === question.id
            );
            const isCorrect = gradedAnswer?.isCorrect ?? false;
            return (
              <article
                key={question.id}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Question {index + 1} · {QUESTION_TYPES[question.type]}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {question.questionText}
                    </p>
                  </div>
                  {attempts && attempts.length > 0 && (
                    <section className="border-t border-border pt-5">
                      <h4 className="font-heading text-xl">Previous attempts</h4>
                      <ul className="mt-2 space-y-2">
                        {attempts.map((attempt) => (
                          <li
                            key={attempt.id}
                            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {new Date(attempt.createdAt).toLocaleDateString()}
                            </span>
                            <span className="font-medium">
                              {attempt.score} / {attempt.totalQuestions}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {isCorrect ? (
                    <CheckCircle2
                      className="size-4 shrink-0 text-success"
                      aria-label="Correct"
                    />
                  ) : (
                    <XCircle
                      className="size-4 shrink-0 text-destructive"
                      aria-label="Incorrect"
                    />
                  )}
                </div>
                <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[11px]">
                  <span className="font-semibold">Your answer: </span>
                  {gradedAnswer?.userAnswer || "(no answer)"}
                </p>
                {!isCorrect && gradedAnswer?.correctAnswer && (
                  <p className="mt-1 rounded-lg bg-success/10 p-2 text-[11px] text-success">
                    <span className="font-semibold">Expected: </span>
                    {gradedAnswer.correctAnswer}
                  </p>
                )}
                {gradedAnswer?.explanation && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {gradedAnswer.explanation}
                  </p>
                )}
                {gradedAnswer?.feedback && (
                  <p className="mt-1 text-[11px] italic text-muted-foreground">
                    {gradedAnswer.feedback}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {question.citations.map((citation) => (
                    <CitationChip
                      key={citation.label}
                      citation={citation}
                      workspaceId={artifact.workspaceId}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
      <header className="space-y-2 border-b border-border pb-4">
        <h3 className="flex items-center gap-2 font-heading text-3xl">
          <CircleHelp className="size-5 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {questions.length} questions · answers are revealed after submission
        </p>
      </header>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-label="Quiz progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {currentQuestion && (
        <article className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Question {currentIndex + 1} · {QUESTION_TYPES[currentQuestion.type]}
            </p>
            <p className="mt-3 font-heading text-2xl leading-snug">
              {currentQuestion.questionText}
            </p>

            {currentQuestion.type === "short_answer" ? (
              <Textarea
                value={answers[currentQuestion.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }))
                }
                rows={3}
                maxLength={4000}
                placeholder="Type your answer"
                aria-label={`Answer for question ${currentIndex + 1}`}
                className="mt-5 text-sm"
              />
            ) : (
              <div className="mt-5 grid gap-2">
                {(currentQuestion.type === "true_false"
                  ? ["true", "false"]
                  : currentQuestion.options
                ).map((option) => {
                  const selected = answers[currentQuestion.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [currentQuestion.id]: option,
                        }))
                      }
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        selected
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1">
              {currentQuestion.citations.map((citation) => (
                <CitationChip
                  key={citation.label}
                  citation={citation}
                  workspaceId={artifact.workspaceId}
                />
              ))}
            </div>
        </article>
      )}

      {submitAttempt.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(submitAttempt.error)}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={currentIndex === 0 || submitAttempt.isPending}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
        >
          Previous
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button
            type="button"
            disabled={
              !currentQuestion ||
              !answers[currentQuestion.id]?.trim() ||
              submitAttempt.isPending
            }
            onClick={() =>
              setCurrentIndex((index) =>
                Math.min(questions.length - 1, index + 1)
              )
            }
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!allAnswered || submitAttempt.isPending}
          >
            {submitAttempt.isPending ? "Grading answers…" : "Submit answers"}
          </Button>
        )}
      </div>
    </div>
  );
}
