"use client";

import {
  useEffect,
  startTransition,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  Copy,
  Globe,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Send,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { AddMemoryDialog } from "@/components/workspace/add-memory-dialog";
import { AddSourceDialog } from "@/components/workspace/add-source-dialog";
import { CitationChip } from "@/components/workspace/citation-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import { prepareCitationMarkdown, stripCitationMarkers } from "@/lib/citations";
import { logger } from "@/lib/logger";
import type { ConversationMessage, StreamCitation } from "@/lib/types";
import { getConversation } from "@/services/conversation.service";
import { listAllWorkspaceSources } from "@/services/source.service";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const retryNotFound = (failureCount: number, error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 404
    ? failureCount < 3
    : false;

const retryNotFoundDelay = () => 500;

type ChatMetadata = {
  citations?: StreamCitation[];
};

type ChatDataParts = {
  conversation: { conversationId: string };
};

type ChatUIMessage = UIMessage<ChatMetadata, ChatDataParts>;

const toUIMessages = (messages: ConversationMessage[]): ChatUIMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    metadata: {
      citations: (message.sources ?? []) as StreamCitation[],
    },
    createdAt: new Date(message.createdAt),
    parts: [{ type: "text", text: message.content }],
  }));

const getText = (message: ChatUIMessage): string =>
  message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("");

const getCitations = (message: ChatUIMessage): StreamCitation[] =>
  message.metadata?.citations ?? [];

type StreamingChatProps = {
  workspaceId: string;
  conversationId: string | null;
  chatId: string;
  initialMessages: ChatUIMessage[];
  onFinishMessage: (conversationId: string | null) => void;
  hasReadySources: boolean;
  sourceError: string | null;
  onAddSource: () => void;
  onAddMemory: () => void;
};

