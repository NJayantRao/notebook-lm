import { FolderKanban, FileText, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function OverviewCards({
  totalWorkspaces,
  totalSources,
  processedSources,
  loading,
}: {
  totalWorkspaces: number;
  totalSources: number;
  processedSources: number;
  loading?: boolean;
}) {
  const cards = [
    {
      label: "Total Workspaces",
      value: totalWorkspaces,
      icon: FolderKanban,
      accent: "from-[#477BFF]/20 to-[#477BFF]/5",
      iconColor: "text-[#7aa2ff]",
    },
    {
      label: "Total Sources",
      value: totalSources,
      icon: FileText,
      accent: "from-[#42D8F5]/20 to-[#42D8F5]/5",
      iconColor: "text-[#42D8F5]",
      hint: "Across loaded workspaces",
    },
    {
      label: "Processed Sources",
      value: processedSources,
      icon: CheckCircle2,
      accent: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400",
      hint: "Ready for insights",
    },
  ];

  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className="relative overflow-hidden border-white/10 bg-white/[0.02] p-5"
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${card.accent} blur-2xl`}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {loading ? "—" : card.value}
                  </p>
                  {card.hint && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {card.hint}
                    </p>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
