"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import Markdown, { type Components } from "react-markdown";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ExternalLink,
  Globe,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Send,
  Square,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { AddMemoryDialog } from "@/components/workspace/add-memory-dialog";
import { MemoriesDialog } from "@/components/workspace/memories-dialog";
import { StudyStudioPanel } from "@/components/workspace/study-studio-panel";
import { WorkspaceSourcesSidebar } from "@/components/workspace/workspace-sources-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type { ConversationMessage, StreamCitation } from "@/lib/types";
import {
  getConversation,
  listConversations,
} from "@/services/conversation.service";
import { getWorkspaceById } from "@/services/workspace.service";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function formatClipTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

function citationHref(citation: StreamCitation): string | undefined {
  if (!citation.url) return undefined;
  if (citation.startSeconds === undefined) return citation.url;
  try {
    const url = new URL(citation.url, window.location.origin);
    url.searchParams.set("t", `${Math.floor(citation.startSeconds)}s`);
    return url.toString();
  } catch {
    return citation.url;
  }
}

function citationSuffix(citation: StreamCitation): string {
  const parts: string[] = [];
  if (citation.page !== undefined) parts.push(`p. ${citation.page}`);
  if (citation.startSeconds !== undefined) {
    parts.push(formatClipTime(citation.startSeconds));
  }
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

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
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-white/[0.08] px-1.5 py-0.5 align-baseline text-xs font-medium text-foreground no-underline"
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
    <blockquote className="mb-3 border-l-2 border-white/20 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs last:mb-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/10 px-1 py-0.5">{children}</code>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 bg-white/5 px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-2 py-1 align-top">{children}</td>
  ),
});

