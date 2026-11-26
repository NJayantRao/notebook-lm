import { ENV } from "../config/env.js";
import logger, { markLogged } from "../config/logger.js";
import { inngest } from "../lib/inngest.js";
import { deleteArtifactPrefix, getSignedArtifactUrl } from "../lib/s3.js";
import artifactsRepository from "../repository/artifacts.repository.js";
import workspacesRepository from "../repository/workspaces.repository.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../utils/api-error.js";
import type {
  ArtifactContent,
  ArtifactInput,
  ArtifactType,
  PublicArtifactContent,
  QuizAnswerInput,
} from "../types/artifact.js";
import type {
  CreateArtifactInput,
  ListArtifactsQuery,
} from "../validators/artifacts.validator.js";
import { buildAnkiPackage } from "./anki-export.service.js";
import {
  computeSourceFingerprint,
  hashArtifactInput,
} from "./artifact-context.service.js";
import { gradeQuizAttempt } from "./artifact-generation.service.js";

const TYPE_TITLES: Record<ArtifactType, string> = {
  roadmap: "Study roadmap",
  mindmap: "Knowledge map",
  podcast: "Study podcast",
  quiz: "Knowledge quiz",
  flashcards: "Study flashcards",
};

const requireWorkspace = async (userId: string, workspaceId: string) => {
  const workspace = await workspacesRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );
  if (!workspace) {
    throw new NotFoundError("Workspace not found", "WORKSPACE_NOT_FOUND");
  }
  return workspace;
};

const requireArtifact = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  await requireWorkspace(userId, workspaceId);
  const record = await artifactsRepository.findArtifactByWorkspaceAndId(
    workspaceId,
    artifactId
  );
  if (!record) {
    throw new NotFoundError("Artifact not found", "ARTIFACT_NOT_FOUND");
  }
  return record;
};

const publicContent = (
  content: ArtifactContent,
  revealAnswers: boolean
): PublicArtifactContent => {
  if (content.kind !== "quiz" || revealAnswers) {
    return content;
  }
  return {
    kind: "quiz",
    title: content.title,
    questions: content.questions.map((question) => ({
      id: question.id,
      type: question.type,
      questionText: question.questionText,
      options: question.options,
      citations: question.citations,
    })),
  };
};

const toView = async (
  record: Awaited<
    ReturnType<typeof artifactsRepository.findArtifactByWorkspaceAndId>
  >,
  userId: string
) => {
  if (!record) {
    throw new NotFoundError("Artifact not found", "ARTIFACT_NOT_FOUND");
  }

  const fingerprint = await computeSourceFingerprint(
    record.workspaceId,
    record.input.params.sourceIds
  );
  const revealAnswers =
    record.content.kind === "quiz" &&
    (await artifactsRepository.hasQuizAttempt(record.id, userId));
  const audioUrl = record.audioKey
    ? await getSignedArtifactUrl(
        record.audioKey,
        ENV.AUDIO_URL_TTL_SECONDS,
        record.audioMeta?.mimeType ?? "audio/mpeg"
      )
    : null;

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    type: record.type,
    status: record.status,
    title: record.title,
    input: record.input,
    content: publicContent(record.content, revealAnswers),
    sourceIndex: record.sourceIndex,
    isStale: fingerprint === null || fingerprint !== record.sourceHash,
    audioUrl,
    audioMeta: record.audioMeta,
    durationSec: record.durationSec,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const checkDailyQuota = async (userId: string, type: ArtifactType) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const usage = await artifactsRepository.countRecentByUser(userId, since);

  if (usage.total >= ENV.ARTIFACTS_PER_DAY) {
    throw new TooManyRequestsError(
      `The daily limit of ${ENV.ARTIFACTS_PER_DAY} artifacts has been reached.`,
      "ARTIFACT_DAILY_QUOTA_EXCEEDED"
    );
  }
  if (type === "podcast" && usage.podcasts >= ENV.PODCASTS_PER_DAY) {
    throw new TooManyRequestsError(
      `The daily limit of ${ENV.PODCASTS_PER_DAY} podcasts has been reached.`,
      "PODCAST_DAILY_QUOTA_EXCEEDED"
    );
  }
};

