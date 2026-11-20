"use client";

import { Sparkles } from "lucide-react";

export function AuthLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-radial">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Sparkles className="h-6 w-6 text-[#42D8F5]" />
          <span className="absolute inset-0 rounded-2xl ring-1 ring-white/10 animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
