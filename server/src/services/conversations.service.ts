import {
  BadGatewayError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import conversationsRepository, {
  type ConversationDetail,
  type ConversationRecord,
} from "../repository/conversations.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import { createEmbeddings, generateChatAnswer } from "../lib/openai.js";
import { querySourceChunkVectors } from "../lib/pinecone.js";
import type { ConversationCitation } from "../types/conversation.js";
import type { CreateConversationInput } from "../validators/conversations.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";
const CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND";
const TOP_K = 6;

const formatSourceContext = (sources: ConversationCitation[]): string =>
  sources
    .map(
      (item) =>
        `[${item.number}] ${item.title} (${item.sourceType})\n` +
        `${item.url ? `URL: ${item.url}\n` : ""}` +
        `Excerpt:\n${item.excerpt}`
    )
    .join("\n\n");

const ensureWorkspaceAccess = async (
  userId: string,
  workspaceId: string
): Promise<void> => {
  const workspace = await workspaceRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );
  if (!workspace) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }
};

const createAnswer = async (
  workspaceId: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ answer: string; sources: ConversationCitation[] }> => {
  let queryVector: number[] | undefined;
  try {
    [queryVector] = await createEmbeddings([question]);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    console.error("OpenAI query embedding failed:", error);
    throw new BadGatewayError(
      "The assistant could not search workspace sources. Please try again.",
      "OPENAI_QUERY_EMBEDDING_FAILED"
    );
  }

  if (!queryVector) {
    throw new BadGatewayError(
      "The assistant could not search workspace sources. Please try again.",
      "OPENAI_QUERY_EMBEDDING_FAILED"
    );
  }

  const matches = await querySourceChunkVectors(
    workspaceId,
    queryVector,
    TOP_K
  );
  const chunks = await conversationsRepository.findReadyChunksByIds(
    workspaceId,
    matches.map((match) => match.id)
  );
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const sources = matches
    .flatMap((match) => {
      const chunk = chunksById.get(match.id);
      return chunk ? [{ chunk, score: match.score }] : [];
    })
    .map(({ chunk, score }, index): ConversationCitation => ({
      number: index + 1,
      sourceId: chunk.sourceId,
      title: chunk.title,
      sourceType: chunk.sourceType,
      url: chunk.url,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content,
      ...(score === undefined ? {} : { score }),
    }));

  if (sources.length === 0) {
    return {
      answer:
        "I couldn't find any indexed source excerpts in this workspace that can answer your question. Add sources and wait for indexing to finish, then try again.",
      sources: [],
    };
  }

  const answer = await generateChatAnswer(
    question,
    history.slice(-10),
    formatSourceContext(sources)
  );

  return { answer, sources };
};

const listConversations = async (
  userId: string,
  workspaceId: string
): Promise<ConversationRecord[]> => {
  await ensureWorkspaceAccess(userId, workspaceId);
  return conversationsRepository.findConversationsByWorkspaceId(workspaceId);
};

const getConversation = async (
  userId: string,
  workspaceId: string,
  conversationId: string
): Promise<ConversationDetail> => {
  await ensureWorkspaceAccess(userId, workspaceId);
  const detail = await conversationsRepository.findConversationDetail(
    workspaceId,
    conversationId
  );
  if (!detail) {
    throw new NotFoundError("Conversation not found", CONVERSATION_NOT_FOUND);
  }

  return detail;
};

const getConversationTitle = (message: string): string => {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 80
    ? `${normalized.slice(0, 77).trimEnd()}...`
    : normalized;
};

const createConversation = async (
  userId: string,
  workspaceId: string,
  input: CreateConversationInput
): Promise<ConversationDetail> => {
  await ensureWorkspaceAccess(userId, workspaceId);
  const response = await createAnswer(workspaceId, input.message, []);

  return conversationsRepository.persistExchange({
    workspaceId,
    title: getConversationTitle(input.message),
    userContent: input.message,
    assistantContent: response.answer,
    sources: response.sources,
  });
};

const sendConversationMessage = async (
  userId: string,
  workspaceId: string,
  conversationId: string,
  input: CreateConversationInput
): Promise<ConversationDetail> => {
  const currentConversation = await getConversation(
    userId,
    workspaceId,
    conversationId
  );
  const history = currentConversation.messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
  const response = await createAnswer(workspaceId, input.message, history);

  return conversationsRepository.persistExchange({
    workspaceId,
    conversationId,
    userContent: input.message,
    assistantContent: response.answer,
    sources: response.sources,
  });
};

export default {
  listConversations,
  getConversation,
  createConversation,
  sendConversationMessage,
};
