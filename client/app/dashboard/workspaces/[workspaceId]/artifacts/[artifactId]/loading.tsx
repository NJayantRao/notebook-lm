export default function ArtifactLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-12 animate-pulse border-b border-border bg-muted/40" />
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-6">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
