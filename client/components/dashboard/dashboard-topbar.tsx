"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  BookOpen,
  LoaderCircle,
  Moon,
  PanelLeftClose,
  Sun,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";

type TopbarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function DashboardTopbar({
  user,
  onToggleSidebar,
}: {
  user?: TopbarUser;
  onToggleSidebar?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
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

  const initial = (user?.name || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle sources sidebar"
              title="Toggle sources sidebar"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <BookOpen className="size-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-base font-semibold tracking-tight text-foreground sm:text-lg">
                NoteBook<span className="font-medium text-primary">LM</span>
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:block">
                AI Cognitive Workspace
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Both icons are rendered and switched with CSS so the server and
              client markup match (the theme is only known on the client). */}
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground sm:size-9"
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </button>

          <div className="flex items-center gap-2">
            <Avatar className="size-8 border border-border sm:size-9">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user.name ?? "Profile"} />
              ) : null}
              <AvatarFallback className="bg-muted text-xs font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="truncate text-xs font-semibold text-foreground">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:h-9 sm:px-4"
          >
            {loggingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              "Logout"
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
