import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import db from "../db/index.js";
import {
  artifact,
  flashcard,
  quizAttempt,
  workspace,
} from "../db/schema.js";
import type {
  ArtifactAudioMeta,
  ArtifactCitation,
  ArtifactContent,
  ArtifactInput,
  ArtifactSourceIndexEntry,
  ArtifactStatus,
  ArtifactType,
  FlashcardDraft,
  QuizAttemptAnswer,
} from "../types/artifact.js";

type ArtifactRecord = typeof artifact.$inferSelect;

export type ArtifactUpdate = Partial<{
  status: ArtifactStatus;
  title: string;
  content: ArtifactContent;
  sourceIndex: ArtifactSourceIndexEntry[];
  sourceHash: string;
  paramsHash: string;
  audioKey: string | null;
  audioMeta: ArtifactAudioMeta | null;
  durationSec: number | null;
  errorMessage: string | null;
}>;

export type CreateArtifactData = {
  id?: string;
  workspaceId: string;
  type: ArtifactType;
  title: string;
  input: ArtifactInput;
  sourceHash: string;
  paramsHash: string;
};

const findArtifactById = async (
  artifactId: string
): Promise<ArtifactRecord | undefined> => {
  const [result] = await db
    .select()
    .from(artifact)
    .where(eq(artifact.id, artifactId))
    .limit(1);

  return result;
};

const findArtifactByWorkspaceAndId = async (
  workspaceId: string,
  artifactId: string
): Promise<ArtifactRecord | undefined> => {
  const [result] = await db
    .select()
    .from(artifact)
    .where(
      and(eq(artifact.workspaceId, workspaceId), eq(artifact.id, artifactId))
    )
    .limit(1);

  return result;
};

const findArtifactsByWorkspaceId = async (
  workspaceId: string
): Promise<ArtifactRecord[]> =>
  db
    .select()
    .from(artifact)
    .where(eq(artifact.workspaceId, workspaceId))
    .orderBy(desc(artifact.createdAt));

const createArtifact = async (
  data: CreateArtifactData
): Promise<ArtifactRecord> => {
  const [result] = await db
    .insert(artifact)
    .values({
      ...(data.id ? { id: data.id } : {}),
      workspaceId: data.workspaceId,
      type: data.type,
      status: "pending",
      title: data.title,
      input: data.input,
      sourceHash: data.sourceHash,
      paramsHash: data.paramsHash,
    })
    .returning();

  if (!result) {
    throw new Error("Failed to create artifact");
  }

  return result;
};

const updateArtifact = async (
  artifactId: string,
  data: ArtifactUpdate
): Promise<ArtifactRecord | undefined> => {
  const [result] = await db
    .update(artifact)
    .set(data)
    .where(eq(artifact.id, artifactId))
    .returning();

  return result;
};

const deleteArtifact = async (artifactId: string): Promise<ArtifactRecord | undefined> => {
  const [result] = await db
    .delete(artifact)
    .where(eq(artifact.id, artifactId))
    .returning();

  return result;
};

/** Counts artifacts created by a user since a point in time, for daily quotas. */
const countRecentByUser = async (
  userId: string,
  since: Date
): Promise<{ total: number; podcasts: number }> => {
  const [result] = await db
    .select({
      total: count(),
      podcasts: sql<number>`count(*) filter (where ${artifact.type} = 'podcast')`,
    })
    .from(artifact)
    .innerJoin(workspace, eq(artifact.workspaceId, workspace.id))
    .where(and(eq(workspace.userId, userId), gte(artifact.createdAt, since)));

  return {
    total: result?.total ?? 0,
    podcasts: Number(result?.podcasts ?? 0),
  };
};

type FlashcardRecord = typeof flashcard.$inferSelect;
type QuizAttemptRecord = typeof quizAttempt.$inferSelect;

export type FlashcardReviewUpdate = Pick<
  FlashcardRecord,
  "easeFactor" | "interval" | "repetitions" | "nextReviewAt" | "lastReviewedAt"
