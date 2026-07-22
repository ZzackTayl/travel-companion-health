import { guidanceRecords } from "@/data/guidance";
import { getSources, hasCompleteSourceEvidence } from "@/data/sources";
import {
  getDurationWarning,
  getTravelReferenceDate,
  getTripDuration,
} from "@/lib/dates";
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
  if (risks.length === 0) return "unknown";
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

const unknownAction =
  "Official guidance was not verified for this part of the route. Do not treat missing guidance as permission; check with the relevant government, customs, embassy, or airport authority before travel.";

function appliesOnDate(
  record: (typeof guidanceRecords)[number],
  referenceDate: string,
) {
  return (
    record.staleAfter > referenceDate &&
    (!record.effectiveFrom || record.effectiveFrom <= referenceDate) &&
    (!record.effectiveTo || record.effectiveTo >= referenceDate)
  );
}

function evaluateJurisdiction(
  jurisdiction: ResolvedJurisdiction,
  categories: MedicationCategory[],
  durationWarning: string | null,
  travelReferenceDate: string,
): JurisdictionGuidance {
  const availableRecords = guidanceRecords.filter(
    (record) =>
      record.jurisdictionId === jurisdiction.id &&
      record.status === "published" &&
      Boolean(record.lastReviewedAt) &&
      hasCompleteSourceEvidence(record.sourceIds) &&
      (!jurisdiction.transitOnly || record.appliesToTransit),
  );
  const records = availableRecords.filter((record) =>
    appliesOnDate(record, travelReferenceDate),
  );
  const generalRecords = records.filter(
    ({ medicationCategory }) => medicationCategory === null,
  );
  const requestedCategories = categories.filter(
    (category) => category !== "unknown",
  );
  const categoryRecords = records.filter(
    ({ medicationCategory }) =>
      medicationCategory !== null &&
      requestedCategories.includes(medicationCategory),
  );
  const missingCategories = requestedCategories.filter(
    (category) =>
      !categoryRecords.some(
        ({ medicationCategory }) => medicationCategory === category,
      ),
  );
  const includesUnknownCategory = categories.includes("unknown");
  const selectedRecords = [...generalRecords, ...categoryRecords];
  const coverageGaps: JurisdictionGuidance["coverageGaps"] = [];

  if (generalRecords.length === 0) {
    const hadGeneralRecord = availableRecords.some(
      ({ medicationCategory }) => medicationCategory === null,
    );
    coverageGaps.push({
      medicationCategory: null,
      reason: hadGeneralRecord
        ? "not_verified_for_travel_window"
        : jurisdiction.type === "airport_authority"
          ? "missing_airport_guidance"
          : "missing_general_guidance",
    });
  }

  for (const category of missingCategories) {
    const hadCategoryRecord = availableRecords.some(
      ({ medicationCategory }) => medicationCategory === category,
    );
    coverageGaps.push({
      medicationCategory: category,
      reason: hadCategoryRecord
        ? "not_verified_for_travel_window"
        : jurisdiction.type === "airport_authority"
          ? "missing_airport_guidance"
          : "missing_category_guidance",
    });
  }

  if (includesUnknownCategory) {
    coverageGaps.push({
      medicationCategory: "unknown",
      reason: "missing_category_guidance",
    });
  }

  const sourceIds = [
    ...new Set(selectedRecords.flatMap((record) => record.sourceIds)),
  ];
  const actions = [
    ...new Set(selectedRecords.map((record) => record.actionText)),
  ];
  if (coverageGaps.length > 0) actions.push(unknownAction);
  if (durationWarning && jurisdiction.type === "country") {
    actions.push(durationWarning);
  }

  return {
    jurisdictionId: jurisdiction.id,
    jurisdictionType: jurisdiction.type,
    name: jurisdiction.name,
    countryCode: jurisdiction.countryCode,
    airportCodes: jurisdiction.airportCodes,
    roles: jurisdiction.roles,
    transitOnly: jurisdiction.transitOnly,
    riskLabel: aggregateRisk([
      ...selectedRecords.map((record) => record.riskLabel),
      ...(coverageGaps.length > 0 ? (["unknown"] as const) : []),
    ]),
    coverageStatus:
      selectedRecords.length === 0
        ? "unknown"
        : coverageGaps.length > 0
          ? "partial"
          : "covered",
    coverageGaps,
    actions,
    confidence: lowestConfidence([
      ...selectedRecords.map((record) => record.confidence),
      ...(coverageGaps.length > 0 ? (["unknown"] as const) : []),
    ]),
    lastReviewedAt:
      selectedRecords
        .map((record) => record.lastReviewedAt)
        .sort((left, right) => left.localeCompare(right))[0] ?? "",
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
  now = new Date(),
): GuidanceEvaluation {
  const route = resolveRoute(input.routeStopIds);
  const durationDays = getTripDuration(input.departureDate, input.returnDate);
  const durationWarning = getDurationWarning(durationDays);
  const travelReferenceDate = getTravelReferenceDate(
    input.departureDate,
    input.returnDate,
    now,
  );
  const jurisdictions = route.jurisdictions.map((jurisdiction) =>
    evaluateJurisdiction(
      jurisdiction,
      input.medicationCategories,
      durationWarning,
      travelReferenceDate,
    ),
  );
  const refreshAfter =
    guidanceRecords
      .map(({ staleAfter }) => staleAfter)
      .filter((date) => date > now.toISOString().slice(0, 10))
      .sort()[0] ?? null;

  return {
    contractVersion: 2,
    generatedAt: now.toISOString(),
    refreshAfter,
    completeness: "partial",
    dataProvenance: {
      mode: "prototype_fixture",
      productionEligible: false,
    },
    overallRisk: aggregateRisk(jurisdictions.map(({ riskLabel }) => riskLabel)),
    durationDays,
    durationWarning,
    route,
    jurisdictions,
  };
}
