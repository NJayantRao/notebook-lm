import { z } from "zod";

import { resolveCitation } from "../artifact-context.service.js";
import type {
  ArtifactContent,
  MindMapEdge,
  MindMapNode,
} from "../../types/artifact.js";
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

const edgeType = z.enum([
  "prerequisite",
  "related_to",
  "part_of",
  "example_of",
  "contrasts_with",
]);

export const buildSchema = (validLabels: SourceLabels) =>
  z
    .object({
      title: z.string().trim().min(1),
      nodes: z
        .array(
          z
            .object({
              id: z.string().trim().min(1),
              label: z.string().trim().min(1),
              summary: z.string().trim().min(1).max(200),
              description: z.string().trim().min(1),
              keyPoints: z.array(z.string().trim().min(1)).min(3).max(5),
              whyItMatters: z.string().trim().min(1),
              difficulty: z.enum(["intro", "intermediate", "advanced"]),
              example: z.string().trim().min(1).nullable(),
              relatedQuestions: z
                .array(z.string().trim().min(1))
                .min(2)
                .max(3),
              citation: z.object(citationShape(validLabels)),
            })
            .strict()
        )
        .min(8)
        .max(20),
      edges: z
        .array(
          z
            .object({
              id: z.string().trim().min(1),
              source: z.string().trim().min(1),
              target: z.string().trim().min(1),
              label: z.string().trim().min(1),
              type: edgeType,
            })
            .strict()
        )
        .min(6)
        .max(40),
    })
    .strict();

export type MindMapRaw = z.infer<ReturnType<typeof buildSchema>>;

export const buildPrompt = ({
  input,
  context,
  validLabels,
}: BuildPromptArgs): string =>
  `Build a connected knowledge graph from the source context below.\n` +
  `Extract 8 to 15 key concepts (never more than 20) and 10 to 20 meaningful relationships.\n` +
  `Every node needs teaching-card fields and exactly one sourceRef from the valid labels. Use edge types prerequisite, related_to, part_of, example_of, or contrasts_with.\n` +
  `${SHARED_ARTIFACT_RULES}\n` +
  `Valid labels: ${validLabels.join(", ")}\n` +
  `Optional focus: ${input.params.focus?.trim() || "none"}\n\n` +
  `SOURCE CONTEXT:\n${context.text}`;

export const temperature = 0.3;
export const tier = "strong" as const;
export const maxOutputTokens = 9_000;

export const normalize = ({
  raw,
  context,
}: NormalizeArgs<MindMapRaw>): ArtifactContent => {
  const seenIds = new Set<string>();
  const nodes: MindMapNode[] = raw.nodes.flatMap((node) => {
    const citation = resolveCitation(
      {
        sourceRef: node.citation.sourceRef,
        page: node.citation.page,
        startSeconds: node.citation.startSeconds,
      },
      context.sourceIndex,
      context.text
    );
    if (!citation) {
      return [];
    }

    const id = normalizeId(node.id, `node-${seenIds.size + 1}`);
    if (seenIds.has(id)) {
      throw new Error("MINDMAP_DUPLICATE_NODE_ID");
    }
    seenIds.add(id);

    return [
      {
        id,
        label: node.label.trim(),
        summary: node.summary.trim().slice(0, 200),
        description: node.description.trim(),
        keyPoints: node.keyPoints.slice(0, 5).map((point) => point.trim()),
        whyItMatters: node.whyItMatters.trim(),
        difficulty: node.difficulty,
        ...(node.example === null ? {} : { example: node.example.trim() }),
        relatedQuestions: node.relatedQuestions
          .slice(0, 3)
          .map((question) => question.trim()),
        citation,
      },
    ];
  });

  logDroppedCitations("mindmap", raw.nodes.length - nodes.length, raw.nodes.length);

  const validIds = new Set(nodes.map((node) => node.id));
  const seenEdges = new Set<string>();
  const edges: MindMapEdge[] = [];
  for (const edge of raw.edges) {
    const source = normalizeId(edge.source, "");
    const target = normalizeId(edge.target, "");
    if (!validIds.has(source) || !validIds.has(target) || source === target) {
      continue;
    }
    const key = `${source}->${target}`;
    if (seenEdges.has(key)) {
      continue;
    }
    seenEdges.add(key);
    edges.push({
      id: normalizeId(edge.id, `edge-${edges.length + 1}`),
      source,
      target,
      label: edge.label.trim(),
      type: edge.type,
    });
  }

  if (edges.length === 0) {
    throw new Error("MINDMAP_NO_VALID_EDGES");
  }

  return {
    kind: "mindmap",
    title: raw.title.trim(),
    nodes,
    edges,
  };
};

export const mindMapDefinition = {
  type: "mindmap",
  schemaName: "mindMapSchema",
  buildSchema,
  buildPrompt,
  temperature,
  tier,
  maxOutputTokens,
  normalize,
} satisfies ArtifactDefinition<ReturnType<typeof buildSchema>>;
