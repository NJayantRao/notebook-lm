"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-auth-radial px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(71,123,255,0.25),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="glass-panel rounded-2xl p-6 sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <SiteLogo className="mb-6" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with Google to continue exploring your knowledge.
            </p>
          </div>

          <div className="space-y-5">
            <GoogleSignInButton onError={setError} />

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
              >
                {error}
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
