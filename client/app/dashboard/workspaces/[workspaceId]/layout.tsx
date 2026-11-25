import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

async function WorkspaceLayoutContent({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <RequireAuth>
      <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>
    </RequireAuth>
  );
}

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Loading workspace…
        </div>
      }
    >
      <WorkspaceLayoutContent params={params}>{children}</WorkspaceLayoutContent>
    </Suspense>
  );
}
