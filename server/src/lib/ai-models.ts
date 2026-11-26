import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { ENV } from "../config/env.js";
import { ServiceUnavailableError } from "../utils/api-error.js";

export type ModelProvider = "openai" | "google";
export type ModelTask = "chat" | "artifactFast" | "artifactStrong";
export type ModelSpec = {
  provider: ModelProvider;
  model: string;
  reasoning: boolean;
};

// Defaults are current model IDs confirmed in the provider catalogs:
// https://platform.openai.com/docs/models (GPT-6 Luna / GPT-6.2 Sol)
// https://platform.claude.com/docs/en/models/overview (Claude Sonnet 5.5)
// https://ai.google.dev/gemini-api/docs/models (Gemini 3.8 Flash)
export const DEFAULT_MODEL_SPECS: Record<ModelTask, ModelSpec> = {
  chat: { provider: "openai", model: "gpt-6-luna", reasoning: true },
  artifactFast: { provider: "openai", model: "gpt-6-luna", reasoning: true },
  artifactStrong: { provider: "openai", model: "gpt-6-luna", reasoning: true },
};

const TASK_ENV: Record<ModelTask, keyof typeof ENV | undefined> = {
  chat: "CHAT_MODEL",
  artifactFast: "ARTIFACT_MODEL_FAST",
  artifactStrong: "ARTIFACT_MODEL_STRONG",
};

const PROVIDER_KEY: Record<ModelProvider, string | undefined> = {
  openai: ENV.OPENAI_API_KEY,
  google: ENV.GOOGLE_GENERATIVE_AI_API_KEY,
};

const PROVIDER_ERROR: Record<ModelProvider, { message: string; code: string }> = {
  openai: {
    message: "OpenAI is not configured.",
    code: "OPENAI_NOT_CONFIGURED",
  },
  google: {
    message: "Google Generative AI is not configured.",
    code: "GOOGLE_NOT_CONFIGURED",
  },
};

const PROVIDERS: ModelProvider[] = ["openai", "google"];

/**
 * Verified against @ai-sdk/openai docs/03-openai.mdx, "Request Capabilities":
 * GPT-5 (except gpt-5-chat-latest), GPT-5.x, GPT-6.x, o1/o3/o4 and Codex
 * models are reasoning models; GPT-4.x are not. The SDK exposes the matching
 * request option as `providerOptions.openai.reasoningEffort`.
 */
const isReasoningModel = (provider: ModelProvider, model: string): boolean => {
  const id = model.trim().toLowerCase();
  if (provider !== "openai") {
    return /thinking|reasoning/iu.test(id);
  }
  if (id === "gpt-5-chat-latest") {
    return false;
  }
  return (
    /^o[134](?:[-.]|$)/iu.test(id) ||
    /^gpt-[56](?:\.\d+)?(?:[-.]|$)/iu.test(id) ||
    /thinking/iu.test(id)
  );
};

const parseSpec = (value: string, task: ModelTask): ModelSpec => {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    throw new ServiceUnavailableError(
      `${task} model must use "provider:model" format.`,
      `${task.toUpperCase()}_MODEL_INVALID`
    );
  }

  const provider = value.slice(0, separator).trim().toLowerCase();
  const model = value.slice(separator + 1).trim();
  if (!PROVIDERS.includes(provider as ModelProvider) || !model) {
    throw new ServiceUnavailableError(
      `${task} model uses an unsupported provider or empty model id.`,
      `${task.toUpperCase()}_MODEL_INVALID`
    );
  }

  const resolvedProvider = provider as ModelProvider;
  return {
    provider: resolvedProvider,
    model,
    reasoning: isReasoningModel(resolvedProvider, model),
  };
};

export const getModelSpec = (task: ModelTask): ModelSpec => {
  const envKey = TASK_ENV[task];
  const raw = (envKey ? (ENV[envKey] as string | undefined) : undefined)?.trim();
  if (!raw) {
    const fallback = DEFAULT_MODEL_SPECS[task];
    return {
      ...fallback,
      reasoning: isReasoningModel(fallback.provider, fallback.model),
    };
  }
  return parseSpec(raw, task);
};

/** Resolves a model only when the feature is actually used. */
export const resolveModel = (task: ModelTask): LanguageModel => {
  const { provider, model } = getModelSpec(task);
  const apiKey = PROVIDER_KEY[provider]?.trim();
  if (!apiKey) {
    const error = PROVIDER_ERROR[provider];
    throw new ServiceUnavailableError(error.message, error.code);
  }

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
};

export const resolveArtifactModel = (
  tier: "fast" | "strong"
): LanguageModel => resolveModel(tier === "fast" ? "artifactFast" : "artifactStrong");
