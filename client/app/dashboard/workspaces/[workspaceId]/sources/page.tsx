import { Suspense } from "react";
import { WorkspaceSourcesPage } from "@/components/workspace/workspace-sources-page";

async function SourcesPageContent({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <WorkspaceSourcesPage workspaceId={workspaceId} />
  );
}

export default function SourcesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-muted/20" />}>
      <SourcesPageContent params={params} />
    </Suspense>
  );
}
