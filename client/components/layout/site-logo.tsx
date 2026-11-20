import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteLogo({
  href = "/",
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 font-semibold tracking-tight text-foreground",
        className
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#477BFF]/30 to-[#42D8F5]/20 shadow-[0_0_30px_rgba(71,123,255,0.25)]">
        <Sparkles className="h-4 w-4 text-[#42D8F5]" />
      </span>
      {!compact && <span className="text-sm sm:text-base">NotebookLM</span>}
    </Link>
  );
}
