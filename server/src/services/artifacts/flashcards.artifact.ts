import { z } from "zod";

import { resolveCitation } from "../artifact-context.service.js";
import type { ArtifactContent, FlashcardDraft } from "../../types/artifact.js";
import {
  citationShape,
  logDroppedCitations,
  SHARED_ARTIFACT_RULES,
  type ArtifactDefinition,
  type BuildPromptArgs,
  type NormalizeArgs,
  type SourceLabels,
} from "./types.js";

export const buildSchema = (validLabels: SourceLabels) =>
  z
    .object({
      title: z.string().trim().min(1),
      cards: z
        .array(
          z
            .object({
              front: z.string().trim().min(1),
              back: z.string().trim().min(1),
              citation: z.object(citationShape(validLabels)),
            })
            .strict()
        )
        .min(5)
        .max(15),
    })
    .strict();

export type FlashcardsRaw = z.infer<ReturnType<typeof buildSchema>>;

export const buildPrompt = ({
  input,
  context,
  validLabels,
}: BuildPromptArgs): string =>
  `Extract memorable study flashcards from the source context below.\n` +
  `Return 5 to 15 cards. Fronts should be a term, question, or prompt; backs should be concise, punchy answers grounded in the sources. Each card needs one sourceRef from the valid labels.\n` +
  `${SHARED_ARTIFACT_RULES}\n` +
  `Valid labels: ${validLabels.join(", ")}\n` +
  `Optional focus: ${input.params.focus?.trim() || "none"}\n` +
  `Requested card count: ${input.params.cardCount ?? "5-15"}\n\n` +
  `SOURCE CONTEXT:\n${context.text}`;

export const temperature = 0.5;
export const tier = "fast" as const;
export const maxOutputTokens = 6_000;

export const normalize = ({
  raw,
  context,
}: NormalizeArgs<FlashcardsRaw>): ArtifactContent => {
  const cards: FlashcardDraft[] = raw.cards.flatMap((card) => {
    const citation = resolveCitation(
      {
        sourceRef: card.citation.sourceRef,
        page: card.citation.page,
        startSeconds: card.citation.startSeconds,
      },
      context.sourceIndex,
      context.text
    );
    if (!citation) {
      return [];
    }
    return [
      {
        front: card.front.trim(),
        back: card.back.trim(),
        citation,
      },
    ];
  });

  logDroppedCitations("flashcards", raw.cards.length - cards.length, raw.cards.length);

  return {
    kind: "flashcards",
    title: raw.title.trim(),
    cards,
  };
};

export const flashcardsDefinition = {
  type: "flashcards",
  schemaName: "flashcardsSchema",
  buildSchema,
  buildPrompt,
  temperature,
  tier,
  maxOutputTokens,
  normalize,
} satisfies ArtifactDefinition<ReturnType<typeof buildSchema>>;
