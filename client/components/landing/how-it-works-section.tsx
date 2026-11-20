import { Card } from "@/components/ui/card";

const steps = [
  {
    step: "01",
    title: "Add your sources",
    description:
      "Collect documents, notes, and other materials into a dedicated workspace.",
  },
  {
    step: "02",
    title: "Let AI organize and understand",
    description:
      "Your content is processed so it can be explored and connected intelligently.",
  },
  {
    step: "03",
    title: "Ask questions and explore",
    description:
      "Chat with your knowledge, surface insights, and follow ideas wherever they lead.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#42D8F5]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From sources to understanding in three steps
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((item, index) => (
            <Card
              key={item.step}
              className="relative border-white/10 bg-white/[0.02] p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium tracking-wider text-[#42D8F5]">
                  {item.step}
                </span>
                {index < steps.length - 1 && (
                  <span className="hidden h-px flex-1 bg-gradient-to-r from-white/10 to-transparent md:block" />
                )}
              </div>
              <h3 className="text-lg font-medium text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
