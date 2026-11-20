"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Send,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import {
  createConversation,
  getConversation,
  listConversations,
  sendConversationMessage,
} from "@/services/conversation.service";
import { getWorkspaceById } from "@/services/workspace.service";

function formatConversationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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
  const [draft, setDraft] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

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

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      selectedConversationId
        ? sendConversationMessage(
            workspaceId,
            selectedConversationId,
            message,
            webSearchEnabled
          )
        : createConversation(workspaceId, message, webSearchEnabled),
    onSuccess: async (conversation: Conversation) => {
      setSelectedConversationId(conversation.id);
      setDraft("");
      queryClient.setQueryData(
        ["conversation", workspaceId, conversation.id],
        conversation
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversations", workspaceId],
        }),
      ]);
    },
  });

  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversationQuery.data;

  const startNewConversation = () => {
    setSelectedConversationId(null);
    setDraft("");
    sendMutation.reset();
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sendMutation.isPending) return;
    sendMutation.mutate(message);
  };

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
            <Button
              onClick={startNewConversation}
              disabled={sendMutation.isPending}
              className="btn-gradient-primary rounded-xl"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New conversation
            </Button>
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
                      disabled={sendMutation.isPending}
                      onClick={() => {
                        setSelectedConversationId(conversation.id);
                        sendMutation.reset();
                      }}
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
              <div className="flex-1 space-y-4 overflow-y-auto pb-5">
                {selectedConversationId === null ? (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#42D8F5]">
                      <MessageSquareText className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold">
                      Start a conversation
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Ask a question about this workspace. Answers use your
                      indexed sources and include citations.
                    </p>
                  </div>
                ) : conversationQuery.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Loading conversation...
                  </p>
                ) : conversationQuery.isError ? (
                  <Card className="border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
                    {getErrorMessage(conversationQuery.error)}
                  </Card>
                ) : (
                  <>
                    {selectedConversation?.messages?.map((message) => (
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
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                        {message.sources.length > 0 && (
                          <div className="mt-4 border-t border-white/10 pt-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {message.sources[0]?.sourceType === "web"
                                ? "Web sources"
                                : "Sources"}
                            </p>
                            <div className="space-y-2">
                              {message.sources.map((source) => (
                                <div
                                  key={`${message.id}-${source.number}`}
                                  className="rounded-lg bg-black/10 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="font-medium text-[#42D8F5]">
                                      [{source.number}] {source.title}
                                    </span>
                                    {source.url && (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label={`Open ${source.title}`}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                                    {source.excerpt}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </>
                )}
                {sendMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {webSearchEnabled
                      ? "Searching the web and generating an answer..."
                      : "Searching workspace sources and generating an answer..."}
                  </div>
                )}
              </div>

              <form
                onSubmit={submitMessage}
                className="mx-auto w-full max-w-4xl"
              >
                {sendMutation.isError && (
                  <p role="alert" className="mb-2 text-sm text-red-300">
                    {getErrorMessage(sendMutation.error)}
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
                    disabled={sendMutation.isPending}
                    className="max-h-40 min-h-12 resize-y border-0 bg-transparent focus-visible:ring-0"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={webSearchEnabled}
                      aria-label="Use web search"
                      title="Use web search"
                      disabled={sendMutation.isPending}
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
                    <Button
                      type="submit"
                      aria-label="Send question"
                      disabled={!draft.trim() || sendMutation.isPending}
                      className="btn-gradient-primary mb-0.5 h-10 w-10 rounded-xl p-0"
                    >
                      {sendMutation.isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground/70">
                  {webSearchEnabled
                    ? "Web search is enabled for this question."
                    : "Answers are generated from indexed workspace sources."}
                </p>
              </form>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
