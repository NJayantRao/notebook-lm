"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  BookOpen,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { MemoriesDialog } from "@/components/workspace/memories-dialog";
import { useAuthSession } from "@/hooks/use-auth";
import { useArtifacts } from "@/hooks/use-artifacts";
import { getErrorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { ConversationListItem, SourceListItem, WorkspaceListItem } from "@/lib/types";
import { listConversations } from "@/services/conversation.service";
import { listAllWorkspaceSources } from "@/services/source.service";
import { getWorkspaceById, listWorkspaces } from "@/services/workspace.service";

type WorkspaceShellProps = {
  workspaceId: string;
  children: React.ReactNode;
};

function WorkspaceSidebar({
  workspaceId,
  workspaceTitle,
  workspaces,
  conversations,
  sources,
  artifactCount,
  activeConversationId,
  collapsed,
  onCollapse,
  onNavigate,
  onOpenSearch,
  onOpenMemories,
}: {
  workspaceId: string;
  workspaceTitle: string;
  workspaces: WorkspaceListItem[];
  conversations: ConversationListItem[];
  sources: SourceListItem[];
  artifactCount: number;
  activeConversationId: string | null;
  collapsed: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  onOpenSearch: () => void;
  onOpenMemories: () => void;
}) {
  const router = useRouter();
  const base = `/dashboard/workspaces/${workspaceId}`;
  const pathname = usePathname();
  const { data: session } = useAuthSession();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = (session?.user?.name || session?.user?.email || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const sourceNeedsAttention = sources.some(
    (source) =>
      source.status === "pending" ||
      source.status === "processing" ||
      source.status === "failed"
  );
  const nav = [
    { href: base, label: "Chat", icon: MessageSquare },
    {
      href: `${base}/sources`,
      label: "Sources",
      icon: FileText,
      count: sources.length,
      attention: sourceNeedsAttention,
    },
    {
      href: `${base}/artifacts`,
      label: "Artifacts",
      icon: Sparkles,
      count: artifactCount,
    },
  ];

  const logout = async () => {
    setLoggingOut(true);
    try {
      queryClient.clear();
      await authClient.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        collapsed ? "w-[4.25rem]" : "w-[16.25rem]"
      )}
    >
      <div className="shrink-0 p-3">
        <div className="flex items-center gap-2">
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-10 min-w-0 flex-1 justify-between px-2 text-left"
                    aria-label="Switch workspace"
                  />
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium">{workspaceTitle}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => {
                      router.push(`/dashboard/workspaces/${workspace.id}`);
                      onNavigate?.();
                    }}
                  >
                    <BookOpen />
                    <span className="truncate">{workspace.title}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    router.push("/dashboard");
                    onNavigate?.();
                  }}
                >
                  <LayoutDashboard />
                  Back to dashboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mx-auto size-10"
                    aria-label="Switch workspace"
                  />
                }
              >
                <BookOpen className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() =>
                      router.push(`/dashboard/workspaces/${workspace.id}`)
                    }
                  >
                    <BookOpen />
                    <span className="truncate">{workspace.title}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
                  <LayoutDashboard />
                  Back to dashboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("size-8 shrink-0 text-muted-foreground", collapsed && "hidden")}
              onClick={onCollapse}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-2 size-10"
            onClick={onCollapse}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          className={cn(
            "mt-3 h-9 w-full justify-start gap-2",
            collapsed && "justify-center px-0"
          )}
          onClick={() => {
            router.push(base);
            onNavigate?.();
          }}
          title={collapsed ? "New chat" : undefined}
        >
          <Plus className="size-4" />
          {!collapsed && "New chat"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "mt-1 h-9 w-full justify-start gap-2 text-muted-foreground",
            collapsed && "justify-center px-0"
          )}
          onClick={onOpenSearch}
          title={collapsed ? "Search" : undefined}
        >
          <Search className="size-4" />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && <kbd className="text-[10px] text-muted-foreground">⌘K</kbd>}
        </Button>
      </div>

      <nav aria-label="Workspace navigation" className="space-y-1 px-2">
        {nav.map(({ href, label, icon: Icon, count, attention }) => {
          const active =
            label === "Chat"
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors hover:bg-sidebar-accent",
                active
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="relative shrink-0">
                <Icon className="size-4" />
                {attention && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-warning ring-2 ring-sidebar" />
                )}
              </span>
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && count !== undefined && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-9 w-full justify-start gap-3 px-2.5 text-sm text-muted-foreground",
            collapsed && "justify-center px-0"
          )}
          onClick={onOpenMemories}
          title={collapsed ? "Memories" : undefined}
        >
          <UserRound className="size-4" />
          {!collapsed && "Memories"}
        </Button>
      </nav>

      {!collapsed && (
        <section className="mt-5 flex min-h-0 flex-1 flex-col px-2">
          <h2 className="px-2.5 pb-2 text-xs font-medium text-muted-foreground">
            Recent chats
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                Your chats will appear here.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`${base}?c=${encodeURIComponent(conversation.id)}`}
                      onClick={onNavigate}
                      aria-current={
                        activeConversationId === conversation.id ? "page" : undefined
                      }
                      className={cn(
                        "block truncate rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        activeConversationId === conversation.id &&
                          "bg-sidebar-accent text-foreground"
                      )}
                    >
                      {conversation.title || "New conversation"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <div className="mt-auto shrink-0 border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-2 px-2 py-2",
                  collapsed && "justify-center px-0"
                )}
                aria-label="Account and preferences"
              />
            }
          >
            <Avatar className="size-8 shrink-0">
              {session?.user?.image && (
                <AvatarImage
                  src={session.user.image}
                  alt={session.user.name ?? "Profile"}
                />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">
                    {session?.user?.name || session?.user?.email || "Account"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {session?.user?.email}
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>Preferences</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/terms")}>
              Terms
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/privacy")}>
              Privacy
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={loggingOut}
              onSelect={() => void logout()}
            >
              {loggingOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

export function WorkspaceShell({
  workspaceId,
  children,
}: WorkspaceShellProps) {
  const { data: session } = useAuthSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspaceById(workspaceId),
    enabled: !!session,
  });
  const workspacesQuery = useQuery({
    queryKey: ["workspaces", session?.user?.id],
    queryFn: listWorkspaces,
    enabled: !!session,
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => listConversations(workspaceId),
    enabled: !!session,
  });
  const sourcesQuery = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => listAllWorkspaceSources(workspaceId),
    enabled: !!session,
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) => source.status === "pending" || source.status === "processing"
      )
        ? 3000
        : false,
  });
  const artifactsQuery = useArtifacts(workspaceId, !!session);

  const sources = sourcesQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const artifacts = artifactsQuery.data ?? [];
  const workspaceTitle = workspaceQuery.data?.title ?? "Workspace";
  const currentPath = `/dashboard/workspaces/${workspaceId}`;
  const router = useRouter();
  const workspaceShellError =
    workspaceQuery.error ??
    workspacesQuery.error ??
    conversationsQuery.error ??
    (pathname === currentPath
      ? sourcesQuery.error ?? artifactsQuery.error
      : undefined);

  const openSearch = () => setSearchOpen(true);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const sidebarProps = {
    workspaceId,
    workspaceTitle,
    workspaces: workspacesQuery.data ?? [],
    conversations,
    sources,
    artifactCount: artifacts.length,
    activeConversationId: searchParams.get("c"),
    onOpenSearch: openSearch,
    onOpenMemories: () => setMemoriesOpen(true),
  };

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <div className="hidden shrink-0 md:block">
        <WorkspaceSidebar
          {...sidebarProps}
          collapsed={collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
        />
      </div>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[min(84vw,18rem)] gap-0 border-r border-border p-0">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          <WorkspaceSidebar
            {...sidebarProps}
            collapsed={false}
            onNavigate={() => setMobileSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open workspace navigation"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
            <span className="truncate text-sm font-medium">
              {workspaceTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`${currentPath}/sources`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {sources.some(
                (source) =>
                  source.status === "pending" ||
                  source.status === "processing" ||
                  source.status === "failed"
              ) && <span className="size-1.5 rounded-full bg-warning" />}
              {sources.length} sources
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={openSearch}
              aria-label="Search workspace"
            >
              <Search className="size-4" />
            </Button>
          </div>
        </header>
        {workspaceShellError && (
          <p
            role="alert"
            className="border-b border-destructive/20 bg-destructive/5 px-5 py-2 text-xs text-destructive"
          >
            {getErrorMessage(workspaceShellError)}
          </p>
        )}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search workspace"
        description="Search conversations, sources, and artifacts"
      >
        <CommandInput placeholder="Search conversations, sources, artifacts..." />
        <CommandList>
          <CommandEmpty>No matching items.</CommandEmpty>
          {conversations.length > 0 && (
            <CommandGroup heading="Conversations">
              {conversations.map((conversation) => (
                <CommandItem
                  key={conversation.id}
                  value={`conversation ${conversation.title ?? "New conversation"}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(`${currentPath}?c=${encodeURIComponent(conversation.id)}`);
                  }}
                >
                  <MessageSquare />
                  <span className="truncate">{conversation.title || "New conversation"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          {sources.length > 0 && (
            <CommandGroup heading="Sources">
              {sources.map((source) => (
                <CommandItem
                  key={source.id}
                  value={`source ${source.title}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(`${currentPath}/sources`);
                  }}
                >
                  <FileText />
                  <span className="truncate">{source.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          {artifacts.length > 0 && (
            <CommandGroup heading="Artifacts">
              {artifacts.map((artifact) => (
                <CommandItem
                  key={artifact.id}
                  value={`artifact ${artifact.title}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(`${currentPath}/artifacts/${artifact.id}`);
                  }}
                >
                  <Sparkles />
                  <span className="truncate">{artifact.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      <MemoriesDialog open={memoriesOpen} onOpenChange={setMemoriesOpen} />
    </div>
  );
}
