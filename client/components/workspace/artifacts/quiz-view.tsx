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

  const questions = useMemo(
    () => (content.kind === "quiz" ? content.questions : []),
    [content]
  );
  const latestAttempt = attempts?.[0] ?? null;
  const visibleResult = result ?? (retaking ? null : latestAttempt);

  if (content.kind !== "quiz") {
    return null;
  }

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
        <header className="flex items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <CircleHelp className="h-4 w-4 text-primary" aria-hidden="true" />
              {content.title} · results
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
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
                  {isCorrect ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-label="Correct"
                    />
                  ) : (
                    <XCircle
                      className="h-4 w-4 shrink-0 text-rose-500"
                      aria-label="Incorrect"
                    />
                  )}
                </div>
                <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[11px]">
                  <span className="font-semibold">Your answer: </span>
                  {gradedAnswer?.userAnswer || "(no answer)"}
                </p>
                {!isCorrect && gradedAnswer?.correctAnswer && (
                  <p className="mt-1 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-700 dark:text-emerald-300">
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
                      label={citation.label}
                      title={citation.title}
                      url={citation.url}
                      page={citation.page}
                      startSeconds={citation.startSeconds}
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
    <div className="space-y-4">
      <header className="space-y-1 border-b border-border pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CircleHelp className="h-4 w-4 text-primary" aria-hidden="true" />
          {content.title}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {questions.length} questions · answers are revealed after submission
        </p>
      </header>

      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li key={question.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Question {index + 1} · {QUESTION_TYPES[question.type]}
            </p>
            <p className="mt-1 text-xs font-medium">{question.questionText}</p>

            {question.type === "short_answer" ? (
              <Textarea
                value={answers[question.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
                rows={3}
                maxLength={4000}
                placeholder="Type your answer"
                aria-label={`Answer for question ${index + 1}`}
                className="mt-3 text-xs"
              />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(question.type === "true_false"
                  ? ["true", "false"]
                  : question.options
                ).map((option) => {
                  const selected = answers[question.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: option,
                        }))
                      }
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors",
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
              {question.citations.map((citation) => (
                <CitationChip
                  key={citation.label}
                  label={citation.label}
                  title={citation.title}
                  url={citation.url}
                  page={citation.page}
                  startSeconds={citation.startSeconds}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {submitAttempt.isError && (
        <p role="alert" className="text-xs text-rose-400">
          {getErrorMessage(submitAttempt.error)}
        </p>
      )}
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={!allAnswered || submitAttempt.isPending}
        className="w-full text-xs"
      >
        {submitAttempt.isPending ? "Grading answers…" : "Submit answers"}
      </Button>
    </div>
  );
}
