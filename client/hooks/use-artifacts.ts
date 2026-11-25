"use client";

import { useEffect, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import axios from "axios";

import { logger } from "@/lib/logger";
import type {
  Artifact,
  ArtifactStatus,
  CreateArtifactInput,
  Flashcard,
  ListArtifactsFilters,
  QuizAttempt,
} from "@/lib/artifact-types";
import * as artifactService from "@/services/artifact.service";

export const artifactKeys = {
  all: ["artifacts"] as const,
  list: (workspaceId: string, filters: ListArtifactsFilters = {}) =>
    ["artifacts", workspaceId, filters] as const,
  detail: (workspaceId: string, artifactId: string) =>
    ["artifact", workspaceId, artifactId] as const,
  attempts: (workspaceId: string, artifactId: string) =>
    ["artifact-attempts", workspaceId, artifactId] as const,
  flashcards: (workspaceId: string, artifactId: string) =>
    ["artifact-flashcards", workspaceId, artifactId] as const,
  dueFlashcards: (workspaceId: string, artifactId: string) =>
    ["artifact-due-flashcards", workspaceId, artifactId] as const,
};

const ACTIVE_STATUSES: ArtifactStatus[] = ["pending", "generating"];

const isActive = (status: ArtifactStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

const shouldPoll = (data: Artifact | undefined): number | false =>
  data && isActive(data.status) ? 3_000 : false;

const logFailure = (operation: string, error: unknown): void => {
  logger.error("artifact.request.failed", {
    operation,
    status: axios.isAxiosError(error) ? error.response?.status : undefined,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
};

export function useArtifacts(
  workspaceId: string,
  enabled = true,
  filters: ListArtifactsFilters = {}
) {
  return useQuery({
    queryKey: artifactKeys.list(workspaceId, filters),
    queryFn: () => artifactService.listArtifacts(workspaceId, filters),
    enabled,
  });
}

export function useArtifact(
  workspaceId: string,
  artifactId: string | null,
  enabled = true
) {
  const queryClient = useQueryClient();
  const lastTerminal = useRef<{ id: string; status: ArtifactStatus } | null>(null);
  const query = useQuery({
    queryKey: artifactKeys.detail(workspaceId, artifactId ?? "none"),
    queryFn: () => {
      if (!artifactId) {
        throw new Error("An artifact id is required.");
      }
      return artifactService.getArtifact(workspaceId, artifactId);
    },
    enabled: enabled && Boolean(artifactId),
    refetchInterval: (state) => shouldPoll(state.state.data),
  });
  const status = query.data?.status;

  // Only the detail endpoint is polled. Refresh lists once per terminal
  // transition so a finished artifact appears without repeated list requests.
  useEffect(() => {
    if (!artifactId || !status) {
      return;
    }
    if (isActive(status)) {
      lastTerminal.current = null;
      return;
    }
    if (
      lastTerminal.current?.id === artifactId &&
      lastTerminal.current.status === status
    ) {
      return;
    }
    lastTerminal.current = { id: artifactId, status };
    void queryClient.invalidateQueries({ queryKey: artifactKeys.all });
  }, [artifactId, status, queryClient]);

  return query;
}

export function useCreateArtifact(
  workspaceId: string
): UseMutationResult<Artifact, unknown, CreateArtifactInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArtifactInput) =>
      artifactService.createArtifact(workspaceId, input),
    onSuccess: (artifact) => {
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.all,
      });
      logger.info("artifact.create.succeeded", {
        workspaceId,
        artifactId: artifact.id,
        type: artifact.type,
      });
    },
    onError: (error) => logFailure("create", error),
  });
}

export function useDeleteArtifact(
  workspaceId: string
): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artifactId: string) =>
      artifactService.deleteArtifact(workspaceId, artifactId),
    onSuccess: (_data, artifactId) => {
      queryClient.removeQueries({
        queryKey: artifactKeys.detail(workspaceId, artifactId),
      });
      queryClient.removeQueries({
        queryKey: artifactKeys.attempts(workspaceId, artifactId),
      });
      queryClient.removeQueries({
        queryKey: artifactKeys.flashcards(workspaceId, artifactId),
      });
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.all,
      });
      logger.info("artifact.delete.succeeded", { workspaceId, artifactId });
    },
    onError: (error) => logFailure("delete", error),
  });
}