function StreamingChatContent({
  workspaceId,
  conversationId,
  chatId,
  initialMessages,
  onFinishMessage,
  hasReadySources,
  sourceError,
  onAddSource,
  onAddMemory,
}: StreamingChatProps) {
  const { textInput } = usePromptInputController();
  const draft = textInput.value;
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const finishedConversationId = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `${API_URL}/api/chat`,
        credentials: "include",
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const text = last ? getText(last) : "";
          return {
            api: conversationId
              ? `${API_URL}/api/workspace/${workspaceId}/conversations/${conversationId}/messages/stream`
              : `${API_URL}/api/workspace/${workspaceId}/conversations/stream`,
            body: { message: text, webSearch: webSearchEnabled },
          };
        },
      }),
    [workspaceId, conversationId, webSearchEnabled]
  );

  const { messages, sendMessage, stop, status, error } = useChat<ChatUIMessage>(
    {
      id: chatId,
      messages: initialMessages,
      transport,
      onData: (part) => {
        if (part.type === "data-conversation") {
          finishedConversationId.current = (
            part.data as { conversationId: string }
          ).conversationId;
        }
      },
      onFinish: ({ isAbort, isError }) => {
        logger.info("chat.stream.finished", {
          status: isAbort ? "aborted" : isError ? "failed" : "completed",
        });
        onFinishMessage(
          !isAbort && !isError ? finishedConversationId.current : null
        );
      },
    }
  );

  // Errors from event handlers/async code are not caught by React error
  // boundaries, so report them here without exposing message text.
  useEffect(() => {
    if (!error) return;
    logger.error("chat.stream.failed", {
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }, [error]);

  const streaming = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];

  const sendPrompt = (prompt: string) => {
    if (streaming) return;
    finishedConversationId.current = null;
    textInput.clear();
    void sendMessage({ text: prompt });
  };

  const submitMessage = ({ text }: { text: string }) => {
    const message = text.trim();
    if (!message || streaming) return;
    finishedConversationId.current = null;
    void sendMessage({ text: message });
  };

  const copyMessage = async (
    messageId: string,
    text: string,
    citations: StreamCitation[]
  ) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(
        stripCitationMarkers(text, citations)
      );
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setCopyError("Could not copy this message.");
    }
  };

  const downloadableMessages = useMemo<UIMessage[]>(
    () =>
      messages.map((message) => ({
        ...message,
        parts: message.parts.map((part) =>
          part.type === "text" && message.role === "assistant"
            ? {
                ...part,
                text: stripCitationMarkers(part.text, getCitations(message)),
              }
            : part
        ),
      })),
    [messages]
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-7">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="min-h-full gap-7 px-0 py-8">
          {messages.length === 0 && (
            <ConversationEmptyState className="min-h-[min(52dvh,34rem)] gap-0 p-4">
              <MessageSquareText className="mb-4 size-6 text-primary" />
              <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
                What would you like to understand?
              </h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                Ask a question about this workspace. Answers are grounded in
                your sources and include citations.
              </p>
              {sourceError ? (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <p role="alert" className="text-sm text-destructive">
                    {sourceError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onAddSource}
                    className="rounded-full"
                  >
                    Add source
                  </Button>
                </div>
              ) : hasReadySources ? (
                <div className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
                  {[
                    "Summarize my sources",
                    "List the key takeaways",
                    "Explain the hardest concept",
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      className="h-auto rounded-full px-3 py-2 text-sm"
                      onClick={() => sendPrompt(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                  <Link
                    href={`/dashboard/workspaces/${workspaceId}/artifacts`}
                    className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Create a quiz
                  </Link>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={onAddSource}
                  className="mt-7 rounded-full px-5"
                >
                  <Plus className="size-4" />
                  Add your first source
                </Button>
              )}
            </ConversationEmptyState>
          )}

          {messages.map((message) => {
            const text = getText(message);
            const rawCitations = getCitations(message);
            const citedNumbers = new Set<number>();
            const textParts = message.parts.map((part, index) => {
              if (part.type !== "text") return null;
              if (message.role === "user") {
                return (
                  <p
                    key={`${message.id}-${index}`}
                    className="whitespace-pre-wrap text-sm leading-7"
                  >
                    {part.text}
                  </p>
                );
              }
              const prepared = prepareCitationMarkdown(
                part.text,
                rawCitations,
                streaming && lastMessage?.id === message.id
              );
              prepared.citedNumbers.forEach((number) =>
                citedNumbers.add(number)
              );
              const citations = rawCitations.filter((citation) =>
                prepared.citedNumbers.has(citation.number)
              );
              return (
                <MessageResponse
                  key={`${message.id}-${index}`}
                  isAnimating={streaming && lastMessage?.id === message.id}
                  className="text-base leading-7"
                  components={{
                    a: ({ children, href, title }) => {
                      const citationMatch =
                        typeof href === "string"
                          ? href.match(/^#cite-(\d+)$/)
                          : null;
                      if (citationMatch) {
                        const citationNumber = Number(citationMatch[1]);
                        const citation = citations.find(
                          (item) => item.number === citationNumber
                        );
                        if (citation) {
                          return (
                            <CitationChip
                              citation={citation}
                              workspaceId={workspaceId}
                            />
                          );
                        }
                        return <>{children}</>;
                      }
                      return (
                        <a
                          href={href}
                          title={title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-words text-foreground underline underline-offset-2"
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {prepared.markdown}
                </MessageResponse>
              );
            });
            const citations = rawCitations.filter((citation) =>
              citedNumbers.has(citation.number)
            );

            return (
              <Message
                key={message.id}
                from={message.role}
                className="mb-0 max-w-full"
              >
                <MessageContent
                  className={
                    message.role === "user"
                      ? "max-w-[88%] rounded-2xl bg-muted/80 text-sm leading-7"
                      : "w-full max-w-full overflow-visible bg-transparent px-0 py-0 text-base leading-7"
                  }
                >
                  {textParts}
                </MessageContent>
                {message.role === "assistant" && citations.length > 0 && (
                  <details className="mt-2 border-t border-border pt-3">
                    <summary className="w-fit cursor-pointer list-none text-xs text-muted-foreground marker:hidden hover:text-foreground">
                      Sources ({citations.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {citations.map((citation) => (
                        <CitationChip
                          key={`${message.id}-${citation.number}`}
                          anchorId={`${message.id}-${citation.number}`}
                          citation={citation}
                          workspaceId={workspaceId}
                        />
                      ))}
                    </div>
                  </details>
                )}
                <div className="flex justify-end opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy message"
                    title="Copy message"
                    onClick={() =>
                      void copyMessage(
                        message.id,
                        text,
                        message.role === "assistant" ? rawCitations : []
                      )
                    }
                    className="text-muted-foreground"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </Message>
            );
          })}
          {streaming && (
            <div
              className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {webSearchEnabled
                ? "Searching the web and generating an answer..."
                : "Searching workspace sources and generating an answer..."}
            </div>
          )}
        </ConversationContent>
        {messages.length > 0 && (
          <ConversationDownload
            messages={downloadableMessages}
            className="right-0 top-2 size-8"
            aria-label="Download conversation"
            title="Download conversation"
          />
        )}
        <ConversationScrollButton className="bottom-2" />
      </Conversation>

      {error && (
        <p role="alert" className="mb-1 mt-2 text-sm text-destructive">
          {getErrorMessage(error)}
        </p>
      )}
      <PromptInput
        onSubmit={submitMessage}
        className="sticky bottom-0 z-10 shrink-0 rounded-2xl border border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors focus-within:border-ring/50"
      >
        <PromptInputTextarea
          placeholder="Ask anything about your sources..."
          aria-label="Your question"
          rows={1}
          maxLength={4000}
          disabled={streaming}
          className="min-h-9 max-h-48 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base focus-visible:ring-0"
        />
        <PromptInputFooter className="border-0 bg-transparent px-1 pb-0">
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                aria-label="Add to workspace"
                title="Add to workspace"
                className="size-8 rounded-full"
              >
                <Plus className="size-4" />
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent side="top">
                <PromptInputActionMenuItem onSelect={onAddSource}>
                  <Plus className="size-4" />
                  Add source
                </PromptInputActionMenuItem>
                <PromptInputActionMenuItem onSelect={onAddMemory}>
                  <MessageSquareText className="size-4" />
                  Add memory
                </PromptInputActionMenuItem>
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={webSearchEnabled}
              aria-label="Use web search"
              title="Use web search"
              disabled={streaming}
              onClick={() => setWebSearchEnabled((enabled) => !enabled)}
              className={
                webSearchEnabled
                  ? "h-8 rounded-full bg-primary/10 px-3 text-primary hover:bg-primary/15"
                  : "h-8 rounded-full px-3 text-muted-foreground"
              }
            >
              <Globe className="size-4" />
              <span className="ml-1.5 text-xs">Web search</span>
            </Button>
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            onStop={stop}
            disabled={status === "submitted" || (!streaming && !draft.trim())}
            aria-label={
              status === "streaming"
                ? "Stop generating"
                : "Send question"
            }
            title={
              status === "streaming" ? "Stop generating" : "Send question"
            }
            className="size-8 rounded-full"
          >
            {status === "streaming" ? (
              <Square className="size-3.5" />
            ) : status === "submitted" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      <p className="mt-2 pb-2 text-center text-xs text-muted-foreground">
        {copyError ??
          (webSearchEnabled
            ? "Web search is enabled for this question."
            : "NotebookLM can make mistakes. Check important details against the sources.")}
      </p>
    </div>
  );
}

function StreamingChat(props: StreamingChatProps) {
  return (
    <PromptInputProvider>
      <StreamingChatContent {...props} />
    </PromptInputProvider>
  );
}

export function WorkspaceConversation({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { data: session } = useAuthSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const lastSyncedUrlConversationId = useRef(urlConversationId);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(() => urlConversationId);
  const [createdConversationId, setCreatedConversationId] = useState<
    string | null
  >(null);
  const [chatSessionKey, setChatSessionKey] = useState(
    () => `new-${crypto.randomUUID()}`
  );
  const [addMemoryOpen, setAddMemoryOpen] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const sourcesQuery = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => listAllWorkspaceSources(workspaceId),
    enabled: !!session,
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) =>
          source.status === "pending" || source.status === "processing"
      )
        ? 3000
        : false,
  });
  useEffect(() => {
    if (lastSyncedUrlConversationId.current === urlConversationId) return;
    lastSyncedUrlConversationId.current = urlConversationId;
    if (urlConversationId === createdConversationId) return;
    startTransition(() => {
      setCreatedConversationId(null);
      setSelectedConversationId(urlConversationId);
      setChatSessionKey(urlConversationId ?? `new-${crypto.randomUUID()}`);
    });
  }, [createdConversationId, urlConversationId]);

  const conversationQuery = useQuery({
    queryKey: ["conversation", workspaceId, selectedConversationId],
    queryFn: () => {
      if (!selectedConversationId) {
        throw new Error("A conversation must be selected.");
      }
      return getConversation(workspaceId, selectedConversationId);
    },
    enabled: !!session && selectedConversationId !== null,
    retry: retryNotFound,
    retryDelay: retryNotFoundDelay,
  });

  const selectedConversationReady =
    selectedConversationId === null ||
    selectedConversationId === createdConversationId ||
    conversationQuery.data?.id === selectedConversationId;
  const initialMessages = selectedConversationReady
    ? toUIMessages(conversationQuery.data?.messages ?? [])
    : [];

  const handleFinishMessage = async (conversationId: string | null) => {
    if (conversationId) {
      setCreatedConversationId(conversationId);
      setSelectedConversationId(conversationId);
      lastSyncedUrlConversationId.current = conversationId;
      router.replace(
        `/dashboard/workspaces/${workspaceId}?c=${encodeURIComponent(conversationId)}`,
        { scroll: false }
      );
    }

    await queryClient.invalidateQueries({
      queryKey: [
        "conversation",
        workspaceId,
        conversationId ?? selectedConversationId,
      ],
    });
    await queryClient.invalidateQueries({
      queryKey: ["conversations", workspaceId],
    });
  };

  const sources = sourcesQuery.data ?? [];
  const hasReadySources = sources.some((source) => source.status === "ready");

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!selectedConversationReady ? (
        conversationQuery.isError ? (
          <Card className="m-6 border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(conversationQuery.error)}
          </Card>
        ) : (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conversation...
          </p>
        )
      ) : (
        <StreamingChat
          key={chatSessionKey}
          workspaceId={workspaceId}
          conversationId={selectedConversationId}
          chatId={chatSessionKey}
          initialMessages={initialMessages}
          onFinishMessage={handleFinishMessage}
          hasReadySources={hasReadySources}
          sourceError={
            sourcesQuery.isError ? getErrorMessage(sourcesQuery.error) : null
          }
          onAddSource={() => setAddSourceOpen(true)}
          onAddMemory={() => setAddMemoryOpen(true)}
        />
      )}
      <AddMemoryDialog open={addMemoryOpen} onOpenChange={setAddMemoryOpen} />
      <AddSourceDialog
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
        workspaceId={workspaceId}
      />
    </main>
  );
}
