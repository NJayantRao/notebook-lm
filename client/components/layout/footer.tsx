import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#05070d]/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-md space-y-3">
          <SiteLogo />
          <p className="text-sm leading-relaxed text-muted-foreground">
            A personal AI knowledge space to bring your sources together and
            discover insights through grounded conversations.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="/privacy"
            className="transition-colors hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
      <div className="border-t border-white/5 py-4">
        <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground/70 sm:px-6 lg:px-8">
          © 2026 NotebookLM. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
