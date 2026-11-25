import { Suspense } from "react";
import { WorkspaceArtifactPage } from "@/components/workspace/workspace-artifact-page";

async function ArtifactPageContent({
  params,
}: {
  params: Promise<{ workspaceId: string; artifactId: string }>;
}) {
  const { workspaceId, artifactId } = await params;

  return (
    <WorkspaceArtifactPage workspaceId={workspaceId} artifactId={artifactId} />
  );
}

export default function ArtifactPage({
  params,
}: {
  params: Promise<{ workspaceId: string; artifactId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-muted/20" />}>
      <ArtifactPageContent params={params} />
    </Suspense>
  );
}
