import { NonRetriableError } from "inngest";
import { z } from "zod";

import logger from "../config/logger.js";
import { inngest } from "../lib/inngest.js";
import artifactsRepository from "../repository/artifacts.repository.js";
import { buildArtifactContext } from "../services/artifact-context.service.js";
import { generateArtifactContent } from "../services/artifact-generation.service.js";
import {
  finalizePodcastAudio,
  generatePodcastPart,
  planPodcastSegments,
  type PodcastPartResult,
} from "../services/podcast-audio.service.js";
import { ARTIFACT_TYPES, type ArtifactInput } from "../types/artifact.js";
import ApiError, { BadRequestError } from "../utils/api-error.js";

const artifactEventSchema = z.object({
  artifactId: z.string().uuid("Invalid artifact id"),
});

const artifactInputSchema = z
  .object({
    type: z.enum(ARTIFACT_TYPES),
    params: z
      .object({
        sourceIds: z.array(z.string().min(1)).min(1).max(50),
        focus: z.string().max(2000).optional(),
        cardCount: z.number().int().min(5).max(15).optional(),
        questionCount: z.number().int().min(5).max(10).optional(),
      })
      .strict(),
  })
  .strict();

const NON_RETRIABLE_CONTEXT_CODES = new Set([
  "ARTIFACT_INVALID_PARAMS",
  "ARTIFACT_NO_READY_SOURCES",
  "ARTIFACT_SOURCES_UNAVAILABLE",
  "ARTIFACT_NO_INDEXED_CONTENT",
  "ARTIFACT_CONTEXT_TOO_LARGE",
  "ARTIFACT_NOT_FOUND",
]);

const FAILURE_MESSAGES: Record<string, string> = {
  ARTIFACT_INVALID_PARAMS: "This artifact request is invalid. Check the selected sources and options.",
  ARTIFACT_NO_READY_SOURCES: "Add and index at least one source before generating an artifact.",
  ARTIFACT_SOURCES_UNAVAILABLE: "One or more selected sources are missing or not ready.",
  ARTIFACT_NO_INDEXED_CONTENT: "The selected sources do not have indexed content yet.",
  ARTIFACT_CONTEXT_TOO_LARGE: "The selected sources are too large to generate an artifact.",
  ARTIFACT_SUMMARY_FAILED: "The source material could not be prepared for generation.",
  ARTIFACT_SUMMARY_EMPTY: "The source material could not be prepared for generation.",
  ARTIFACT_GENERATION_FAILED: "The artifact could not be generated. Please try again.",
  ARTIFACT_EMPTY_OUTPUT: "The artifact could not be generated. Please try again.",
  ARTIFACT_INVALID_SCHEMA:
    "The artifact output schema is incompatible with the selected model. Please contact support.",
  ARTIFACT_NO_VALID_SOURCE_LABELS:
    "The selected sources do not have usable citation labels.",
  SCHEMA_VALIDATION_FAILED:
    "The artifact output did not match the required format.",
  PODCAST_TTS_FAILED: "The podcast audio could not be generated. Please check TTS quota and try again.",
  PODCAST_PARTS_INCOMPLETE: "The podcast audio could not be assembled. Please try again.",
  PODCAST_PART_INVALID: "The podcast audio could not be assembled. Please try again.",
  PODCAST_SEGMENT_MISSING: "The podcast audio could not be assembled. Please try again.",
  ARTIFACT_AUDIO_UPLOAD_FAILED: "The generated audio could not be stored. Please try again.",
  ARTIFACT_AUDIO_DELETE_FAILED: "Temporary audio files could not be cleaned up. Please try again.",
  GOOGLE_NOT_CONFIGURED: "Text-to-speech is not configured on this server.",
  OPENAI_NOT_CONFIGURED: "The artifact model is not configured on this server.",
  ANTHROPIC_NOT_CONFIGURED: "The artifact model is not configured on this server.",
};

const DEFAULT_FAILURE_MESSAGE =
  "Artifact generation failed. Please review the selected sources and try again.";

const requireArtifactId = (data: unknown): string => {
  const parsed = artifactEventSchema.safeParse(data);
  if (!parsed.success) {
    throw new NonRetriableError("The artifact generation event is invalid.");
  }
  return parsed.data.artifactId;
};

const parseArtifactInput = (value: unknown): ArtifactInput => {
  const parsed = artifactInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new NonRetriableError("The stored artifact parameters are invalid.");
  }
  const { type, params } = parsed.data;
  return {
    type,
    params: {
      sourceIds: params.sourceIds,
      ...(params.focus === undefined ? {} : { focus: params.focus }),
      ...(params.cardCount === undefined ? {} : { cardCount: params.cardCount }),
      ...(params.questionCount === undefined
        ? {}
        : { questionCount: params.questionCount }),
    },
  };
};

