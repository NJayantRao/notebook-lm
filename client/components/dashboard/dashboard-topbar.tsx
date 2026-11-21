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
    <header className="border-b border-border">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle sources sidebar"
              title="Toggle sources sidebar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-base font-bold tracking-tight text-foreground">
                NoteBook<span className="font-medium text-primary">LM</span>
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:block">
                AI Cognitive Research Agent
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Both icons are rendered and switched with CSS so the server and
              client markup match (the theme is only known on the client). */}
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <Sun className="hidden h-5 w-5 dark:block" />
            <Moon className="h-5 w-5 dark:hidden" />
          </button>

          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border border-border">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user.name ?? "Profile"} />
              ) : null}
              <AvatarFallback className="bg-muted text-sm font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="truncate text-sm font-bold text-foreground">
                {user?.name}
              </p>
              <p className="truncate text-xs font-semibold text-foreground/80">
                {user?.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
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
