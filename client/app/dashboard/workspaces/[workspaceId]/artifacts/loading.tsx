export default function ArtifactsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="aspect-video animate-pulse rounded-2xl bg-muted" />
        <div className="aspect-video animate-pulse rounded-2xl bg-muted" />
        <div className="aspect-video animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
