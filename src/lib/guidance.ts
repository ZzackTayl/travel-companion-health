import { guidanceRecords, type GuidanceRecord } from "@/data/guidance";
import { getSources, hasCompleteSourceEvidence } from "@/data/sources";
import { getDurationWarning, getTripDuration } from "@/lib/dates";
import {
  medicationCategoryLabels,
  type Confidence,
  type GuidanceEvaluation,
  type GuidanceItem,
  type GuidanceType,
  type JurisdictionGuidance,
  type MedicationCategory,
  type ResolvedJurisdiction,
  type RiskLabel,
  type RouteRole,
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

function isEligibleRecord(record: GuidanceRecord, routeRole: RouteRole) {
  return (
    record.status === "published" &&
    Boolean(record.lastReviewedAt) &&
    hasCompleteSourceEvidence(record.sourceIds) &&
    (routeRole !== "transit" || record.appliesToTransit)
  );
}

function recordsByType(records: GuidanceRecord[]) {
  return records.reduce<Map<GuidanceType, GuidanceRecord[]>>(
    (groups, record) => {
      const group = groups.get(record.guidanceType) ?? [];
      group.push(record);
      groups.set(record.guidanceType, group);
      return groups;
    },
    new Map(),
  );
}

function itemFromRecords(
  records: GuidanceRecord[],
  medicationCategory: MedicationCategory | null,
  guidanceType: GuidanceType,
  routeRole: RouteRole,
  durationWarning: string | null,
): GuidanceItem {
  const sourceIds = [...new Set(records.flatMap((record) => record.sourceIds))];
  const actions = [...new Set(records.map((record) => record.actionText))];
  if (durationWarning && medicationCategory === null) {
    actions.push(durationWarning);
  }

  return {
    medicationCategory,
    guidanceType,
    routeRole,
    riskLabel: aggregateRisk(records.map((record) => record.riskLabel)),
    actions,
    confidence: lowestConfidence(records.map((record) => record.confidence)),
    lastReviewedAt: records
      .map((record) => record.lastReviewedAt)
      .sort((left, right) => left.localeCompare(right))[0],
    sources: getSources(sourceIds),
    isFallback: false,
  };
}

function unknownCategoryItem(
  category: MedicationCategory,
  guidanceType: GuidanceType,
  routeRole: RouteRole,
): GuidanceItem {
  const categoryLabel = medicationCategoryLabels[category];
  const typeLabel = guidanceType.replaceAll("_", " ");
  return {
    medicationCategory: category,
    guidanceType,
    routeRole,
    riskLabel: "unknown",
    actions: [
      `Official ${typeLabel} guidance for ${categoryLabel.toLocaleLowerCase()} has not been verified for this ${routeRole} jurisdiction. Do not treat missing guidance as permission.`,
      "Check with an official government, customs, embassy, or airport authority before travel.",
    ],
    confidence: "unknown",
    lastReviewedAt: "",
    sources: [],
    isFallback: true,
  };
}

function requiredCategoryGuidanceType(
  jurisdiction: ResolvedJurisdiction,
): GuidanceType {
  return jurisdiction.type === "country" ? "restricted" : "screening";
}

function evaluateGeneralGuidance(
  jurisdictionRecords: GuidanceRecord[],
  routeRole: RouteRole,
  durationWarning: string | null,
) {
  return [
    ...recordsByType(
      jurisdictionRecords.filter(
        (record) => record.medicationCategory === null,
      ),
    ),
  ].map(([guidanceType, records]) =>
    itemFromRecords(records, null, guidanceType, routeRole, durationWarning),
  );
}

function evaluateCategoryGuidance(
  jurisdiction: ResolvedJurisdiction,
  jurisdictionRecords: GuidanceRecord[],
  category: MedicationCategory,
  routeRole: RouteRole,
) {
  const requiredType = requiredCategoryGuidanceType(jurisdiction);
  const records = jurisdictionRecords.filter(
    (record) =>
      record.medicationCategory === category &&
      record.guidanceType !== "general",
  );
  const groupedRecords = recordsByType(records);
  const guidanceTypes = [
    requiredType,
    ...[...groupedRecords.keys()].filter(
      (guidanceType) => guidanceType !== requiredType,
    ),
  ];

  return guidanceTypes.map((guidanceType) => {
    const matchingRecords = groupedRecords.get(guidanceType);
    return matchingRecords
      ? itemFromRecords(
          matchingRecords,
          category,
          guidanceType,
          routeRole,
          null,
        )
      : unknownCategoryItem(category, guidanceType, routeRole);
  });
}

function evaluateJurisdiction(
  jurisdiction: ResolvedJurisdiction,
  categories: MedicationCategory[],
  durationWarning: string | null,
): JurisdictionGuidance | null {
  const generalGuidance: GuidanceItem[] = [];
  const categoryGuidance: GuidanceItem[] = [];

  for (const routeRole of jurisdiction.roles) {
    const jurisdictionRecords = guidanceRecords.filter(
      (record) =>
        record.jurisdictionId === jurisdiction.id &&
        isEligibleRecord(record, routeRole),
    );

    generalGuidance.push(
      ...evaluateGeneralGuidance(
        jurisdictionRecords,
        routeRole,
        jurisdiction.type === "country" ? durationWarning : null,
      ),
    );
    for (const category of categories) {
      categoryGuidance.push(
        ...evaluateCategoryGuidance(
          jurisdiction,
          jurisdictionRecords,
          category,
          routeRole,
        ),
      );
    }
  }

  const items = [...generalGuidance, ...categoryGuidance];
  if (items.length === 0) return null;

  return {
    jurisdictionId: jurisdiction.id,
    name: jurisdiction.name,
    countryCode: jurisdiction.countryCode,
    airportCodes: jurisdiction.airportCodes,
    roles: jurisdiction.roles,
    transitOnly: jurisdiction.transitOnly,
    riskLabel: aggregateRisk(items.map((item) => item.riskLabel)),
    confidence: lowestConfidence(items.map((item) => item.confidence)),
    generalGuidance,
    categoryGuidance,
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
  const categories = [...new Set(input.medicationCategories)];
  const jurisdictions = route.jurisdictions.flatMap((jurisdiction) => {
    const result = evaluateJurisdiction(
      jurisdiction,
      categories,
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