const errorCode = (error: unknown): string | undefined => {
  if (error instanceof ApiError) {
    return error.code;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

const mapFailure = (error: unknown): { code: string; message: string } => {
  if (error instanceof NonRetriableError) {
    const code = errorCode(error);
    if (code && FAILURE_MESSAGES[code]) {
      return { code, message: FAILURE_MESSAGES[code]! };
    }
    return {
      code: "ARTIFACT_INVALID_PARAMS",
      message: FAILURE_MESSAGES.ARTIFACT_INVALID_PARAMS!,
    };
  }

  const code = errorCode(error) ?? "ARTIFACT_GENERATION_FAILED";
  return {
    code,
    message: FAILURE_MESSAGES[code] ?? DEFAULT_FAILURE_MESSAGE,
  };
};

const asNonRetriableIfNeeded = (error: unknown): unknown => {
  const code = errorCode(error);
  if (error instanceof BadRequestError && code && NON_RETRIABLE_CONTEXT_CODES.has(code)) {
    return new NonRetriableError(FAILURE_MESSAGES[code] ?? DEFAULT_FAILURE_MESSAGE);
  }
  return error;
};

export const generateArtifactFunction = inngest.createFunction(
  {
    id: "generate-artifact",
    retries: 2,
    singleton: {
      key: "event.data.artifactId",
      mode: "skip",
    },
    triggers: [{ event: "artifact/generate.requested" }],
    onFailure: async ({ event, error }) => {
      let artifactId = "unknown";
      try {
        artifactId = requireArtifactId(event.data.event.data);
        const { code, message } = mapFailure(error);
        await artifactsRepository.updateArtifact(artifactId, {
          status: "failed",
          errorMessage: `${code}: ${message}`,
          content: { kind: "empty" },
          audioKey: null,
          audioMeta: null,
          durationSec: null,
        });
        logger.error("artifact.generate.failed", { artifactId, code, error });
      } catch (persistError) {
        logger.error("artifact.generate.failure_persist_failed", {
          artifactId,
          error: persistError,
        });
      }
    },
  },
  async ({ event, step, attempt, runId }) => {
    const startedAt = performance.now();
    const artifactId = requireArtifactId(event.data);

    const loaded = await step.run("load-artifact", async () => {
      const record = await artifactsRepository.findArtifactById(artifactId);
      if (!record) {
        throw new NonRetriableError("The artifact no longer exists.");
      }
      parseArtifactInput(record.input);
      return {
        artifactId,
        workspaceId: record.workspaceId,
        type: record.type,
        status: record.status,
      };
    });

    if (loaded.status === "ready") {
      return { artifactId, status: "skipped", reason: "already_ready" };
    }

    const jobMeta = {
      artifactId,
      workspaceId: loaded.workspaceId,
      type: loaded.type,
      attempt,
      runId,
    };

    const marked = await step.run("mark-generating", async () => {
      logger.info("artifact.generate.started", jobMeta);
      return artifactsRepository.updateArtifact(artifactId, {
        status: "generating",
        errorMessage: null,
        content: { kind: "empty" },
        audioKey: null,
        audioMeta: null,
        durationSec: null,
      });
    });
    if (!marked) {
      return { artifactId, status: "skipped", reason: "deleted" };
    }

    const context = await step.run("build-context", async () => {
      const record = await artifactsRepository.findArtifactById(artifactId);
      if (!record) {
        throw new NonRetriableError("The artifact no longer exists.");
      }
      try {
        return await buildArtifactContext(
          record.workspaceId,
          parseArtifactInput(record.input)
        );
      } catch (error) {
        throw asNonRetriableIfNeeded(error);
      }
    });

    const generated = await step.run("generate-and-save", async () => {
      const record = await artifactsRepository.findArtifactById(artifactId);
      if (!record) {
        throw new NonRetriableError("The artifact no longer exists.");
      }
      const input = parseArtifactInput(record.input);
      const result = await generateArtifactContent(loaded.type, input, context);
      const title = result.content.kind === "empty" ? record.title : result.content.title;
      const updated = await artifactsRepository.updateArtifact(artifactId, {
        status: "generating",
        title,
        content: result.content,
        sourceIndex: context.sourceIndex,
        sourceHash: context.sourceHash,
        paramsHash: context.paramsHash,
      });
      if (!updated) {
        throw new NonRetriableError("The artifact no longer exists.");
      }
      if (result.content.kind === "flashcards") {
        await artifactsRepository.replaceFlashcards(
          artifactId,
          record.workspaceId,
          result.content.cards
        );
      }

      logger.info("artifact.generate.saved", {
        ...jobMeta,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: result.attempts,
      });

      return {
        title,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: result.attempts,
        segmentCount:
          result.content.kind === "podcast"
            ? planPodcastSegments(result.content.turns).length
            : 0,
      };
    });

    if (loaded.type === "podcast") {
      const parts: PodcastPartResult[] = [];
      for (let partIndex = 0; partIndex < generated.segmentCount; partIndex += 1) {
        const part = await step.run(`podcast-tts-part-${partIndex}`, () =>
          generatePodcastPart(loaded.workspaceId, artifactId, partIndex)
        );
        parts.push(part);
      }

      await step.run("finalize-podcast-audio", async () => {
        const finalized = await finalizePodcastAudio(
          loaded.workspaceId,
          artifactId,
          parts
        );
        const record = await artifactsRepository.findArtifactById(artifactId);
        if (!record || record.content.kind !== "podcast") {
          throw new NonRetriableError("The podcast artifact is unavailable.");
        }
        await artifactsRepository.updateArtifact(artifactId, {
          content: {
            kind: "podcast",
            title: record.content.title,
            turns: finalized.turns,
          },
          audioKey: finalized.audioKey,
          audioMeta: finalized.audioMeta,
          durationSec: finalized.durationSec,
        });
        return {
          mimeType: finalized.audioMeta.mimeType,
          size: finalized.audioMeta.size,
          durationSec: finalized.durationSec,
          turnCount: finalized.turns.length,
          partCount: parts.length,
        };
      });
    }

    await step.run("mark-ready", async () => {
      const updated = await artifactsRepository.updateArtifact(artifactId, {
        status: "ready",
        errorMessage: null,
      });
      if (!updated) {
        throw new NonRetriableError("The artifact no longer exists.");
      }
      logger.info("artifact.generate.ready", {
        ...jobMeta,
        provider: generated.provider,
        model: generated.model,
        totalDurationMs: Math.round(performance.now() - startedAt),
      });
      return { artifactId, status: "ready" };
    });

    return {
      artifactId,
      status: "ready",
      type: loaded.type,
      provider: generated.provider,
      model: generated.model,
    };
  }
);
