"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Folder,
  Plus,
  Search,
  Calendar,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workspace } from "@/lib/types";
import { getErrorMessage } from "@/lib/api";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function WorkspaceCardItem({ workspace }: { workspace: Workspace }) {
  return (
    <Card className="group relative flex h-full flex-col border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(71,123,255,0.14),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#477BFF]/20 to-[#42D8F5]/10 text-[#42D8F5]">
          {workspace.icon ? (
            <span className="text-base leading-none">{workspace.icon}</span>
          ) : (
            <Folder className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-foreground">
            {workspace.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {workspace.description || "No description yet."}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground/80">
        <Calendar className="h-3.5 w-3.5" />
        <span>Created {formatDate(workspace.createdAt)}</span>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
        <span className="text-xs text-muted-foreground/70">Workspace</span>
        <Link
          href={`/dashboard/workspaces/${workspace.id}`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#42D8F5] transition-colors hover:bg-white/[0.05]"
        >
          Open workspace
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

export function WorkspaceGrid({
  workspaces,
  loading,
  error,
  onCreate,
}: {
  workspaces: Workspace[];
  loading: boolean;
  error: unknown;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.description || "").toLowerCase().includes(q)
    );
  }, [workspaces, query]);

  return (
    <section id="workspaces" className="scroll-mt-24 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Your Workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize and explore your knowledge by workspace.
          </p>
        </div>
        {workspaces.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces..."
              className="h-10 rounded-xl border-white/10 bg-white/[0.03] pl-9"
              aria-label="Search workspaces"
            />
          </div>
        )}
      </div>

      {error ? (
        <Card className="flex items-start gap-3 border-red-500/20 bg-red-500/5 p-5 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Unable to load workspaces</p>
            <p className="mt-1 text-red-200/80">{getErrorMessage(error)}</p>
          </div>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 bg-white/10" />
                  <Skeleton className="h-3 w-full bg-white/10" />
                  <Skeleton className="h-3 w-4/5 bg-white/10" />
                </div>
              </div>
              <Skeleton className="mt-5 h-3 w-28 bg-white/10" />
            </Card>
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <Card className="relative overflow-hidden border-white/10 bg-white/[0.02] p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(71,123,255,0.18),transparent_60%)] blur-2xl" />
          <div className="relative mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#477BFF]/20 to-[#42D8F5]/10 text-[#42D8F5]">
              <Folder className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              Your knowledge journey starts here.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create your first workspace and start bringing your knowledge
              together.
            </p>
            <Button
              onClick={onCreate}
              className="btn-gradient-primary mt-6 h-10 rounded-xl px-5"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No workspaces match your search.
          </p>
          <Button
            variant="ghost"
            onClick={() => setQuery("")}
            className="mt-3 text-[#42D8F5] hover:bg-white/[0.04]"
          >
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((workspace) => (
            <WorkspaceCardItem key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}
    </section>
  );
}
