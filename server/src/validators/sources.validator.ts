import { z } from "zod";

import { sourceStatusEnum, sourceTypeEnum } from "../db/schema.js";

const workspaceId = z.string().uuid("Invalid workspace id");
const sourceId = z.string().uuid("Invalid source id");

const supportedSourceTypes = ["text", "markdown"] as const;

export const workspaceIdParamsSchema = z.object({
  workspaceId,
});

export const sourceIdParamsSchema = z.object({
  sourceId,
});

export const sourceParamsSchema = z.object({
  workspaceId,
  sourceId,
});

export const createSourceSchema = z
  .object({
    sourceType: z.enum(
      supportedSourceTypes,
      "Only text and markdown sources are supported",
    ),
    title: z.string().trim().min(1, "Title is required"),
    content: z.string().trim().min(1, "Content is required"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const listSourcesQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    sourceType: z.enum(sourceTypeEnum.enumValues).optional(),
    status: z.enum(sourceStatusEnum.enumValues).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
