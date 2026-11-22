"use client";

import Link from "next/link";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SiteLogo } from "@/components/layout/site-logo";

export function HeroSection() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <section className="flex h-dvh min-h-0 items-center justify-center p-4 sm:p-6">
      <div className="grid h-full max-h-[680px] w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(30,30,30,0.14)] lg:grid-cols-[1.08fr_0.92fr] dark:bg-[#1f1e1c] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="relative hidden overflow-hidden bg-[#171718] text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(251,146,60,0.24),transparent_24%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.09),transparent_30%)]" />
          <div className="absolute left-[-80px] top-[-90px] h-72 w-72 rounded-full border border-white/[0.06]" />
          <div className="absolute bottom-[-100px] right-[-60px] h-72 w-72 rounded-full bg-orange-500/[0.07] blur-2xl" />

          <div className="relative flex h-full flex-col px-10 py-8 xl:px-12">
            <SiteLogo
              href="/"
              className="text-white [&_span:first-child]:border-orange-300/20 [&_span:first-child]:bg-orange-500/20 [&_span:first-child]:shadow-none"
            />

            <div className="my-auto max-w-[480px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
                <Sparkles className="h-3.5 w-3.5 text-orange-300" />
                Personal AI knowledge space
              </div>
              <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.04em] xl:text-[58px]">
                Understand
                <br />
                <span className="text-orange-400">everything.</span>
              </h1>
              <p className="mt-7 max-w-[420px] text-base leading-7 text-white/60 xl:text-lg">
                Bring your documents, notes, websites and videos together.
                Ask grounded questions and discover insights across all of
                your knowledge.
              </p>
              <div className="mt-9 flex items-center gap-5 text-sm text-white/65">
                {["Sources", "Answers", "Insights"].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/35">
              <span>NotebookLM</span>
              <span>© 2026</span>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col bg-white px-6 py-7 text-[#171719] sm:px-10 lg:px-12 dark:bg-[#1f1e1c] dark:text-[#f5f3ef]">
          <div className="flex items-center justify-between lg:justify-end lg:gap-2">
            <SiteLogo
              href="/"
              className="text-[#171719] lg:hidden [&_span:first-child]:border-orange-200 [&_span:first-child]:bg-orange-50 [&_span:first-child]:shadow-none"
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
              href="/login"
              className="rounded-full border border-[#e7e5e2] px-4 py-2 text-xs font-medium text-[#5f5d59] transition-colors hover:border-[#cbc7c1] hover:text-[#171719] dark:border-white/10 dark:text-[#c7c2bb] dark:hover:border-white/20 dark:hover:text-white"
            >
              Sign in
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
              Welcome
            </p>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-[#171719] dark:text-[#f5f3ef]">
              Sign in
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#77736d] dark:text-[#aaa59d]">
              Continue with Google to open your personal knowledge workspace.
            </p>

            <div className="mt-8">
              <GoogleSignInButton
                className="h-12 rounded-xl border-[#dedbd5] bg-white text-[#242321] shadow-[0_8px_24px_rgba(30,30,30,0.06)] hover:bg-[#faf9f7] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:shadow-none dark:hover:bg-white/[0.07]"
              />
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs text-[#aaa59d]">
              <span className="h-px flex-1 bg-[#eeece8]" />
              Secure Google sign-in
              <span className="h-px flex-1 bg-[#eeece8]" />
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
    </section>
  );
}
