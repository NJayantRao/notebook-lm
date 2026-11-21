import type { Metadata } from "next";
import Link from "next/link";

import { SiteLogo } from "@/components/layout/site-logo";

export const metadata: Metadata = {
  title: "Terms of Service — NotebookLM",
};

export default function TermsPage() {
  return (
    <main className="flex-1 bg-[#05070d] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <SiteLogo />
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            NotebookLM is provided as-is for personal knowledge exploration.
            Answers are generated from your sources and may be inaccurate, so
            please verify important information before relying on it.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You are responsible for the content you upload and for complying
            with the terms of any third-party services whose links you add to a
            workspace.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex text-sm text-[#42D8F5] transition-colors hover:text-foreground"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