const enqueueGeneration = async (
  artifactId: string,
  workspaceId: string,
  type: ArtifactType
) => {
  try {
    await inngest.send({
      name: "artifact/generate.requested",
      data: { artifactId },
    });
  } catch (error) {
    logger.error("artifact.enqueue.failed", {
      artifactId,
      workspaceId,
      type,
      error,
    });
    await artifactsRepository.updateArtifact(artifactId, {
      status: "failed",
      errorMessage:
        "The artifact was saved but generation could not be scheduled. Please retry.",
      content: { kind: "empty" },
    });
    const apiError = new ServiceUnavailableError(
      "The artifact was saved but generation could not be scheduled. Please retry.",
      "ARTIFACT_GENERATION_QUEUE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

const createArtifact = async (
  userId: string,
  workspaceId: string,
  input: CreateArtifactInput
) => {
  await requireWorkspace(userId, workspaceId);
  await checkDailyQuota(userId, input.type);

  const sourceHash = await computeSourceFingerprint(workspaceId, input.sourceIds);
  if (!sourceHash) {
    throw new BadRequestError(
      "Select at least one ready source with indexed content.",
      "ARTIFACT_SOURCES_UNAVAILABLE"
    );
  }

  const artifactInput: ArtifactInput = {
    type: input.type,
    params: {
      sourceIds: input.sourceIds,
      ...(input.focus === undefined ? {} : { focus: input.focus }),
      ...(input.cardCount === undefined ? {} : { cardCount: input.cardCount }),
      ...(input.questionCount === undefined
        ? {}
        : { questionCount: input.questionCount }),
    },
  };

  const record = await artifactsRepository.createArtifact({
    workspaceId,
    type: input.type,
    title: TYPE_TITLES[input.type],
    input: artifactInput,
    sourceHash,
    paramsHash: hashArtifactInput(artifactInput),
  });

  logger.info("artifact.created", {
    userId,
    workspaceId,
    artifactId: record.id,
    type: input.type,
    sourceCount: input.sourceIds.length,
  });
  await enqueueGeneration(record.id, workspaceId, record.type);
  return toView(record, userId);
};

const listArtifacts = async (
  userId: string,
  workspaceId: string,
  filters: ListArtifactsQuery
) => {
  await requireWorkspace(userId, workspaceId);
  const records = await artifactsRepository.findArtifactsByWorkspaceId(workspaceId);
  const matching = records.filter(
    (record) =>
      (!filters.type || record.type === filters.type) &&
      (!filters.status || record.status === filters.status)
  );
  return Promise.all(matching.map((record) => toView(record, userId)));
};

const getArtifact = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  return toView(record, userId);
};

const getPodcastAudioDownloadUrl = async (
  userId: string,
  workspaceId: string,
  artifactId: string
): Promise<string> => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  if (record.type !== "podcast" || !record.audioKey) {
    throw new NotFoundError(
      "Podcast audio is not available.",
      "PODCAST_AUDIO_NOT_FOUND"
    );
  }

  const extension =
    record.audioMeta?.mimeType === "audio/wav" ? "wav" : "mp3";
  const safeTitle =
    record.title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^a-zA-Z0-9_-]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 100) || "podcast";
  const filename = `${safeTitle}.${extension}`;
  const disposition = `attachment; filename="${filename}"`;

  return getSignedArtifactUrl(
    record.audioKey,
    ENV.AUDIO_URL_TTL_SECONDS,
    record.audioMeta?.mimeType ?? "audio/mpeg",
    disposition
  );
};

const deleteArtifact = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  await requireArtifact(userId, workspaceId, artifactId);
  const deletedCount = await deleteArtifactPrefix(workspaceId, artifactId);
  await artifactsRepository.deleteArtifact(artifactId);

  logger.info("artifact.deleted", {
    userId,
    workspaceId,
    artifactId,
    deletedObjectCount: deletedCount,
  });
  return { artifactId, deletedObjectCount: deletedCount };
};

const retryArtifact = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  if (record.status !== "failed") {
    throw new ConflictError(
      "Only failed artifacts can be retried.",
      "ARTIFACT_RETRY_NOT_ALLOWED"
    );
  }

  await artifactsRepository.updateArtifact(artifactId, {
    status: "pending",
    errorMessage: null,
    content: { kind: "empty" },
    audioKey: null,
    audioMeta: null,
    durationSec: null,
  });
  await enqueueGeneration(artifactId, workspaceId, record.type);
  logger.info("artifact.retry.requested", {
    userId,
    workspaceId,
    artifactId,
    type: record.type,
  });
  return getArtifact(userId, workspaceId, artifactId);
};

const submitQuizAttempt = async (
  userId: string,
  workspaceId: string,
  artifactId: string,
  answers: QuizAnswerInput[]
) => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  if (record.type !== "quiz" || record.content.kind !== "quiz") {
    throw new BadRequestError(
      "This artifact is not a quiz.",
      "ARTIFACT_NOT_QUIZ"
    );
  }
  if (record.status !== "ready") {
    throw new BadRequestError(
      "The quiz is not ready yet.",
      "ARTIFACT_NOT_READY"
    );
  }

  const graded = await gradeQuizAttempt(record.content.questions, answers);
  const score = graded.filter((answer) => answer.isCorrect).length;
  const attempt = await artifactsRepository.createQuizAttempt({
    artifactId,
    workspaceId,
    userId,
    score,
    totalQuestions: record.content.questions.length,
    answers: graded,
  });

  logger.info("artifact.quiz.attempt_saved", {
    userId,
    workspaceId,
    artifactId,
    attemptId: attempt.id,
    score,
    totalQuestions: attempt.totalQuestions,
  });

  return {
    id: attempt.id,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    answers: attempt.answers,
    createdAt: attempt.createdAt,
  };
};

