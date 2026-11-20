import OpenAI from "openai";

import { ENV } from "../config/env.js";
import { ServiceUnavailableError } from "../utils/api-error.js";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1532;

let client: OpenAI | undefined;

const getOpenAIClient = (): OpenAI => {
  const apiKey = ENV.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "OpenAI embeddings are not configured.",
      "OPENAI_NOT_CONFIGURED"
    );
  }

  client ??= new OpenAI({ apiKey });
  return client;
};

export const createEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    input: texts,
  });

  const embeddings = response.data
    .sort((left, right) => left.index - right.index)
    .map(({ embedding }) => embedding);

  if (
    embeddings.length !== texts.length ||
    embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error("OpenAI returned embeddings with an unexpected shape.");
  }

  return embeddings;
};
