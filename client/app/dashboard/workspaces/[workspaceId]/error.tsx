"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="font-heading text-2xl">This workspace didn&apos;t load</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Try again. If the problem continues, return to your dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
