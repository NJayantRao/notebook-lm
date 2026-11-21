import type { Metadata } from "next";
import Link from "next/link";

import { SiteLogo } from "@/components/layout/site-logo";

export const metadata: Metadata = {
  title: "Privacy Policy — NotebookLM",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-[#05070d] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <SiteLogo />
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            NotebookLM stores the workspaces, sources and conversations you
            create so that the service can function. Uploaded files and imported
            URLs are processed only to generate source text and search results
            for your workspace.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Deleting a workspace or a source removes its associated data. You
            can sign out at any time to end your session.
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
