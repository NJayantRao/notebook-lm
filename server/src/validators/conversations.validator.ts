import { z } from "zod";

const messageText = z.string().trim().min(1, "Enter a message").max(4000);

export const conversationParamsSchema = z
  .object({
    workspaceId: z.string().uuid("Invalid workspace id"),
    conversationId: z.string().uuid("Invalid conversation id"),
  })
  .strict();

export const workspaceConversationsParamsSchema = z
  .object({
    workspaceId: z.string().uuid("Invalid workspace id"),
  })
  .strict();

export const createConversationSchema = z
  .object({
    message: messageText,
    webSearch: z.boolean().default(false),
  })
  .strict();

export const sendConversationMessageSchema = createConversationSchema;

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendConversationMessageInput = z.infer<
  typeof sendConversationMessageSchema
>;