export function useRetryArtifact(
  workspaceId: string
): UseMutationResult<Artifact, unknown, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artifactId: string) =>
      artifactService.retryArtifact(workspaceId, artifactId),
    onSuccess: (_artifact, artifactId) => {
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.detail(workspaceId, artifactId),
      });
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.all,
      });
      logger.info("artifact.retry.succeeded", { workspaceId, artifactId });
    },
    onError: (error) => logFailure("retry", error),
  });
}

export function useQuizAttempts(
  workspaceId: string,
  artifactId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: artifactKeys.attempts(workspaceId, artifactId ?? "none"),
    queryFn: () => {
      if (!artifactId) {
        return [];
      }
      return artifactService.listQuizAttempts(workspaceId, artifactId);
    },
    enabled: enabled && Boolean(artifactId),
  });
}

type SubmitAttemptInput = {
  artifactId: string;
  answers: Array<{ questionId: string; userAnswer: string }>;
};

export function useSubmitQuizAttempt(
  workspaceId: string
): UseMutationResult<QuizAttempt, unknown, SubmitAttemptInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artifactId, answers }: SubmitAttemptInput) =>
      artifactService.submitQuizAttempt(workspaceId, artifactId, answers),
    onSuccess: (attempt, { artifactId }) => {
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.attempts(workspaceId, artifactId),
      });
      // The server reveals correct answers only after the first attempt.
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.detail(workspaceId, artifactId),
      });
      logger.info("artifact.quiz.attempt_submitted", {
        workspaceId,
        artifactId,
        attemptId: attempt.id,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
      });
    },
    onError: (error) => logFailure("quiz_attempt", error),
  });
}

export function useFlashcards(
  workspaceId: string,
  artifactId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: artifactKeys.flashcards(workspaceId, artifactId ?? "none"),
    queryFn: () => {
      if (!artifactId) {
        return [];
      }
      return artifactService.listFlashcards(workspaceId, artifactId);
    },
    enabled: enabled && Boolean(artifactId),
  });
}

export function useDueFlashcards(
  workspaceId: string,
  artifactId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: artifactKeys.dueFlashcards(workspaceId, artifactId ?? "none"),
    queryFn: () => {
      if (!artifactId) {
        return [];
      }
      return artifactService.listDueFlashcards(workspaceId, artifactId);
    },
    enabled: enabled && Boolean(artifactId),
  });
}

type ReviewInput = {
  artifactId: string;
  cardId: string;
  rating: number;
};

export function useReviewFlashcard(
  workspaceId: string
): UseMutationResult<Flashcard, unknown, ReviewInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artifactId, cardId, rating }: ReviewInput) =>
      artifactService.reviewFlashcard(workspaceId, artifactId, cardId, rating),
    onSuccess: (_card, { artifactId, cardId, rating }) => {
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.flashcards(workspaceId, artifactId),
      });
      void queryClient.invalidateQueries({
        queryKey: artifactKeys.dueFlashcards(workspaceId, artifactId),
      });
      logger.info("artifact.flashcard.reviewed", {
        workspaceId,
        artifactId,
        cardId,
        rating,
      });
    },
    onError: (error) => logFailure("flashcard_review", error),
  });
}

type ExportInput = {
  artifactId: string;
  filename: string;
  format: "apkg" | "json";
};

export function useFlashcardExport(
  workspaceId: string
): UseMutationResult<void, unknown, ExportInput> {
  return useMutation({
    mutationFn: ({ artifactId, filename, format }: ExportInput) =>
      format === "apkg"
        ? artifactService.downloadAnkiDeck(workspaceId, artifactId, filename)
        : artifactService.downloadFlashcardsJson(workspaceId, artifactId, filename),
    onSuccess: (_data, { artifactId, format }) => {
      logger.info("artifact.flashcard.exported", {
        workspaceId,
        artifactId,
        format,
      });
    },
    onError: (error) => logFailure("flashcard_export", error),
  });
}
