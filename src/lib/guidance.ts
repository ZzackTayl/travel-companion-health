import { guidanceRecords } from "@/data/guidance";
import { getSources, hasCompleteSourceEvidence } from "@/data/sources";
import { getDurationWarning, getTripDuration } from "@/lib/dates";
import type {
  Confidence,
  GuidanceEvaluation,
  JurisdictionGuidance,
  MedicationCategory,
  ResolvedJurisdiction,
  RiskLabel,
} from "@/lib/domain";
import { resolveRoute } from "@/lib/routes";

const riskWeight: Record<RiskLabel, number> = {
  likely_ok: 0,
  check_documentation: 1,
  prior_permission_may_be_required: 2,
  unknown: 3,
  high_risk: 4,
};

const confidenceWeight: Record<Confidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  official_verified: 4,
};

export function aggregateRisk(risks: RiskLabel[]): RiskLabel {
  return risks.reduce<RiskLabel>(
    (highest, risk) =>
      riskWeight[risk] > riskWeight[highest] ? risk : highest,
    "likely_ok",
  );
}

function lowestConfidence(confidences: Confidence[]) {
  return confidences.reduce<Confidence>(
    (lowest, confidence) =>
      confidenceWeight[confidence] < confidenceWeight[lowest]
        ? confidence
        : lowest,
    "official_verified",
  );
}

function evaluateJurisdiction(
  jurisdiction: ResolvedJurisdiction,
  categories: MedicationCategory[],
  durationWarning: string | null,
): JurisdictionGuidance | null {
  const records = guidanceRecords.filter(
    (record) =>
      record.jurisdictionId === jurisdiction.id &&
      record.status === "published" &&
      Boolean(record.lastReviewedAt) &&
      hasCompleteSourceEvidence(record.sourceIds) &&
      (!jurisdiction.transitOnly || record.appliesToTransit) &&
      (record.medicationCategory === null ||
        categories.includes(record.medicationCategory)),
  );

  if (records.length === 0) {
    if (jurisdiction.type === "airport_authority") return null;
    return {
      jurisdictionId: jurisdiction.id,
      name: jurisdiction.name,
      countryCode: jurisdiction.countryCode,
      airportCodes: jurisdiction.airportCodes,
      roles: jurisdiction.roles,
      transitOnly: jurisdiction.transitOnly,
      riskLabel: "unknown",
      actions: ["Check current official requirements before departure."],
      confidence: "unknown",
      lastReviewedAt: "",
      sources: [],
    };
  }

  const includesUnknownCategory = categories.includes("unknown");
  const sourceIds = [...new Set(records.flatMap((record) => record.sourceIds))];
  const actions = [...new Set(records.map((record) => record.actionText))];
  if (includesUnknownCategory) {
    actions.push(
      "The medicine category is uncertain; verify it against current official requirements.",
    );
  }
  if (durationWarning && jurisdiction.type === "country")
    actions.push(durationWarning);

  return {
    jurisdictionId: jurisdiction.id,
    name: jurisdiction.name,
    countryCode: jurisdiction.countryCode,
    airportCodes: jurisdiction.airportCodes,
    roles: jurisdiction.roles,
    transitOnly: jurisdiction.transitOnly,
    riskLabel: aggregateRisk([
      ...records.map((record) => record.riskLabel),
      ...(includesUnknownCategory ? (["unknown"] as const) : []),
    ]),
    actions,
    confidence: lowestConfidence([
      ...records.map((record) => record.confidence),
      ...(includesUnknownCategory ? (["unknown"] as const) : []),
    ]),
    lastReviewedAt: records
      .map((record) => record.lastReviewedAt)
      .sort((left, right) => left.localeCompare(right))[0],
    sources: getSources(sourceIds),
  };
}

interface EvaluateGuidanceInput {
  routeStopIds: string[];
  departureDate?: string;
  returnDate?: string;
  medicationCategories: MedicationCategory[];
}

export function evaluateGuidance(
  input: EvaluateGuidanceInput,
): GuidanceEvaluation {
  const route = resolveRoute(input.routeStopIds);
  const durationDays = getTripDuration(input.departureDate, input.returnDate);
  const durationWarning = getDurationWarning(durationDays);
  const jurisdictions = route.jurisdictions.flatMap((jurisdiction) => {
    const result = evaluateJurisdiction(
      jurisdiction,
      input.medicationCategories,
      durationWarning,
    );
    return result ? [result] : [];
  });

  return {
    overallRisk: aggregateRisk(jurisdictions.map(({ riskLabel }) => riskLabel)),
    durationDays,
    durationWarning,
    route,
    jurisdictions,
  };
}
