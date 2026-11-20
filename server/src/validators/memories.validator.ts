import { z } from "zod";

const memoryText = z.string().trim().min(1, "Enter memory text").max(4000);

export const memoryIdParamsSchema = z.object({
  memoryId: z.string().trim().min(1).max(255),
});

export const memoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const createMemorySchema = z
  .object({
    content: memoryText,
  })
  .strict();

export const updateMemorySchema = z
  .object({
    text: memoryText,
  })
  .strict();

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