function StreamingChat({
  workspaceId,
  conversationId,
  chatId,
  initialMessages,
  onFinishMessage,
}: {
  workspaceId: string;
  conversationId: string | null;
  chatId: string;
  initialMessages: ChatUIMessage[];
  onFinishMessage: (conversationId: string | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        onFinishMessage(
          !isAbort && !isError ? finishedConversationId.current : null
        );
      },
    }
  );

  const streaming = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const lastMessageTextLength = lastMessage ? getText(lastMessage).length : 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageTextLength, messages.length, status]);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming) return;
    finishedConversationId.current = null;
    setDraft("");
    void sendMessage({ text: message });
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-5">
        {messages.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-foreground/80">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">Start a conversation</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Ask a question about this workspace. Answers use your indexed
              sources and include citations.
            </p>
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
            <article
              key={message.id}
              className={`max-w-4xl rounded-2xl border p-4 ${
                message.role === "user"
                  ? "ml-auto border-border bg-card"
                  : "border-border bg-card"
              }`}
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {text}
                </p>
              ) : (
                <div className="text-base leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown components={buildMarkdownComponents(message.id)}>
                    {markdown}
                  </Markdown>
                </div>
              )}
              {message.role === "assistant" && citations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {citations.map((citation) => (
                    <span
                      key={`${message.id}-${citation.number}`}
                      id={`${message.id}-${citation.number}`}
                      title={`${citation.excerpt}${citationSuffix(citation)}`}
                      className="inline-flex scroll-mt-24 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
                    >
                      <span className="font-medium text-foreground/90">
                        [{citation.number}] {citation.title}
                        {citationSuffix(citation)}
                      </span>
                      {citationHref(citation) && (
                        <a
                          href={citationHref(citation)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${citation.title}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {streaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {webSearchEnabled
              ? "Searching the web and generating an answer..."
              : "Searching workspace sources and generating an answer..."}
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form
        onSubmit={submitMessage}
        className="mx-auto w-full shrink-0 max-w-5xl"
      >
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-300">
            {getErrorMessage(error)}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-lg">
          <Textarea
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
            placeholder="Ask a question about your sources..."
            aria-label="Your question"
            rows={2}
            maxLength={4000}
            disabled={streaming}
            className="max-h-40 min-h-12 resize-y border-0 bg-transparent text-base md:text-base focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1">
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
                  ? "mb-0.5 h-10 rounded-xl bg-white/[0.08] px-3 text-foreground hover:bg-white/[0.12] hover:text-foreground"
                  : "mb-0.5 h-10 rounded-xl px-3 text-muted-foreground"
              }
            >
              <Globe className="h-4 w-4" />
              <span className="ml-1.5 text-xs">Web search</span>
            </Button>
            {streaming ? (
              <Button
                type="button"
                aria-label="Stop generating"
                title="Stop generating"
                onClick={() => stop()}
                className="mb-0.5 h-10 w-10 rounded-xl border border-white/15 bg-white/5 p-0 text-foreground hover:bg-white/10"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                aria-label="Send question"
                disabled={!draft.trim()}
                className="mb-0.5 h-10 w-10 rounded-xl bg-foreground p-0 text-background hover:bg-foreground/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground/70">
          {webSearchEnabled
            ? "Web search is enabled for this question."
            : "Answers are generated from indexed workspace sources."}
        </p>
      </form>
    </>
  );
}

export function WorkspaceConversation({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { data: session } = useAuthSession();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [createdConversationId, setCreatedConversationId] = useState<
    string | null
  >(null);
  const [chatSessionKey, setChatSessionKey] = useState(
    () => `new-${crypto.randomUUID()}`
  );
  const [addMemoryOpen, setAddMemoryOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(true);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspaceById(workspaceId),
    enabled: !!session,
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => listConversations(workspaceId),
    enabled: !!session,
    retry: retryNotFound,
    retryDelay: retryNotFoundDelay,
  });
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

  const startNewConversation = () => {
    setSelectedConversationId(null);
    setCreatedConversationId(null);
    setChatSessionKey(`new-${crypto.randomUUID()}`);
  };

  const selectConversation = (conversationId: string) => {
    setCreatedConversationId(null);
    setSelectedConversationId(conversationId);
    setChatSessionKey(conversationId);
  };

  const conversations = conversationsQuery.data ?? [];
  const selectedConversationTitle =
    conversations.find(
      (conversation) => conversation.id === selectedConversationId
    )?.title ?? "New conversation";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <DashboardTopbar
        user={session?.user}
        onToggleSidebar={() => setSourcesSidebarOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {sourcesSidebarOpen && (
          <WorkspaceSourcesSidebar
            workspaceId={workspaceId}
            workspaceTitle={workspaceQuery.data?.title ?? "Workspace"}
            enabled={!!session}
            conversations={conversations}
            conversationsLoading={conversationsQuery.isLoading}
            conversationsError={
              conversationsQuery.isError ? conversationsQuery.error : null
            }
            selectedConversationId={selectedConversationId}
            onSelectConversation={selectConversation}
          />
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-2.5 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chat
              </p>
              <p className="truncate text-sm font-medium">
                {selectedConversationTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                onClick={() => setAddMemoryOpen(true)}
                className="h-9 rounded-lg border-border bg-card/70 px-2.5 sm:px-3"
              >
                <Plus className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Add memory</span>
                <span className="sm:hidden">Memory</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMemoriesOpen(true)}
                className="h-9 rounded-lg px-2.5 text-muted-foreground hover:text-foreground sm:px-3"
              >
                Memories
              </Button>
              <Button
                onClick={startNewConversation}
                className="h-9 rounded-lg bg-foreground px-2.5 text-background hover:bg-foreground/90 sm:px-3"
              >
                <Plus className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">New conversation</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </header>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-8">
            {!selectedConversationReady ? (
              conversationQuery.isError ? (
                <Card className="border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
                  {getErrorMessage(conversationQuery.error)}
                </Card>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
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
              />
            )}
          </section>
        </main>
        <StudyStudioPanel />
      </div>
      <AddMemoryDialog open={addMemoryOpen} onOpenChange={setAddMemoryOpen} />
      <MemoriesDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
    </div>
  );
}
