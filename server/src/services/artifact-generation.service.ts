import { generateText, Output } from "ai";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import logger from "../config/logger.js";
import { getModelSpec, resolveArtifactModel } from "../lib/ai-models.js";
import { BadGatewayError } from "../utils/api-error.js";
import type {
  ArtifactContent,
  ArtifactInput,
  ArtifactTier,
  ArtifactType,
} from "../types/artifact.js";
import {
  normalizeLabel,
  type ArtifactContext,
} from "./artifact-context.service.js";
import {
  countPodcastWords,
  PODCAST_MAX_WORDS,
  PODCAST_TARGET_WORDS,
  PodcastRepairError,
  PodcastTooLongError,
} from "./podcast-limits.js";
import {
  shortenPodcastScript,
  type PodcastScriptInput,
} from "./podcast-script.service.js";
import {
  flashcards,
  mindmap,
  podcast,
  quiz,
  roadmap,
  type BuildPromptArgs,
  type SourceLabels,
} from "./artifacts/index.js";

type Definition = {
  type: ArtifactType;
  schemaName: string;
  buildSchema: (validLabels: SourceLabels) => z.ZodTypeAny;
  buildPrompt: (args: BuildPromptArgs) => string;
  temperature: number;
  tier: ArtifactTier;
  maxOutputTokens: number;
  normalize: (args: {
    raw: unknown;
    input: ArtifactInput;
    context: ArtifactContext;
  }) => ArtifactContent;
};

const definitions: Record<ArtifactType, Definition> = {
  roadmap: {
    ...roadmap.roadmapDefinition,
    normalize: (args) =>
      roadmap.normalize({
        ...args,
        raw: args.raw as z.infer<ReturnType<typeof roadmap.buildSchema>>,
      }),
  },
  mindmap: {
    ...mindmap.mindMapDefinition,
    normalize: (args) =>
      mindmap.normalize({
        ...args,
        raw: args.raw as z.infer<ReturnType<typeof mindmap.buildSchema>>,
      }),
  },
  podcast: {
    ...podcast.podcastDefinition,
    normalize: (args) =>
      podcast.normalize({
        ...args,
        raw: args.raw as z.infer<ReturnType<typeof podcast.buildSchema>>,
      }),
  },
  quiz: {
    ...quiz.quizDefinition,
    normalize: (args) =>
      quiz.normalize({
        ...args,
        raw: args.raw as z.infer<ReturnType<typeof quiz.buildSchema>>,
      }),
  },
  flashcards: {
    ...flashcards.flashcardsDefinition,
    normalize: (args) =>
      flashcards.normalize({
        ...args,
        raw: args.raw as z.infer<ReturnType<typeof flashcards.buildSchema>>,
      }),
  },
};

export type GeneratedArtifact = {
  content: ArtifactContent;
  provider: string;
  model: string;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number };
};

/** A rejected response_format schema cannot be fixed by asking the model again. */
export class InvalidArtifactSchemaError extends NonRetriableError {
  readonly code = "ARTIFACT_INVALID_SCHEMA";

  constructor(schemaName: string, cause?: unknown) {
    const detail =
      cause instanceof Error ? cause.message : String(cause ?? "invalid schema");
    super(
      `The ${schemaName} output schema is invalid for the selected provider: ${detail}`,
      { cause }
    );
    this.name = "InvalidArtifactSchemaError";
  }
}

/** Deterministic output/content failures must not be retried by Inngest. */
export class InvalidArtifactContentError extends NonRetriableError {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(`${code}: ${message}`, { cause });
    this.name = "InvalidArtifactContentError";
    this.code = code;
  }
}

const causeChain = (error: unknown): string[] => {
  const messages: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; cause?: unknown };
    if (typeof record.message === "string" && record.message) {
      messages.push(record.message);
    }
    current = record.cause;
  }

  return messages;
};

const isInvalidSchemaError = (error: unknown): boolean => {
  const seen = new Set<object>();
  let current: unknown = error;

  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      statusCode?: unknown;
      status?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    const status = record.statusCode ?? record.status;
    const message = typeof record.message === "string" ? record.message : "";
    if (status === 400 && /invalid schema|response_format/iu.test(message)) {
      return true;
    }
    current = record.cause;
  }

  return false;
};

const failureCode = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return "SCHEMA_VALIDATION_FAILED";
  }
  if (error instanceof Error) {
    const explicit = (error as { code?: unknown }).code;
    if (typeof explicit === "string" && /^[A-Z][A-Z0-9_]+$/u.test(explicit)) {
      return explicit;
    }
    const match = error.message.match(/^[A-Z][A-Z0-9_]+$/u);
    if (match) {
      return match[0];
    }
  }
  return "GENERATION_FAILED";
};

