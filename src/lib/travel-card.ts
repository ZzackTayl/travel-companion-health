import type {
  GuidanceEvaluation,
  MedicationCategory,
  RiskLabel,
} from "@/lib/domain";
import type { LocalMedicine } from "@/lib/saved-trips";

const riskLabels: Record<RiskLabel, string> = {
  likely_ok: "Likely OK",
  check_documentation: "Check documentation",
  prior_permission_may_be_required: "Prior permission may be required",
  high_risk: "High risk — verify before travel",
  unknown: "Not yet verified",
};

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

export interface TravelCardModel {
  route: string;
  dates: string;
  overallRisk: string;
  completeness: GuidanceEvaluation["completeness"];
  generatedAt: string;
  refreshAfter: string | null;
  categories: string[];
  jurisdictions: Array<{
    name: string;
    context: string;
    risk: string;
    actions: string[];
    sources: Array<{ title: string; url: string }>;
  }>;
}

export function buildTravelCardModel(
  evaluation: GuidanceEvaluation,
  departureDate: string,
  returnDate: string,
  medicines: LocalMedicine[],
): TravelCardModel {
  const categories = [
    ...new Set(medicines.flatMap(({ categories: values }) => values)),
  ] as MedicationCategory[];

  return {
    route: evaluation.route.stops.map(({ iataCode }) => iataCode).join(" → "),
    dates: departureDate
      ? returnDate
        ? `${departureDate} to ${returnDate}`
        : `Departing ${departureDate}`
      : "Travel dates not provided",
    overallRisk: riskLabels[evaluation.overallRisk],
    completeness: evaluation.completeness,
    generatedAt: evaluation.generatedAt,
    refreshAfter: evaluation.refreshAfter,
    categories: categories.map(humanize),
    jurisdictions: evaluation.jurisdictions.map((jurisdiction) => ({
      name: jurisdiction.name,
      context: [
        jurisdiction.jurisdictionType === "airport_authority"
          ? "Airport screening"
          : "Country guidance",
        ...jurisdiction.roles.map(humanize),
        jurisdiction.coverageStatus !== "covered"
          ? `${jurisdiction.coverageStatus} coverage`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      risk: riskLabels[jurisdiction.riskLabel],
      actions: jurisdiction.actions,
      sources: jurisdiction.sources.map(({ title, url }) => ({ title, url })),
    })),
  };
}

export function formatTravelCardPlainText(model: TravelCardModel) {
  const lines = [
    "Medication travel card",
    model.route,
    model.dates,
    `Overall result: ${model.overallRisk}`,
    `Coverage: ${model.completeness}`,
    model.categories.length > 0
      ? `Medicine categories: ${model.categories.join(", ")}`
      : "Medicine categories: general guidance only",
    "",
  ];

  for (const jurisdiction of model.jurisdictions) {
    lines.push(
      jurisdiction.name,
      `${jurisdiction.context} · ${jurisdiction.risk}`,
      ...jurisdiction.actions.map((action) => `- ${action}`),
    );
    if (jurisdiction.sources.length > 0) {
      lines.push(
        ...jurisdiction.sources.map(
          ({ title, url }) => `Source: ${title} — ${url}`,
        ),
      );
    }
    lines.push("");
  }

  lines.push(
    `Generated ${model.generatedAt}`,
    model.refreshAfter
      ? `Refresh before ${model.refreshAfter}`
      : "Refresh before relying on this card",
    "Informational preparation guidance only. Medication rules can change. Verify high-risk or unverified items with official authorities before travel.",
  );
  return lines.join("\n");
}
