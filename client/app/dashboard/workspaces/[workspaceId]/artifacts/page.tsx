import { Suspense } from "react";
import { WorkspaceArtifactsPage } from "@/components/workspace/workspace-artifacts-page";

async function ArtifactsPageContent({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <WorkspaceArtifactsPage workspaceId={workspaceId} />
  );
}

export default function ArtifactsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-muted/20" />}>
      <ArtifactsPageContent params={params} />
    </Suspense>
  );
}
