import { z } from "zod";

import { resolveCitation } from "../artifact-context.service.js";
import type { ArtifactContent, RoadmapStep } from "../../types/artifact.js";
import {
  citationShape,
  logDroppedCitations,
  normalizeId,
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
      description: z.string().trim().min(1),
      steps: z
        .array(
          z.object({
            id: z.string().trim().min(1),
            title: z.string().trim().min(1),
            description: z.string().trim().min(1),
            reason: z.string().trim().min(1),
            citation: z.object(citationShape(validLabels)),
          })
        )
        .min(4)
        .max(6),
    })
    .strict();

export type RoadmapRaw = z.infer<ReturnType<typeof buildSchema>>;

export const buildPrompt = ({
  input,
  context,
  validLabels,
}: BuildPromptArgs): string =>
  `Create a personalized study roadmap from the source context below.\n` +
  `Return exactly 4 to 6 steps in a clear learning progression. Each step needs one sourceRef from the valid labels, plus the exact page or timestamp when available.\n` +
  `${SHARED_ARTIFACT_RULES}\n` +
  `Valid labels: ${validLabels.join(", ")}\n` +
  `Optional focus: ${input.params.focus?.trim() || "none"}\n\n` +
  `SOURCE CONTEXT:\n${context.text}`;

export const temperature = 0.3;
export const tier = "fast" as const;
export const maxOutputTokens = 4_000;

export const normalize = ({
  raw,
  context,
}: NormalizeArgs<RoadmapRaw>): ArtifactContent => {
  const seen = new Set<string>();
  let kept = 0;
  const steps: RoadmapStep[] = raw.steps.flatMap((step) => {
    const citation = resolveCitation(
      {
        sourceRef: step.citation.sourceRef,
        page: step.citation.page,
        startSeconds: step.citation.startSeconds,
      },
      context.sourceIndex,
      context.text
    );
    if (!citation) {
      return [];
    }

    const id = normalizeId(step.id, `step-${kept + 1}`);
    if (seen.has(id)) {
      throw new Error("ROADMAP_DUPLICATE_STEP_ID");
    }
    seen.add(id);
    kept += 1;

    return [
      {
        id,
        order: kept,
        title: step.title.trim(),
        description: step.description.trim(),
        reason: step.reason.trim(),
        citation,
      },
    ];
  });

  logDroppedCitations("roadmap", raw.steps.length - steps.length, raw.steps.length);

  return {
    kind: "roadmap",
    title: raw.title.trim(),
    description: raw.description.trim(),
    steps,
  };
};

export const roadmapDefinition = {
  type: "roadmap",
  schemaName: "roadmapSchema",
  buildSchema,
  buildPrompt,
  temperature,
  tier,
  maxOutputTokens,
  normalize,
} satisfies ArtifactDefinition<ReturnType<typeof buildSchema>>;
