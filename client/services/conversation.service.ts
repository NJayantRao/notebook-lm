import { api, type ApiEnvelope } from "@/lib/api";
import type { Conversation } from "@/lib/types";

const conversationsUrl = (workspaceId: string) =>
  `/api/workspace/${workspaceId}/conversations`;

export async function listConversations(
  workspaceId: string
): Promise<Conversation[]> {
  const res = await api.get<ApiEnvelope<Conversation[]>>(
    conversationsUrl(workspaceId)
  );
  return res.data.data ?? [];
}

export async function getConversation(
  workspaceId: string,
  conversationId: string
): Promise<Conversation> {
  const res = await api.get<ApiEnvelope<Conversation>>(
    `${conversationsUrl(workspaceId)}/${conversationId}`
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Conversation not found");
  }
  return res.data.data;
}

export async function createConversation(
  workspaceId: string,
  message: string,
  webSearch: boolean
): Promise<Conversation> {
  const res = await api.post<ApiEnvelope<Conversation>>(
    conversationsUrl(workspaceId),
    { message, webSearch }
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to create conversation");
  }
  return res.data.data;
}

export async function sendConversationMessage(
  workspaceId: string,
  conversationId: string,
  message: string,
  webSearch: boolean
): Promise<Conversation> {
  const res = await api.post<ApiEnvelope<Conversation>>(
    `${conversationsUrl(workspaceId)}/${conversationId}/messages`,
    { message, webSearch }
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to send message");
  }
  return res.data.data;
}
