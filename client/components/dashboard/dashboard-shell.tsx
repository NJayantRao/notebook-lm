"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { WorkspaceGrid } from "@/components/dashboard/workspace-grid";
import { RecentSources } from "@/components/dashboard/recent-sources";
import { CreateWorkspaceDialog } from "@/components/dashboard/create-workspace-dialog";
import { AddWebsiteSourceDialog } from "@/components/dashboard/add-website-source-dialog";
import { AddYouTubeSourceDialog } from "@/components/dashboard/add-youtube-source-dialog";
import { UploadPdfSourceDialog } from "@/components/dashboard/upload-pdf-source-dialog";
import { useAuthSession } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { listWorkspaces } from "@/services/workspace.service";
import { listSources } from "@/services/source.service";
import type { Source } from "@/lib/types";

export function DashboardShell() {
  const { data: session } = useAuthSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [addWebsiteOpen, setAddWebsiteOpen] = useState(false);
  const [addYouTubeOpen, setAddYouTubeOpen] = useState(false);
  const [uploadPdfOpen, setUploadPdfOpen] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    enabled: !!session,
  });

  const workspaces = workspacesQuery.data ?? [];

  const sourcesQuery = useQuery({
    queryKey: ["recent-sources", workspaces.map((w) => w.id).join(",")],
    queryFn: async () => {
      if (workspaces.length === 0) return [] as Source[];
      const results = await Promise.allSettled(
        workspaces.map((w) => listSources(w.id, { limit: 5, page: 1 }))
      );
      const all: Source[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          all.push(...r.value.sources);
        }
      }
      all.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return all.slice(0, 8);
    },
    enabled: !!session && workspacesQuery.isSuccess,
  });

  const allSources = sourcesQuery.data ?? [];
  const totalSources = allSources.length;
  const processedSources = allSources.filter(
    (s) => s.status === "ready"
  ).length;

  return (
    <div className="min-h-screen bg-app-radial text-foreground">
      <div className="flex min-h-screen">
        <DashboardSidebar user={session?.user} />

        <div className="flex min-h-screen flex-1 flex-col">
          <DashboardHeader
            userName={session?.user?.name}
            onNewWorkspace={() => setCreateOpen(true)}
            onAddWebsite={() => setAddWebsiteOpen(true)}
            onAddYouTube={() => setAddYouTubeOpen(true)}
            onUploadPdf={() => setUploadPdfOpen(true)}
          />

          <main className="flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8">
            <OverviewCards
              totalWorkspaces={workspaces.length}
              totalSources={totalSources}
              processedSources={processedSources}
              loading={workspacesQuery.isLoading || sourcesQuery.isLoading}
            />

            <WorkspaceGrid
              workspaces={workspaces}
              loading={workspacesQuery.isLoading}
              error={workspacesQuery.isError ? workspacesQuery.error : null}
              onCreate={() => setCreateOpen(true)}
            />

            <RecentSources
              sources={allSources}
              loading={sourcesQuery.isLoading && workspaces.length > 0}
              hasWorkspaces={workspaces.length > 0}
            />
          </main>
        </div>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AddWebsiteSourceDialog
        open={addWebsiteOpen}
        onOpenChange={setAddWebsiteOpen}
        workspaces={workspaces}
      />
      <AddYouTubeSourceDialog
        open={addYouTubeOpen}
        onOpenChange={setAddYouTubeOpen}
        workspaces={workspaces}
      />
      <UploadPdfSourceDialog
        open={uploadPdfOpen}
        onOpenChange={setUploadPdfOpen}
        workspaces={workspaces}
      />
    </div>
  );
}
