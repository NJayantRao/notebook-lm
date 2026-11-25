"use client";

import { Button } from "@/components/ui/button";

export default function SourcesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="font-heading text-2xl">Sources are unavailable</h2>
      <p className="text-sm text-muted-foreground">Try loading this page again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
