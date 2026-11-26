"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { WorkspaceGrid } from "@/components/dashboard/workspace-grid";
import { useAuthSession } from "@/hooks/use-auth";
import { listWorkspaces } from "@/services/workspace.service";

export function DashboardShell() {
  const { data: session } = useAuthSession();

  // The API only returns workspaces owned by the signed-in user. The user id is
  // part of the key so a different account never sees a cached list.
  const workspacesQuery = useQuery({
    queryKey: ["workspaces", session?.user?.id],
    queryFn: listWorkspaces,
    enabled: !!session,
  });

  return (
    <div className="notebook-theme min-h-screen bg-background text-foreground">
      <DashboardTopbar user={session?.user} />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <WorkspaceGrid
          workspaces={workspacesQuery.data ?? []}
          loading={workspacesQuery.isLoading}
          error={workspacesQuery.isError ? workspacesQuery.error : null}
        />
      </main>
    </div>
  );
}