const listQuizAttempts = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  if (record.type !== "quiz") {
    throw new BadRequestError(
      "This artifact is not a quiz.",
      "ARTIFACT_NOT_QUIZ"
    );
  }
  const attempts = await artifactsRepository.findQuizAttemptsByArtifact(
    artifactId,
    userId,
    20
  );

  return attempts.map((attempt) => ({
    id: attempt.id,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    answers: attempt.answers,
    createdAt: attempt.createdAt,
  }));
};

const requireFlashcardsArtifact = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  const record = await requireArtifact(userId, workspaceId, artifactId);
  if (record.type !== "flashcards" || record.content.kind !== "flashcards") {
    throw new BadRequestError(
      "This artifact is not a flashcard deck.",
      "ARTIFACT_NOT_FLASHCARDS"
    );
  }
  return record;
};

const listFlashcards = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  await requireFlashcardsArtifact(userId, workspaceId, artifactId);
  return artifactsRepository.findFlashcardsByArtifactId(artifactId);
};

const getDueFlashcards = async (
  userId: string,
  workspaceId: string,
  artifactId: string
) => {
  await requireFlashcardsArtifact(userId, workspaceId, artifactId);
  return artifactsRepository.findDueFlashcardsByArtifactId(
    artifactId,
    new Date(),
    50
  );
};

/** Standard SM-2 scheduling with Anki-style 0-5 answer qualities. */
export const applySm2Review = (
  card: {
    easeFactor: number;
    interval: number;
    repetitions: number;
  },
  rating: number
): {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date;
} => {
  let repetitions = card.repetitions;
  let interval = card.interval;
  let easeFactor = card.easeFactor;

  if (rating < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }
    repetitions += 1;
  }

  const qualityDelta = 5 - rating;
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - qualityDelta * (0.08 + qualityDelta * 0.02))
  );

  const now = new Date();
  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    lastReviewedAt: now,
    nextReviewAt: new Date(now.getTime() + interval * 24 * 60 * 60 * 1000),
  };
};

const reviewFlashcard = async (
  userId: string,
  workspaceId: string,
  artifactId: string,
  cardId: string,
  rating: number
) => {
  await requireFlashcardsArtifact(userId, workspaceId, artifactId);
  const card = await artifactsRepository.findFlashcardByWorkspaceAndId(
    workspaceId,
    cardId
  );
  if (!card || card.artifactId !== artifactId) {
    throw new NotFoundError("Flashcard not found", "FLASHCARD_NOT_FOUND");
  }

  const updated = await artifactsRepository.updateFlashcardReview(
    cardId,
    applySm2Review(card, rating)
  );
  if (!updated) {
    throw new NotFoundError("Flashcard not found", "FLASHCARD_NOT_FOUND");
  }

  logger.info("artifact.flashcard.review_saved", {
    userId,
    workspaceId,
    artifactId,
    cardId,
    rating,
  });

  return {
    id: updated.id,
    easeFactor: updated.easeFactor,
    interval: updated.interval,
    repetitions: updated.repetitions,
    nextReviewAt: updated.nextReviewAt,
    lastReviewedAt: updated.lastReviewedAt,
  };
};

const exportFlashcards = async (
  userId: string,
  workspaceId: string,
  artifactId: string,
  format: "apkg" | "json"
) => {
  const record = await requireFlashcardsArtifact(userId, workspaceId, artifactId);
  const cards = await artifactsRepository.findFlashcardsByArtifactId(artifactId);
  const deckName = `NotebookLM - ${record.title}`;

  if (format === "json") {
    return {
      kind: "json" as const,
      deckName,
      cards,
    };
  }

  const buffer = await buildAnkiPackage(
    deckName,
    cards.map((card) => ({
      id: card.id,
      front: card.front,
      back: card.back,
      citation: card.citation,
    }))
  );
  return {
    kind: "binary" as const,
    contentType: "application/apkg",
    filename: `${record.title.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") || "flashcards"}.apkg`,
    buffer,
  };
};

export default {
  createArtifact,
  listArtifacts,
  getArtifact,
  getPodcastAudioDownloadUrl,
  deleteArtifact,
  retryArtifact,
  submitQuizAttempt,
  listQuizAttempts,
  listFlashcards,
  getDueFlashcards,
  reviewFlashcard,
  exportFlashcards,
};
