"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { AddSourceDialog } from "@/components/workspace/add-source-dialog";
import { WorkspaceSourceRow } from "@/components/workspace/source-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type { SourceListItem } from "@/lib/types";
import { listAllWorkspaceSources } from "@/services/source.service";

type SourceStatusFilter = "all" | SourceListItem["status"];

export function WorkspaceSourcesPage({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { data: session } = useAuthSession();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SourceStatusFilter>("all");
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
  const sources = useMemo(() => sourcesQuery.data ?? [], [sourcesQuery.data]);
  const filteredSources = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return sources.filter((source) => {
      const matchesSearch =
        !normalizedSearch ||
        source.title.toLocaleLowerCase().includes(normalizedSearch) ||
        source.sourceType.toLocaleLowerCase().includes(normalizedSearch);
      return (
        matchesSearch &&
        (statusFilter === "all" || source.status === statusFilter)
      );
    });
  }, [search, sources, statusFilter]);

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">
            Sources
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sources.length} {sources.length === 1 ? "source" : "sources"} in this
            workspace
          </p>
        </div>
        <Button onClick={() => setAddSourceOpen(true)} className="rounded-full">
          <Plus className="size-4" />
          Add source
        </Button>
      </header>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sources"
            aria-label="Search sources"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <label className="sr-only" htmlFor="source-status-filter">
          Filter sources by status
        </label>
        <select
          id="source-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as SourceStatusFilter)
          }
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <section className="mt-5 min-h-0 flex-1">
        {sourcesQuery.isLoading ? (
          <div className="space-y-3" aria-label="Loading sources">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-[4.75rem] animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : sourcesQuery.isError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {getErrorMessage(sourcesQuery.error)}
          </div>
        ) : sources.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <h2 className="mt-4 font-heading text-2xl">Add your first source</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Bring in a document, webpage, video, or note to start asking
              grounded questions.
            </p>
            <Button
              onClick={() => setAddSourceOpen(true)}
              className="mt-5 rounded-full"
            >
              <Plus className="size-4" />
              Add source
            </Button>
          </div>
        ) : filteredSources.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No sources match those filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredSources.map((source) => (
              <WorkspaceSourceRow key={source.id} source={source} />
            ))}
          </ul>
        )}
      </section>

      <AddSourceDialog
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
        workspaceId={workspaceId}
      />
    </main>
  );
}