>;

export type CreateQuizAttemptData = {
  artifactId: string;
  workspaceId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  answers: QuizAttemptAnswer[];
};

export const replaceFlashcards = async (
  artifactId: string,
  workspaceId: string,
  cards: FlashcardDraft[]
): Promise<FlashcardRecord[]> =>
  db.transaction(async (tx) => {
    await tx.delete(flashcard).where(eq(flashcard.artifactId, artifactId));
    if (cards.length === 0) {
      return [];
    }
    return tx
      .insert(flashcard)
      .values(
        cards.map((card) => ({
          artifactId,
          workspaceId,
          front: card.front,
          back: card.back,
          citation: card.citation as ArtifactCitation,
        }))
      )
      .returning();
  });

const findFlashcardsByArtifactId = async (
  artifactId: string
): Promise<FlashcardRecord[]> =>
  db
    .select()
    .from(flashcard)
    .where(eq(flashcard.artifactId, artifactId))
    .orderBy(asc(flashcard.createdAt), asc(flashcard.id));

const findDueFlashcardsByArtifactId = async (
  artifactId: string,
  now: Date,
  limit: number
): Promise<FlashcardRecord[]> =>
  db
    .select()
    .from(flashcard)
    .where(
      and(eq(flashcard.artifactId, artifactId), lte(flashcard.nextReviewAt, now))
    )
    .orderBy(asc(flashcard.nextReviewAt), asc(flashcard.id))
    .limit(limit);

const findFlashcardByWorkspaceAndId = async (
  workspaceId: string,
  cardId: string
): Promise<FlashcardRecord | undefined> => {
  const [result] = await db
    .select()
    .from(flashcard)
    .where(
      and(eq(flashcard.workspaceId, workspaceId), eq(flashcard.id, cardId))
    )
    .limit(1);

  return result;
};

const updateFlashcardReview = async (
  cardId: string,
  update: FlashcardReviewUpdate
): Promise<FlashcardRecord | undefined> => {
  const [result] = await db
    .update(flashcard)
    .set(update)
    .where(eq(flashcard.id, cardId))
    .returning();

  return result;
};

const createQuizAttempt = async (
  data: CreateQuizAttemptData
): Promise<QuizAttemptRecord> => {
  const [result] = await db
    .insert(quizAttempt)
    .values(data)
    .returning();

  if (!result) {
    throw new Error("Failed to save quiz attempt");
  }
  return result;
};

const findQuizAttemptsByArtifact = async (
  artifactId: string,
  userId: string,
  limit: number
): Promise<QuizAttemptRecord[]> =>
  db
    .select()
    .from(quizAttempt)
    .where(
      and(eq(quizAttempt.artifactId, artifactId), eq(quizAttempt.userId, userId))
    )
    .orderBy(desc(quizAttempt.createdAt))
    .limit(limit);

const hasQuizAttempt = async (
  artifactId: string,
  userId: string
): Promise<boolean> => {
  const [result] = await db
    .select({ id: quizAttempt.id })
    .from(quizAttempt)
    .where(
      and(eq(quizAttempt.artifactId, artifactId), eq(quizAttempt.userId, userId))
    )
    .limit(1);

  return Boolean(result);
};

export type ArtifactRecordType = ArtifactRecord;
export type FlashcardRecordType = FlashcardRecord;
export type QuizAttemptRecordType = QuizAttemptRecord;

export default {
  findArtifactById,
  findArtifactByWorkspaceAndId,
  findArtifactsByWorkspaceId,
  createArtifact,
  updateArtifact,
  deleteArtifact,
  countRecentByUser,
  replaceFlashcards,
  findFlashcardsByArtifactId,
  findDueFlashcardsByArtifactId,
  findFlashcardByWorkspaceAndId,
  updateFlashcardReview,
  createQuizAttempt,
  findQuizAttemptsByArtifact,
  hasQuizAttempt,
};
