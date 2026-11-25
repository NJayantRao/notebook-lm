import type { Response } from "express";
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import logger from "../config/logger.js";
import {
  BadGatewayError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import conversationsRepository, {
  type ConversationDetail,
  type ConversationListItem,
  type RetrievedSourceChunk,
} from "../repository/conversations.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import {
  buildChatPrompt,
  CHAT_MODEL,
  generateChatAnswerFromPrompt,
  rewriteSearchQuery,
  streamChatAnswer,
} from "../lib/openai.js";
import { searchSourceChunkDocuments } from "../lib/pinecone.js";
import { searchWeb } from "../lib/tavily.js";
import { searchUserMemories } from "../lib/mem0.js";
import { inngest } from "../lib/inngest.js";
import type { ConversationCitation } from "../types/conversation.js";
import type { CreateConversationInput } from "../validators/conversations.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";
const CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND";
const RETRIEVAL_TOP_K = 20;
const ANSWER_SOURCE_COUNT = 6;
const MEMORY_REFRESH_INTERVAL = 16;
const NO_SOURCES_MESSAGE =
  "I couldn't find any indexed source excerpts in this workspace that can answer your question. Add sources and wait for indexing to finish, then try again.";
const NO_WEB_RESULTS_MESSAGE =
  "Web search did not return any results for this question.";

export type StreamCitation = {
  number: number;
  sourceId: string | null;
  title: string;
  sourceType: string;
  url: string | null;
  chunkIndex: number | null;
  excerpt: string;
  score?: number;
  page?: number;
  startSeconds?: number;
};

type StreamMetadata = {
  citations: StreamCitation[];
};

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

// Citations are useful to readers but confusing to the model when the same
// answer is later reused as conversation history.
const cleanHistory = (
  history: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] =>
  history.map((turn) =>
    turn.role === "assistant"
      ? { ...turn, content: turn.content.replace(/\[\d+\]/g, "") }
      : turn
  );

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

type AnswerContext = {
  sources: ConversationCitation[];
  chatModel: string;
  prompt?: ReturnType<typeof buildChatPrompt>;
  fixedAnswer?: string;
};

// Memory is an optional enhancement: it must never break an answer.
const loadUserMemories = async (
  userId: string,
  question: string
): Promise<string[]> => {
  try {
    return await searchUserMemories(userId, question);
  } catch (error) {
    // Optional enhancement: never break an answer when memory is unavailable.
    logger.warn("chat.memory_lookup.degraded", { userId, error });
    return [];
  }
};

const logRetrieval = (
  userId: string,
  workspaceId: string,
  questionChars: number,
  sourceCount: number,
  webSearch: boolean,
  startedAt: number
): void => {
  logger.info("chat.retrieval", {
    userId,
    workspaceId,
    questionChars,
    count: sourceCount,
    webSearch,
    durationMs: Math.round(performance.now() - startedAt),
  });
};

// All retrieval (Pinecone search and Postgres hydration)
// happens here before either chat path starts generating tokens.
const prepareAnswer = async (
  userId: string,
  workspaceId: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
  webSearch: boolean
): Promise<AnswerContext> => {
  const retrievalStartedAt = performance.now();
  const workspace = await workspaceRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );
  const chatModel = resolveChatModel(workspace?.model);
  const promptHistory = cleanHistory(history);

  if (webSearch) {
    const [response, userMemories] = await Promise.all([
      searchWeb(question),
      loadUserMemories(userId, question),
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
      logRetrieval(userId, workspaceId, question.length, 0, true, retrievalStartedAt);
      return { sources, chatModel, fixedAnswer: NO_WEB_RESULTS_MESSAGE };
    }

    const sourceContext = sources
      .map(
        (source) =>
          `[${source.number}] ${source.title}\nURL: ${source.url}\nExcerpt:\n${source.excerpt}`
      )
      .join("\n\n");

    logRetrieval(
      userId,
      workspaceId,
      question.length,
      sources.length,
      true,
      retrievalStartedAt
    );
    return {
      sources,
      chatModel,
      prompt: buildChatPrompt(
        question,
        promptHistory.slice(-10),
        sourceContext,
        "web",
        userMemories
      ),
    };
  }

  // Follow-up questions such as "what about page 3?" are poor search queries.
  // Rewrite them from recent history, falling back to the original on failure.
  const retrievalQuery = await rewriteSearchQuery(question, promptHistory);
  const matches = await searchSourceChunkDocuments(
    workspaceId,
    retrievalQuery,
    RETRIEVAL_TOP_K
  );
  type ScoredMatch = { id: string; score: number };
  const scoredMatches: ScoredMatch[] = matches.flatMap((match) =>
    match.score !== undefined
      ? [{ id: match.id, score: match.score }]
      : []
  );
  scoredMatches.sort((left, right) => right.score - left.score);

  const chunks = await conversationsRepository.findReadyChunksByIds(
    workspaceId,
    scoredMatches.map((match) => match.id)
  );
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  type RetrievedMatch = { chunk: RetrievedSourceChunk; score: number };
  const candidates: RetrievedMatch[] = scoredMatches.flatMap((match) => {
    const chunk = chunksById.get(match.id);
    return chunk ? [{ chunk, score: match.score }] : [];
  });

  // Adjacent chunks from the same source usually repeat the same answer.
  // Keep the higher-scoring chunk and drop its immediate neighbour.
  const kept: RetrievedMatch[] = [];
  for (const candidate of candidates) {
    const duplicateIndex = kept.findIndex(
      (item) =>
        item.chunk.sourceId === candidate.chunk.sourceId &&
        Math.abs(item.chunk.chunkIndex - candidate.chunk.chunkIndex) === 1
    );
    if (duplicateIndex < 0) {
      kept.push(candidate);
    } else if (candidate.score > kept[duplicateIndex]!.score) {
      kept[duplicateIndex] = candidate;
    }
  }

  const sources = kept
    .slice(0, ANSWER_SOURCE_COUNT)
    .map(({ chunk, score }, index): ConversationCitation => ({
      number: index + 1,
      sourceId: chunk.sourceId,
      title: chunk.title,
      sourceType: chunk.sourceType,
      url: chunk.url,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content,
      ...(score === undefined ? {} : { score }),
      ...(chunk.page === undefined ? {} : { page: chunk.page }),
      ...(chunk.startSeconds === undefined
        ? {}
        : { startSeconds: chunk.startSeconds }),
    }));

  if (sources.length === 0) {
    logRetrieval(userId, workspaceId, question.length, 0, false, retrievalStartedAt);
    return { sources, chatModel, fixedAnswer: NO_SOURCES_MESSAGE };
  }

  const userMemories = await loadUserMemories(userId, question);
  logRetrieval(
    userId,
    workspaceId,
    question.length,
    sources.length,
    false,
    retrievalStartedAt
  );
  return {
    sources,
    chatModel,
    prompt: buildChatPrompt(
      question,
      promptHistory.slice(-10),
      formatSourceContext(sources),
      "workspace",
      userMemories
    ),
  };
};

