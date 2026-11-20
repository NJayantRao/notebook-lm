"use client";

import { FileUp, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  userName,
  onNewWorkspace,
  onAddWebsite,
  onUploadPdf,
}: {
  userName?: string | null;
  onNewWorkspace: () => void;
  onAddWebsite: () => void;
  onUploadPdf: () => void;
}) {
  const firstName = userName?.trim()?.split(/\s+/)[0] || "there";

  return (
    <header className="border-b border-white/5 bg-[#05070d]/40 px-4 pb-6 pt-16 backdrop-blur-sm sm:px-6 lg:px-8 lg:pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Good morning, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            Your knowledge space is ready. What would you like to explore today?
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onAddWebsite}
            className="h-10 rounded-xl border-white/10 bg-white/[0.03] px-4 text-sm font-medium hover:bg-white/[0.06]"
          >
            <Globe className="mr-1.5 h-4 w-4" />
            Add Website
          </Button>
          <Button
            variant="outline"
            onClick={onUploadPdf}
            className="h-10 rounded-xl border-white/10 bg-white/[0.03] px-4 text-sm font-medium hover:bg-white/[0.06]"
          >
            <FileUp className="mr-1.5 h-4 w-4" />
            Upload PDF
          </Button>
          <Button
            onClick={onNewWorkspace}
            className="btn-gradient-primary h-10 rounded-xl px-4 text-sm font-medium shadow-[0_8px_30px_rgba(71,123,255,0.3)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />+ New Workspace
          </Button>
        </div>
      </div>
    </header>
  );
}
