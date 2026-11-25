import { z } from "zod";

import { ARTIFACT_STATUSES, ARTIFACT_TYPES } from "../types/artifact.js";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace id"),
});

export const artifactParamsSchema = workspaceIdParamsSchema.extend({
  artifactId: z.string().uuid("Invalid artifact id"),
});

export const createArtifactSchema = z
  .object({
    type: z.enum(ARTIFACT_TYPES),
    sourceIds: z.array(z.string().uuid("Invalid source id")).min(1).max(50),
    focus: z.string().trim().max(2000).optional(),
    cardCount: z.number().int().min(5).max(15).optional(),
    questionCount: z.number().int().min(5).max(10).optional(),
  })
  .strict();

export const listArtifactsQuerySchema = z
  .object({
    type: z.enum(ARTIFACT_TYPES).optional(),
    status: z.enum(ARTIFACT_STATUSES).optional(),
  })
  .strict();

export const quizAttemptSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().trim().min(1).max(200),
            userAnswer: z.string().trim().max(4000),
          })
          .strict()
      )
      .min(1)
      .max(10),
  })
  .strict();

export const flashcardReviewSchema = z
  .object({
    cardId: z.string().uuid("Invalid flashcard id"),
    rating: z.number().int().min(0).max(5),
  })
  .strict();

export const flashcardExportQuerySchema = z
  .object({
    format: z.enum(["apkg", "json"]).default("apkg"),
  })
  .strict();

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;
export type ListArtifactsQuery = z.infer<typeof listArtifactsQuerySchema>;
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;
export type FlashcardReviewInput = z.infer<typeof flashcardReviewSchema>;
export type FlashcardExportQuery = z.infer<typeof flashcardExportQuerySchema>;
