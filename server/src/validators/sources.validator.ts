import { z } from "zod";

import { sourceStatusEnum, sourceTypeEnum } from "../db/schema.js";
import { getYouTubeVideoId } from "../lib/youtube.js";

const workspaceId = z.string().uuid("Invalid workspace id");
const sourceId = z.string().uuid("Invalid source id");

const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid website URL")
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  }, "Website URL must use HTTP or HTTPS and must not contain credentials");

const youtubeUrl = z
  .string()
  .trim()
  .url("Enter a valid YouTube URL")
  .refine(
    (value) => getYouTubeVideoId(value) !== null,
    "Enter a valid YouTube video URL"
  );

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

export const createSourceSchema = z.discriminatedUnion("sourceType", [
  z
    .object({
      sourceType: z.enum(["text", "markdown"]),
      title: z.string().trim().min(1, "Title is required"),
      content: z.string().trim().min(1, "Content is required"),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
  z
    .object({
      sourceType: z.literal("website"),
      url: httpUrl,
      title: z.string().trim().min(1, "Title cannot be empty").optional(),
    })
    .strict(),
  z
    .object({
      sourceType: z.literal("yt_url"),
      url: youtubeUrl,
      title: z.string().trim().min(1, "Title cannot be empty").optional(),
    })
    .strict(),
]);

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