const createAnswer = async (
  userId: string,
  workspaceId: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
  webSearch: boolean
): Promise<{ answer: string; sources: ConversationCitation[] }> => {
  const startedAt = performance.now();
  logger.info("chat.request", {
    userId,
    workspaceId,
    historyCount: history.length,
    questionChars: question.length,
    webSearch,
  });

  const prepared = await prepareAnswer(
    userId,
    workspaceId,
    question,
    history,
    webSearch
  );

  let answer: string;
  if (prepared.prompt) {
    logger.info("chat.generate.started", {
      userId,
      workspaceId,
      model: prepared.chatModel,
      provider: "openai",
      count: prepared.prompt.messages.length,
    });
    answer = await generateChatAnswerFromPrompt(
      prepared.prompt,
      prepared.chatModel
    );
    logger.info("chat.generate.completed", {
      userId,
      workspaceId,
      model: prepared.chatModel,
      provider: "openai",
      answerChars: answer.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } else {
    answer = prepared.fixedAnswer ?? NO_SOURCES_MESSAGE;
  }

  return { answer, sources: prepared.sources };
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
    logger.warn("chat.memory.refresh.enqueue.failed", {
      userId,
      conversationId,
      userMessageCount,
      error,
    });
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

  let persisted;
  try {
    persisted = await conversationsRepository.persistExchange({
      workspaceId,
      title: getConversationTitle(input.message),
      userContent: input.message,
      assistantContent: response.answer,
      sources: response.sources,
    });
  } catch (error) {
    logger.error("chat.persist.failed", {
      userId,
      workspaceId,
      answerChars: response.answer.length,
      sourceCount: response.sources.length,
      error,
    });
    throw error;
  }

  logger.info("chat.persist.completed", {
    userId,
    workspaceId,
    conversationId: persisted.conversation.id,
    sourceCount: response.sources.length,
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

  let persisted;
  try {
    persisted = await conversationsRepository.persistExchange({
      workspaceId,
      conversationId,
      userContent: input.message,
      assistantContent: response.answer,
      sources: response.sources,
    });
  } catch (error) {
    logger.error("chat.persist.failed", {
      userId,
      workspaceId,
      conversationId,
      answerChars: response.answer.length,
      sourceCount: response.sources.length,
      error,
    });
    throw error;
  }

  logger.info("chat.persist.completed", {
    userId,
    workspaceId,
    conversationId: persisted.conversation.id,
    sourceCount: response.sources.length,
  });
  await enqueueMemoryRefresh(
    userId,
    persisted.conversation.id,
    persisted.userMessageCount
  );
  return persisted.conversation;
};

const toStreamCitations = (
  sources: ConversationCitation[]
): StreamCitation[] =>
  sources.map((item) => ({
    number: item.number,
    sourceId: "sourceId" in item ? item.sourceId : null,
    title: item.title,
    sourceType: item.sourceType,
    url: item.url ?? null,
    chunkIndex: "chunkIndex" in item ? item.chunkIndex : null,
    excerpt: item.excerpt,
    ...(item.score === undefined ? {} : { score: item.score }),
    ...("page" in item && item.page !== undefined ? { page: item.page } : {}),
    ...("startSeconds" in item && item.startSeconds !== undefined
      ? { startSeconds: item.startSeconds }
      : {}),
  }));

const streamAnswer = async (
  userId: string,
  workspaceId: string,
  conversationId: string | undefined,
  input: CreateConversationInput,
  res: Response
): Promise<void> => {
  const streamStartedAt = performance.now();
  logger.info("chat.request", {
    userId,
    workspaceId,
    ...(conversationId ? { conversationId } : {}),
    questionChars: input.message.length,
    webSearch: input.webSearch,
    stream: true,
  });

  const currentConversation = conversationId
    ? await getConversation(userId, workspaceId, conversationId)
    : undefined;
  const history = (currentConversation?.messages ?? []).map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const prepared = await prepareAnswer(
    userId,
    workspaceId,
    input.message,
    history,
    input.webSearch
  );

  const activeConversationId = conversationId ?? crypto.randomUUID();
  const citations = toStreamCitations(prepared.sources);
  const title = conversationId
    ? undefined
    : getConversationTitle(input.message);

  const stream = createUIMessageStream<UIMessage<StreamMetadata>>({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({
        type: "message-metadata",
        messageMetadata: { citations },
      });
      writer.write({
        type: "data-conversation",
        id: "conversation",
        data: { conversationId: activeConversationId },
      });

      if (!prepared.prompt) {
        const textId = "answer";
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: prepared.fixedAnswer ?? NO_SOURCES_MESSAGE,
        });
        writer.write({ type: "text-end", id: textId });
        writer.setOutcome({ status: "completed" });
        return;
      }

      logger.info("chat.generate.started", {
        userId,
        workspaceId,
        conversationId: activeConversationId,
        model: prepared.chatModel,
        provider: "openai",
        count: prepared.prompt.messages.length,
        stream: true,
      });
      const result = streamChatAnswer(prepared.prompt, prepared.chatModel);
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          onEnd: ({ outcome }) => writer.setOutcome(outcome),
        })
      );
    },
    onEnd: async ({ outcome, isAborted, isCancelled, responseMessage }) => {
      if (isAborted || isCancelled || outcome.status !== "completed") {
        logger.info("chat.stream.aborted", {
          userId,
          workspaceId,
          conversationId: activeConversationId,
          status: outcome.status,
          isAborted,
          isCancelled,
          durationMs: Math.round(performance.now() - streamStartedAt),
        });
        return;
      }

      const answer = responseMessage.parts
        .filter(
          (part): part is { type: "text"; text: string } => part.type === "text"
        )
        .map((part) => part.text)
        .join("")
        .trim();
      if (!answer) {
        logger.warn("chat.generate.empty", {
          userId,
          workspaceId,
          conversationId: activeConversationId,
          durationMs: Math.round(performance.now() - streamStartedAt),
        });
        return;
      }

      logger.info("chat.generate.completed", {
        userId,
        workspaceId,
        conversationId: activeConversationId,
        model: prepared.chatModel,
        provider: "openai",
        answerChars: answer.length,
        stream: true,
        durationMs: Math.round(performance.now() - streamStartedAt),
      });

      let persisted;
      try {
        persisted = await conversationsRepository.persistExchange({
          workspaceId,
          ...(conversationId
            ? { conversationId }
            : {
                newConversationId: activeConversationId,
                ...(title ? { title } : {}),
              }),
          userContent: input.message,
          assistantContent: answer,
          sources: prepared.sources,
        });
      } catch (error) {
        logger.error("chat.persist.failed", {
          userId,
          workspaceId,
          conversationId: activeConversationId,
          answerChars: answer.length,
          sourceCount: prepared.sources.length,
          error,
        });
        return;
      }

      logger.info("chat.persist.completed", {
        userId,
        workspaceId,
        conversationId: persisted.conversation.id,
        sourceCount: prepared.sources.length,
      });
      await enqueueMemoryRefresh(
        userId,
        persisted.conversation.id,
        persisted.userMessageCount
      );
    },
    onError: () =>
      "The assistant could not generate a response. Please try again.",
  });

  await pipeUIMessageStreamToResponse({ response: res, stream });
};

const streamNewConversation = async (
  userId: string,
  workspaceId: string,
  input: CreateConversationInput,
  res: Response
): Promise<void> => {
  await ensureWorkspaceAccess(userId, workspaceId);
  await streamAnswer(userId, workspaceId, undefined, input, res);
};

const streamConversationMessage = async (
  userId: string,
  workspaceId: string,
  conversationId: string,
  input: CreateConversationInput,
  res: Response
): Promise<void> => {
  await streamAnswer(userId, workspaceId, conversationId, input, res);
};

export default {
  listConversations,
  getConversation,
  createConversation,
  sendConversationMessage,
  streamNewConversation,
  streamConversationMessage,
};
