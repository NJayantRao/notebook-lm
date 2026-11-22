"use client";

import { useState } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SiteLogo } from "@/components/layout/site-logo";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex h-dvh min-h-0 items-center justify-center bg-[#efefed] p-4 sm:p-6 dark:bg-[#151413]">
      <div className="grid h-full max-h-[680px] w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(30,30,30,0.14)] lg:grid-cols-[1.08fr_0.92fr] dark:bg-[#1f1e1c] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="relative hidden overflow-hidden bg-[#171718] text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(251,146,60,0.24),transparent_24%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.09),transparent_30%)]" />
          <div className="relative flex h-full flex-col px-10 py-8 xl:px-12">
            <SiteLogo
              href="/"
              className="text-white [&_span:first-child]:border-orange-300/20 [&_span:first-child]:bg-orange-500/20 [&_span:first-child]:shadow-none"
            />
            <div className="my-auto max-w-[480px]">
              <p className="mb-7 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Personal AI knowledge space
              </p>
              <h1 className="text-[58px] font-semibold leading-[1.02] tracking-[-0.04em]">
                Understand
                <br />
                <span className="text-orange-400">everything.</span>
              </h1>
              <p className="mt-7 max-w-[420px] text-lg leading-7 text-white/60">
                Bring your documents, notes, websites and videos together.
                Ask grounded questions and discover insights across all of
                your knowledge.
              </p>
            </div>
            <span className="text-xs text-white/35">© 2026 NotebookLM</span>
          </div>
        </div>

        <div className="flex h-full flex-col bg-white px-6 py-7 text-[#171719] sm:px-10 lg:px-12 dark:bg-[#1f1e1c] dark:text-[#f5f3ef]">
          <div className="flex items-center justify-between lg:justify-end lg:gap-2">
            <SiteLogo
              href="/"
              className="text-[#171719] lg:hidden [&_span:first-child]:border-orange-200 [&_span:first-child]:bg-orange-50 [&_span:first-child]:shadow-none dark:text-white"
            />
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7e5e2] text-[#77736d] transition-colors hover:border-[#cbc7c1] hover:text-[#171719] dark:border-white/10 dark:text-[#c7c2bb] dark:hover:border-white/20 dark:hover:text-white"
            >
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
            </button>
            <Link
              href="/"
              className="rounded-full border border-[#e7e5e2] px-4 py-2 text-xs font-medium text-[#5f5d59] transition-colors hover:border-[#cbc7c1] hover:text-[#171719] dark:border-white/10 dark:text-[#c7c2bb] dark:hover:border-white/20 dark:hover:text-white"
            >
              ← Home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
              Welcome
            </p>
            <h2 className="text-4xl font-semibold tracking-[-0.04em]">Sign in</h2>
            <p className="mt-3 text-sm leading-6 text-[#77736d] dark:text-[#aaa59d]">
              Continue with Google to open your personal knowledge workspace.
            </p>

            <div className="mt-8 space-y-4">
              <GoogleSignInButton
                onError={setError}
                className="h-12 rounded-xl border-[#dedbd5] bg-white text-[#242321] shadow-[0_8px_24px_rgba(30,30,30,0.06)] hover:bg-[#faf9f7] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:shadow-none dark:hover:bg-white/[0.07]"
              />
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#aaa59d]">
            <span>© 2026 NotebookLM</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-[#5f5d59]">Privacy</Link>
              <Link href="/terms" className="hover:text-[#5f5d59]">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
