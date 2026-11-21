import {
  BadGatewayError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import conversationsRepository, {
  type ConversationDetail,
  type ConversationListItem,
} from "../repository/conversations.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import {
  CHAT_MODEL,
  createEmbeddings,
  generateChatAnswer,
} from "../lib/openai.js";
import { querySourceChunkVectors } from "../lib/pinecone.js";
import { searchWeb } from "../lib/tavily.js";
import { searchUserMemories } from "../lib/mem0.js";
import { inngest } from "../lib/inngest.js";
import type { ConversationCitation } from "../types/conversation.js";
import type { CreateConversationInput } from "../validators/conversations.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";
const CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND";
const TOP_K = 6;
const MEMORY_REFRESH_INTERVAL = 16;

// Only these workspace model values may reach the chat API. The legacy value is
// kept so existing workspaces keep working without a database migration.
const ALLOWED_CHAT_MODELS: Record<string, string> = {
  "gpt-4o-mini": CHAT_MODEL,
  "openai-4o-mini": CHAT_MODEL,
};

const resolveChatModel = (model: string | undefined): string =>
  (model && ALLOWED_CHAT_MODELS[model]) || CHAT_MODEL;

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
  userId: string,
  workspaceId: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
  webSearch: boolean
): Promise<{ answer: string; sources: ConversationCitation[] }> => {
  const workspace = await workspaceRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );
  const chatModel = resolveChatModel(workspace?.model);

  if (webSearch) {
    const [response, userMemories] = await Promise.all([
      searchWeb(question),
      searchUserMemories(userId, question),
    ]);
    const sources: ConversationCitation[] = response.results.map(
      (result, index) => ({
        number: index + 1,
        title: result.title,
        sourceType: "web",
        url: result.url,
        excerpt: result.content,
        score: result.score,
      })
    );

    if (sources.length === 0) {
      return {
        answer: "Web search did not return any results for this question.",
        sources: [],
      };
    }

    const sourceContext = sources
      .map(
        (source) =>
          `[${source.number}] ${source.title}\nURL: ${source.url}\nExcerpt:\n${source.excerpt}`
      )
      .join("\n\n");
    const answer = await generateChatAnswer(
      question,
      history.slice(-10),
      sourceContext,
      "web",
      userMemories,
      chatModel
    );

    return { answer, sources };
  }

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
    formatSourceContext(sources),
    "workspace",
    await searchUserMemories(userId, question),
    chatModel
  );

  return { answer, sources };
};

const enqueueMemoryRefresh = async (
  userId: string,
  conversationId: string,
  userMessageCount: number
): Promise<void> => {
  if (userMessageCount % MEMORY_REFRESH_INTERVAL !== 0) {
    return;
  }

  try {
    await inngest.send({
      name: "conversation/memory.refresh.requested",
      data: {
        userId,
        conversationId,
        throughUserMessageCount: userMessageCount,
      },
    });
  } catch (error) {
    console.error(
      `Could not queue memory refresh for conversation ${conversationId}:`,
      error
    );
    throw new ServiceUnavailableError(
      "Your message was saved, but its memory update could not be queued.",
      "MEMORY_REFRESH_QUEUE_FAILED"
    );
  }
};

const listConversations = async (
  userId: string,
  workspaceId: string
): Promise<ConversationListItem[]> => {
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
  const response = await createAnswer(
    userId,
    workspaceId,
    input.message,
    [],
    input.webSearch
  );

  const persisted = await conversationsRepository.persistExchange({
    workspaceId,
    title: getConversationTitle(input.message),
    userContent: input.message,
    assistantContent: response.answer,
    sources: response.sources,
  });
  await enqueueMemoryRefresh(
    userId,
    persisted.conversation.id,
    persisted.userMessageCount
  );
  return persisted.conversation;
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
  const response = await createAnswer(
    userId,
    workspaceId,
    input.message,
    history,
    input.webSearch
  );

  const persisted = await conversationsRepository.persistExchange({
    workspaceId,
    conversationId,
    userContent: input.message,
    assistantContent: response.answer,
    sources: response.sources,
  });
  await enqueueMemoryRefresh(
    userId,
    persisted.conversation.id,
    persisted.userMessageCount
  );
  return persisted.conversation;
};

export default {
  listConversations,
  getConversation,
  createConversation,
  sendConversationMessage,
};
