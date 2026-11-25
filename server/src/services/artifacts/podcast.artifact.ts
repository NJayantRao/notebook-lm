import { z } from "zod";

import { resolveCitation } from "../artifact-context.service.js";
import {
  PODCAST_MAX_WORDS,
  PODCAST_TARGET_WORDS,
} from "../podcast-limits.js";
import type { ArtifactContent, PodcastTurn } from "../../types/artifact.js";
import {
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
      turns: z
        .array(
          z
            .object({
              speaker: z.enum(["Alex", "Sam"]),
              text: z.string().trim().min(20),
              startSec: z.number().nonnegative(),
              sourceRef: z.enum(validLabels).nullable(),
            })
            .strict()
        )
        .min(8)
        .max(12),
    })
    .strict();

export type PodcastRaw = z.infer<ReturnType<typeof buildSchema>>;

export const buildPrompt = ({
  input,
  context,
  validLabels,
}: BuildPromptArgs): string =>
  `Write a two-host study podcast script from the source context below.\n` +
  `Host Alex is curious and introduces topics; Host Sam is analytical and explains details. Use exactly the speaker names Alex and Sam.\n` +
  `Budget: about ${PODCAST_TARGET_WORDS} words in total across all turns, never more than ${PODCAST_MAX_WORDS}; this is a spoken episode of about 4 to 5 minutes.\n` +
  `Use 8 to 12 turns of 1 to 3 short sentences each. Cover only the 2 to 4 most important ideas. No filler or repeated points. Start with a 1-sentence hook and end with a 1-sentence recap. Output spoken words only: no stage directions, no speaker labels inside the text, no headings, no markdown.\n` +
  `Every turn needs one sourceRef from the valid labels and an estimated startSec in seconds.\n` +
  `${SHARED_ARTIFACT_RULES}\n` +
  `Valid labels: ${validLabels.join(", ")}\n` +
  `Optional focus: ${input.params.focus?.trim() || "none"}\n\n` +
  `SOURCE CONTEXT:\n${context.text}`;

export const temperature = 0.7;
export const tier = "strong" as const;
export const maxOutputTokens = 14_000;

export const normalize = ({
  raw,
  context,
}: NormalizeArgs<PodcastRaw>): ArtifactContent => {
  const turns: PodcastTurn[] = raw.turns.flatMap((turn) => {
    const citation = resolveCitation(
      { sourceRef: turn.sourceRef },
      context.sourceIndex,
      context.text
    );
    if (!citation) {
      return [];
    }

    return [
      {
        speaker: turn.speaker,
        text: turn.text.trim(),
        startSec: Math.floor(turn.startSec),
        citationLabels: [citation.label],
      },
    ];
  });

  logDroppedCitations("podcast", raw.turns.length - turns.length, raw.turns.length);

  return {
    kind: "podcast",
    title: raw.title.trim(),
    turns,
  };
};

export const podcastDefinition = {
  type: "podcast",
  schemaName: "podcastSchema",
  buildSchema,
  buildPrompt,
  temperature,
  tier,
  maxOutputTokens,
  normalize,
} satisfies ArtifactDefinition<ReturnType<typeof buildSchema>>;
