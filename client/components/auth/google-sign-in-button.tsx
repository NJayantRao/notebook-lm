"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/api";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M21.805 10.023H12.18v3.955h5.49c-.236 1.26-.95 2.327-2.024 3.043v2.53h3.276c1.917-1.765 3.023-4.365 3.023-7.455 0-.72-.064-1.412-.18-2.073z"
        fill="#4285F4"
      />
      <path
        d="M12.18 21.8c2.754 0 5.064-.913 6.742-2.469l-3.276-2.53c-.908.609-2.07.969-3.466.969-2.665 0-4.922-1.8-5.727-4.219H3.07v2.612A9.997 9.997 0 0 0 12.18 21.8z"
        fill="#34A853"
      />
      <path
        d="M6.453 13.551A6.01 6.01 0 0 1 6.14 11.8c0-.607.105-1.197.313-1.751V7.437H3.07A9.997 9.997 0 0 0 2 11.8c0 1.614.386 3.142 1.07 4.363l3.383-2.612z"
        fill="#FBBC05"
      />
      <path
        d="M12.18 5.83c1.498 0 2.842.515 3.9 1.526l2.926-2.926C17.24 2.79 14.93 1.8 12.18 1.8A9.997 9.997 0 0 0 3.07 7.437l3.383 2.612c.805-2.419 3.062-4.219 5.727-4.219z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
      });
      if (error) {
        onError?.(error.message || "Unable to start Google sign-in.");
        setLoading(false);
      }
      // On success Better Auth will redirect; keep loading state.
    } catch (err) {
      onError?.(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full justify-center gap-3 rounded-xl border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
      onClick={handleGoogle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <GoogleIcon className="h-4 w-4" />
      )}
      Continue with Google
    </Button>
  );
}
