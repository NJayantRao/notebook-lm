"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/use-auth";
import { AuthLoading } from "@/components/auth/auth-loading";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return <AuthLoading label="Checking your session..." />;
  }

  if (!session) {
    return <AuthLoading label="Redirecting to sign in..." />;
  }

  return <>{children}</>;
}