export const generateArtifactContent = async (
  type: ArtifactType,
  input: ArtifactInput,
  context: ArtifactContext
): Promise<GeneratedArtifact> => {
  const definition = definitions[type];
  const spec = getModelSpec(definition.tier === "fast" ? "artifactFast" : "artifactStrong");
  const meta = {
    type,
    provider: spec.provider,
    model: spec.model,
    reasoning: spec.reasoning,
    tier: definition.tier,
    maxOutputTokens: definition.maxOutputTokens,
  };
  const schemaName = definition.schemaName;

  const labelList = [
    ...new Set(
      context.sourceIndex
        .map((entry) => normalizeLabel(entry.label))
        .filter((label): label is string => label !== null)
    ),
  ];

  if (labelList.length === 0) {
    const error = new Error("ARTIFACT_NO_VALID_SOURCE_LABELS");
    logger.error("artifact.generate.failed", {
      ...meta,
      code: "ARTIFACT_NO_VALID_SOURCE_LABELS",
      causeChain: causeChain(error),
      error,
    });
    throw new InvalidArtifactContentError(
      "ARTIFACT_NO_VALID_SOURCE_LABELS",
      "The source index has no usable labels.",
      error
    );
  }

  const validLabels: SourceLabels = [labelList[0]!, ...labelList.slice(1)];
  const schema = definition.buildSchema(validLabels);
  const basePrompt = definition.buildPrompt({ input, context, validLabels });
  const useLowReasoning =
    spec.reasoning &&
    spec.provider === "openai" &&
    (type === "podcast" || type === "mindmap");
  const providerOptions = useLowReasoning
    ? { openai: { reasoningEffort: "low" as const } }
    : undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const startedAt = performance.now();
      const generated = await generateText({
        model: resolveArtifactModel(definition.tier),
        system:
          "You produce structured study artifacts grounded strictly in supplied source excerpts. " +
          "Return only data that conforms to the requested schema.",
        prompt:
          attempt === 1
            ? basePrompt
            : `${basePrompt}\n\nFORMAT REPAIR: The previous response did not satisfy the required schema, citation, or content constraints. Return a fully corrected response. Do not include explanations outside the structured output.`,
        ...(spec.reasoning ? {} : { temperature: definition.temperature }),
        ...(providerOptions ? { providerOptions } : {}),
        maxOutputTokens: definition.maxOutputTokens,
        output: Output.object({ schema }),
      });
      const durationMs = Math.round(performance.now() - startedAt);

      if (!generated.output) {
        throw new Error("ARTIFACT_EMPTY_OUTPUT");
      }
      let raw: unknown = schema.parse(generated.output);
      let content = definition.normalize({ raw, input, context });

      if (type === "podcast") {
        const script = raw as PodcastScriptInput;
        const words = countPodcastWords(script.turns);
        logger.info("podcast.script.counted", {
          words,
          maxWords: PODCAST_MAX_WORDS,
          targetWords: PODCAST_TARGET_WORDS,
          turns: script.turns.length,
        });
        if (words > PODCAST_MAX_WORDS) {
          const shortened = await shortenPodcastScript({
            script,
            context,
            targetWords: PODCAST_TARGET_WORDS,
            maxWords: PODCAST_MAX_WORDS,
            reason: `initial script had ${words} words (limit ${PODCAST_MAX_WORDS})`,
          });
          raw = shortened.raw;
          content = shortened.content;
          logger.warn("podcast.script.repaired", {
            fromWords: words,
            toWords: shortened.words,
            targetWords: PODCAST_TARGET_WORDS,
          });
        }
      }

      const usage = generated.usage as
        | {
            inputTokens?: number;
            outputTokens?: number;
            outputTokenDetails?: { reasoningTokens?: number };
          }
        | undefined;

      logger.info("artifact.generate.completed", {
        ...meta,
        attempt,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? 0,
        durationMs,
      });

      return {
        content,
        provider: spec.provider,
        model: spec.model,
        attempts: attempt,
        usage: {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? 0,
        },
      };
    } catch (error) {
      const code = failureCode(error);
      const chain = causeChain(error);

      if (error instanceof PodcastTooLongError || error instanceof PodcastRepairError) {
        logger.error("artifact.generate.failed", {
          ...meta,
          attempt,
          code: error.code,
          causeChain: chain,
          error,
        });
        throw error;
      }

      if (isInvalidSchemaError(error)) {
        logger.error("artifact.generate.invalid_schema", {
          ...meta,
          schemaName,
          code,
          causeChain: chain,
          error,
        });
        throw new InvalidArtifactSchemaError(schemaName, error);
      }

      if (error instanceof z.ZodError && attempt === 1) {
        logger.warn("artifact.generate.repair", {
          ...meta,
          attempt,
          code,
          causeChain: chain,
          error,
        });
        continue;
      }

      if (code !== "GENERATION_FAILED") {
        logger.error("artifact.generate.failed", {
          ...meta,
          attempt,
          code,
          causeChain: chain,
          error,
        });
        throw new InvalidArtifactContentError(
          code,
          error instanceof Error ? error.message : String(error),
          error
        );
      }

      logger.error("artifact.generate.failed", {
        ...meta,
        attempt,
        code,
        causeChain: chain,
        error,
      });
      throw new BadGatewayError(
        "The artifact could not be generated from the selected sources.",
        "ARTIFACT_GENERATION_FAILED"
      );
    }
  }

  throw new BadGatewayError(
    "The artifact could not be generated from the selected sources.",
    "ARTIFACT_GENERATION_FAILED"
  );
};

export { gradeQuizAttempt } from "./artifacts/quiz.artifact.js";
