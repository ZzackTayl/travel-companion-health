import type { TravelCardModel } from "@/lib/travel-card";

interface TravelCardProps {
  model: TravelCardModel;
}

export function TravelCard({ model }: TravelCardProps) {
  return (
    <article className="travel-card rounded-2xl border border-cyan-300/40 bg-slate-950 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        Medication travel card
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{model.route}</h2>
      <p className="mt-1 text-sm text-slate-300">{model.dates}</p>
      <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
        <p className="font-semibold">{model.overallRisk}</p>
        <p className="mt-1 text-sm">
          Coverage: {model.completeness}. Missing guidance is not permission.
        </p>
      </div>
      <p className="mt-4 text-sm text-slate-300">
        {model.categories.length > 0
          ? `Categories checked: ${model.categories.join(", ")}`
          : "General route guidance only"}
      </p>
      <div className="mt-5 space-y-4">
        {model.jurisdictions.map((jurisdiction) => (
          <section key={`${jurisdiction.name}-${jurisdiction.context}`}>
            <h3 className="font-semibold text-white">{jurisdiction.name}</h3>
            <p className="text-xs text-slate-400">
              {jurisdiction.context} · {jurisdiction.risk}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {jurisdiction.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 text-xs leading-5 text-slate-400">
        Generated {model.generatedAt}
        {model.refreshAfter ? ` · Refresh before ${model.refreshAfter}` : ""}
      </p>
      <p className="mt-3 text-sm leading-6 text-amber-100">
        Informational preparation guidance only. Medication rules can change.
        Verify high-risk or unverified items with official authorities before
        travel.
      </p>
    </article>
  );
}
