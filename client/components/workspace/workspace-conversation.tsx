"use client";

import {
  useEffect,
  useLayoutEffect,
  startTransition,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import axios from "axios";
import Markdown, { type Components } from "react-markdown";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddMemoryDialog } from "@/components/workspace/add-memory-dialog";
import { AddSourceDialog } from "@/components/workspace/add-source-dialog";
import { CitationChip } from "@/components/workspace/citation-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
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

const citedNumbers = (text: string): Set<number> => {
  const numbers = new Set<number>();
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0) numbers.add(value);
  }
  return numbers;
};

// react-markdown escapes raw HTML by default; these overrides only add styling,
// link citation badges to their chips, and keep external links safe to open.
const buildMarkdownComponents = (messageId: string): Components => ({
  a: ({ children, href, title }) => {
    if (typeof href === "string" && href.startsWith("#cite-")) {
      const number = Number(href.slice("#cite-".length));
      return (
        <a
          href={href}
          title={title ?? `Go to source ${number}`}
          onClick={(event) => {
            event.preventDefault();
            document
              .getElementById(`${messageId}-${number}`)
              ?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "center",
              });
          }}
          className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 align-baseline text-xs font-medium text-foreground no-underline"
        >
          {children}
        </a>
      );
    }

    return (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noreferrer noopener"
        className="break-words text-foreground underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs last:mb-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5">{children}</code>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 align-top">{children}</td>
  ),
});

function StreamingChat({
  workspaceId,
  conversationId,
  chatId,
  initialMessages,
  onFinishMessage,
  hasReadySources,
  sourceError,
  onAddSource,
  onAddMemory,
}: {
  workspaceId: string;
  conversationId: string | null;
  chatId: string;
  initialMessages: ChatUIMessage[];
  onFinishMessage: (conversationId: string | null) => void;
  hasReadySources: boolean;
  sourceError: string | null;
  onAddSource: () => void;
  onAddMemory: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const lastMessageTextLength = lastMessage ? getText(lastMessage).length : 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageTextLength, messages.length, status]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 8 * 24)}px`;
  }, [draft]);

  const sendPrompt = (prompt: string) => {
    if (streaming) return;
    finishedConversationId.current = null;
    setDraft("");
    void sendMessage({ text: prompt });
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming) return;
    sendPrompt(message);
  };

  const copyMessage = async (messageId: string, text: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setCopyError("Could not copy this message.");
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-7">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-8">
        {messages.length === 0 && (
          <div className="flex min-h-[min(52dvh,34rem)] flex-col items-center justify-center text-center">
            <MessageSquareText className="mb-4 size-6 text-primary" />
            <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
              What would you like to understand?
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              Ask a question about this workspace. Answers are grounded in your
              sources and include citations.
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
          </div>
        )}

        {messages.map((message) => {
          const text = getText(message);
          const cited = citedNumbers(text);
          const citations = getCitations(message).filter((citation) =>
            cited.has(citation.number)
          );
          const markdown = text.replace(
            /\[(\d+)\]/g,
            (_, number: string) => `[$1](#cite-${number})`
          );

          return (
            <div
              key={message.id}
              className={`mb-7 flex w-full ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <article
                className={`group min-w-0 ${
                  message.role === "user"
                    ? "max-w-[88%] rounded-2xl bg-muted/80 px-4 py-3"
                    : "w-full max-w-full py-1"
                }`}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm leading-7">{text}</p>
                ) : (
                  <div className="text-base leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <Markdown components={buildMarkdownComponents(message.id)}>
                      {markdown}
                    </Markdown>
                  </div>
                )}
                {message.role === "assistant" && citations.length > 0 && (
                  <details className="mt-4 border-t border-border pt-3">
                    <summary className="w-fit cursor-pointer list-none text-xs text-muted-foreground marker:hidden hover:text-foreground">
                      Sources ({citations.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {citations.map((citation) => (
                        <CitationChip
                          key={`${message.id}-${citation.number}`}
                          anchorId={`${message.id}-${citation.number}`}
                          number={citation.number}
                          title={citation.title}
                          excerpt={citation.excerpt}
                          url={citation.url}
                          page={citation.page}
                          startSeconds={citation.startSeconds}
                        />
                      ))}
                    </div>
                  </details>
                )}
                <div className="mt-2 flex justify-end opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy message"
                    title="Copy message"
                    onClick={() => void copyMessage(message.id, text)}
                    className="text-muted-foreground"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </article>
            </div>
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
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form
        onSubmit={submitMessage}
        className="sticky bottom-0 z-10 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {getErrorMessage(error)}
          </p>
        )}
        <div className="rounded-2xl border border-border bg-card p-2 transition-colors focus-within:border-ring/50">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask anything about your sources..."
            aria-label="Your question"
            rows={1}
            maxLength={4000}
            disabled={streaming}
            className="min-h-9 max-h-48 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex min-w-0 items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Add to workspace"
                    />
                  }
                >
                  <Plus className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onSelect={onAddSource}>
                    <Plus className="size-4" />
                    Add source
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onAddMemory}>
                    <MessageSquareText className="size-4" />
                    Add memory
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            </div>
            {streaming ? (
              <Button
                type="button"
                aria-label="Stop generating"
                title="Stop generating"
                onClick={() => stop()}
                variant="outline"
                size="icon"
                className="size-8 rounded-full"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                aria-label="Send question"
                disabled={!draft.trim()}
                size="icon"
                className="size-8 rounded-full"
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {copyError ??
            (webSearchEnabled
              ? "Web search is enabled for this question."
              : "NotebookLM can make mistakes. Check important details against the sources.")}
        </p>
      </form>
    </div>
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
