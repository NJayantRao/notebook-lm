import { Suspense } from "react";
import { WorkspaceConversation } from "@/components/workspace/workspace-conversation";

async function WorkspacePageContent({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return <WorkspaceConversation workspaceId={workspaceId} />;
}

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-app-radial p-8 text-sm text-muted-foreground">
          Loading workspace...
        </div>
      }
    >
      <WorkspacePageContent params={params} />
    </Suspense>
  );
}
