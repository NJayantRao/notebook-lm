"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Send,
  Square,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { AddMemoryDialog } from "@/components/workspace/add-memory-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type { ConversationMessage, StreamCitation } from "@/lib/types";
import { getConversation, listConversations } from "@/services/conversation.service";
import { getWorkspaceById } from "@/services/workspace.service";

function formatConversationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

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

// react-markdown escapes raw HTML by default; these overrides only add styling
// and keep generated links safe to open in a new tab.
const markdownComponents: Components = {
  a: ({ children, href, title }) => (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noreferrer noopener"
      className="break-words text-[#42D8F5] underline underline-offset-2"
    >
      {children}
    </a>
  ),
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
};

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
        api: "/api/chat",
        credentials: "include",
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const text = last ? getText(last) : "";
          return {
            api: conversationId
              ? `/api/workspace/${workspaceId}/conversations/${conversationId}/messages/stream`
              : `/api/workspace/${workspaceId}/conversations/stream`,
            body: { message: text, webSearch: webSearchEnabled },
          };
        },
      }),
    [workspaceId, conversationId, webSearchEnabled]
  );

  const { messages, sendMessage, stop, status, error } = useChat<ChatUIMessage>({
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
  });

  const streaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, status]);

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
      <div className="flex-1 space-y-4 overflow-y-auto pb-5">
        {messages.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#42D8F5]">
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
          const citations = getCitations(message);
          return (
            <article
              key={message.id}
              className={`max-w-3xl rounded-2xl border p-4 ${
                message.role === "user"
                  ? "ml-auto border-[#477BFF]/20 bg-[#477BFF]/[0.08]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {message.role === "user" ? "You" : "Notebook"}
              </p>
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {getText(message)}
                </p>
              ) : (
                <div className="text-sm leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown components={markdownComponents}>
                    {getText(message)}
                  </Markdown>
                </div>
              )}
              {message.role === "assistant" && citations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {citations.map((citation) => (
                    <span
                      key={`${message.id}-${citation.number}`}
                      title={citation.excerpt}
                      className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-xs"
                    >
                      <span className="font-medium text-[#42D8F5]">
                        [{citation.number}] {citation.title}
                      </span>
                      {citation.url && (
                        <a
                          href={citation.url}
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

      <form onSubmit={submitMessage} className="mx-auto w-full max-w-4xl">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-300">
            {getErrorMessage(error)}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#0b101b]/80 p-2 shadow-lg">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question about your sources..."
            aria-label="Your question"
            rows={2}
            maxLength={4000}
            disabled={streaming}
            className="max-h-40 min-h-12 resize-y border-0 bg-transparent focus-visible:ring-0"
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
                  ? "mb-0.5 h-10 rounded-xl bg-[#42D8F5]/15 px-3 text-[#42D8F5] hover:bg-[#42D8F5]/20 hover:text-[#42D8F5]"
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
                className="btn-gradient-primary mb-0.5 h-10 w-10 rounded-xl p-0"
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
  const [chatId, setChatId] = useState(() => `new-${crypto.randomUUID()}`);
  const [addMemoryOpen, setAddMemoryOpen] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspaceById(workspaceId),
    enabled: !!session,
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => listConversations(workspaceId),
    enabled: !!session,
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
  });

  const selectedConversationReady =
    selectedConversationId === null ||
    conversationQuery.data?.id === selectedConversationId;
  const activeChatId = selectedConversationReady
    ? (selectedConversationId ?? chatId)
    : `loading-${selectedConversationId}`;
  const initialMessages = selectedConversationReady
    ? toUIMessages(conversationQuery.data?.messages ?? [])
    : [];

  const handleFinishMessage = async (conversationId: string | null) => {
    if (conversationId) {
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
    setChatId(`new-${crypto.randomUUID()}`);
  };

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const conversations = conversationsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-app-radial text-foreground">
      <div className="flex min-h-screen">
        <DashboardSidebar user={session?.user} />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#05070d]/40 px-4 pb-4 pt-16 backdrop-blur-sm sm:px-6 lg:pt-6">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {workspaceQuery.data?.title ?? "Workspace"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask questions grounded in indexed workspace sources.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAddMemoryOpen(true)}
                className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add memory
              </Button>
              <Button
                onClick={startNewConversation}
                className="btn-gradient-primary rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New conversation
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="border-b border-white/5 p-3 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
              <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Conversation history
              </p>
              {conversationsQuery.isLoading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  Loading conversations...
                </p>
              ) : conversationsQuery.isError ? (
                <p className="px-2 py-3 text-sm text-red-300">
                  {getErrorMessage(conversationsQuery.error)}
                </p>
              ) : conversations.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  Your conversations will appear here.
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`min-w-52 rounded-xl border p-3 text-left transition-colors lg:min-w-0 ${
                        selectedConversationId === conversation.id
                          ? "border-[#42D8F5]/30 bg-[#42D8F5]/[0.07]"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium">
                        {conversation.title || "New conversation"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatConversationDate(conversation.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
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
                  key={activeChatId}
                  workspaceId={workspaceId}
                  conversationId={selectedConversationId}
                  chatId={activeChatId}
                  initialMessages={initialMessages}
                  onFinishMessage={handleFinishMessage}
                />
              )}
            </main>
          </div>
        </div>
      </div>
      <AddMemoryDialog open={addMemoryOpen} onOpenChange={setAddMemoryOpen} />
    </div>
  );
}
