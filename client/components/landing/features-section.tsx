import { BookOpen, MessageSquareText, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Bring Everything Together",
    description:
      "Upload documents, add text, Markdown, websites and other knowledge sources into a single workspace.",
    icon: BookOpen,
  },
  {
    title: "Ask Anything",
    description:
      "Interact with your collected knowledge using AI-powered conversations that understand your context.",
    icon: MessageSquareText,
  },
  {
    title: "Discover Insights",
    description:
      "Get contextual answers grounded in your own sources, so you can explore ideas with confidence.",
    icon: Sparkles,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#42D8F5]">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need to understand your knowledge
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            A focused workspace that turns scattered information into connected,
            explorable insight.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group relative overflow-hidden border-white/10 bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(71,123,255,0.18),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#477BFF]/20 to-[#42D8F5]/10 text-[#42D8F5]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
