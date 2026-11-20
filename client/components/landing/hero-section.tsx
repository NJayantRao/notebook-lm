import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-120px] h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(71,123,255,0.28),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-[#42D8F5]">
            <Sparkles className="h-3.5 w-3.5" />
            YOUR PERSONAL AI KNOWLEDGE SPACE
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your knowledge. Connected.{" "}
            <span className="text-gradient-primary">Understood.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Bring your documents, notes, websites and videos together. Ask
            questions, explore ideas and discover insights through AI-powered
            conversations grounded in your sources.
          </p>

          <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="btn-gradient-primary h-11 w-full rounded-full px-6 text-sm font-medium shadow-[0_10px_40px_rgba(71,123,255,0.35)] sm:w-auto">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-11 w-full rounded-full border-white/10 bg-white/[0.02] px-6 text-sm hover:bg-white/[0.06] sm:w-auto"
              >
                Explore Features
              </Button>
            </a>
          </div>
        </div>

        <div className="pointer-events-none mx-auto mt-16 max-w-4xl sm:mt-20">
          <div className="glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-6">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(66,216,245,0.18),transparent_60%)]" />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Sources connected", value: "Documents, notes, web" },
                { label: "Grounded answers", value: "Cited to your knowledge" },
                { label: "Instant insights", value: "Ask, explore, understand" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/80">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
