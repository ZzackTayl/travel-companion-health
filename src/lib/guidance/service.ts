import {
  auditLaunchCoverage,
  createUnknownFallback,
  isPubliclyEligible,
  isStale,
  validateForPublication,
} from "./governance";
import { getTripDuration } from "@/lib/dates";
import type {
  Confidence,
  GuidanceCoverageItem,
  GuidanceCoverageReason,
  GuidanceCoverageSummary,
  GuidanceEvaluation,
  GuidanceItem,
  MedicationCategory,
  ResolvedJurisdiction,
  RiskLabel,
  RouteRole,
  SourceReference,
} from "@/lib/domain";
import { resolveRoute } from "@/lib/routes";
import type {
  CoverageResult,
  GuidanceRecord,
  GuidanceType,
  LaunchCoverageRequirement,
  PublicGuidanceRecord,
  PublicGuidanceRequirement,
} from "./types";

export interface GuidanceRepository {
  getGuidanceForCoverage(
    requirements: LaunchCoverageRequirement[],
  ): Promise<GuidanceRecord[]>;
  savePublished(record: GuidanceRecord): Promise<void>;
  listLaunchCoverageRequirements(): Promise<LaunchCoverageRequirement[]>;
}

export interface PublicGuidanceRepository {
  getGuidanceForRoute(
    requirements: PublicGuidanceRequirement[],
  ): Promise<PublicGuidanceRecord[]>;
}

export class PublicationRejectedError extends Error {
  constructor(readonly validationErrors: string[]) {
    super(`Guidance cannot be published: ${validationErrors.join("; ")}`);
    this.name = "PublicationRejectedError";
  }
}

export async function publishGuidance(
  repository: GuidanceRepository,
  record: GuidanceRecord,
  now = new Date(),
) {
  const candidate = {
    ...record,
    status: "published" as const,
    reviewedForPublication: true,
  };
  const validation = validateForPublication(candidate, now);
  if (!validation.valid) {
    throw new PublicationRejectedError(validation.errors);
  }

  await repository.savePublished(candidate);
  return candidate;
}

export async function getLaunchCoverage(
  repository: GuidanceRepository,
  now = new Date(),
): Promise<CoverageResult[]> {
  const requirements = await repository.listLaunchCoverageRequirements();
  const records = await repository.getGuidanceForCoverage(requirements);
  return auditLaunchCoverage(requirements, records, now);
}

export class GuidanceUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Governed guidance is temporarily unavailable", options);
    this.name = "GuidanceUnavailableError";
  }
}

export interface EvaluateGuidanceInput {
  routeStopIds: string[];
  departureDate?: string;
  returnDate?: string;
  medicationCategories: MedicationCategory[];
}

interface EvaluationRequirement {
  id: string;
  jurisdiction: ResolvedJurisdiction;
  medicationCategory: MedicationCategory | null;
  guidanceType: GuidanceType;
  routeRole: RouteRole;
}

interface RequirementResult {
  requirement: EvaluationRequirement;
  record: PublicGuidanceRecord | null;
  actions: string[];
  riskLabel: RiskLabel;
  confidence: Confidence;
  coverage: GuidanceCoverageItem;
}

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

function requirementId(
  jurisdiction: ResolvedJurisdiction,
  guidanceType: GuidanceType,
  medicationCategory: MedicationCategory | null,
  routeRole: RouteRole,
) {
  return [
    jurisdiction.type,
    jurisdiction.code,
    guidanceType,
    medicationCategory ?? "all",
    routeRole,
  ].join(":");
}

function addRequirement(
  requirements: EvaluationRequirement[],
  jurisdiction: ResolvedJurisdiction,
  guidanceType: GuidanceType,
  routeRole: RouteRole,
  medicationCategory: MedicationCategory | null = null,
) {
  requirements.push({
    id: requirementId(
      jurisdiction,
      guidanceType,
      medicationCategory,
      routeRole,
    ),
    jurisdiction,
    medicationCategory,
    guidanceType,
    routeRole,
  });
}

function buildRequirements(
  jurisdictions: ResolvedJurisdiction[],
  categories: MedicationCategory[],
  durationDays: number | null,
) {
  const requirements: EvaluationRequirement[] = [];

  for (const jurisdiction of jurisdictions) {
    for (const routeRole of jurisdiction.roles) {
      if (jurisdiction.type === "country") {
        addRequirement(requirements, jurisdiction, "general", routeRole);
        addRequirement(requirements, jurisdiction, "documentation", routeRole);
        addRequirement(requirements, jurisdiction, "packaging", routeRole);
        for (const category of new Set(categories)) {
          addRequirement(
            requirements,
            jurisdiction,
            "restricted",
            routeRole,
            category,
          );
        }
        if (durationDays !== null && durationDays > 30) {
          addRequirement(
            requirements,
            jurisdiction,
            "quantity_limit",
            routeRole,
          );
        }
        continue;
      }

      addRequirement(requirements, jurisdiction, "screening", routeRole);
      for (const category of new Set(categories)) {
        addRequirement(
          requirements,
          jurisdiction,
          "screening",
          routeRole,
          category,
        );
      }
      if (routeRole === "transit") {
        addRequirement(requirements, jurisdiction, "transit", routeRole);
      }
    }
  }

  return requirements;
}

function matchesRequirement(
  record: PublicGuidanceRecord,
  requirement: EvaluationRequirement,
) {
  return (
    record.jurisdictionType === requirement.jurisdiction.type &&
    record.jurisdictionCode === requirement.jurisdiction.code &&
    record.medicationCategorySlug === requirement.medicationCategory &&
    record.guidanceType === requirement.guidanceType &&
    (requirement.routeRole !== "transit" || record.appliesToTransit)
  );
}

function coverageFailureReason(
  candidates: PublicGuidanceRecord[],
  now: Date,
): Exclude<GuidanceCoverageReason, "covered"> {
  if (candidates.length === 0) return "missing_or_ineligible";
  if (candidates.some((record) => isStale(record, now))) return "stale";

  const currentDate = now.toISOString().slice(0, 10);
  if (
    candidates.some((record) => {
      const effectiveFrom = record.effectiveFrom?.toISOString().slice(0, 10);
      const effectiveTo = record.effectiveTo?.toISOString().slice(0, 10);
      return (
        (effectiveFrom !== undefined && effectiveFrom > currentDate) ||
        (effectiveTo !== undefined && effectiveTo < currentDate)
      );
    })
  ) {
    return "not_effective";
  }

  if (candidates.some((record) => record.status !== "published")) {
    return "unpublished";
  }
  return "invalid_evidence";
}

function evaluateRequirement(
  requirement: EvaluationRequirement,
  records: PublicGuidanceRecord[],
  now: Date,
): RequirementResult {
  const candidates = records.filter((record) =>
    matchesRequirement(record, requirement),
  );
  const record =
    candidates.find((candidate) => isPubliclyEligible(candidate, now)) ?? null;

  if (!record) {
    const fallback = createUnknownFallback({
      jurisdictionId: requirement.jurisdiction.id,
      medicationCategoryId: requirement.medicationCategory,
      guidanceType: requirement.guidanceType,
    });
    const reason = coverageFailureReason(candidates, now);
    return {
      requirement,
      record: null,
      actions: [fallback.summary, fallback.actionText],
      riskLabel: fallback.riskLabel,
      confidence: fallback.confidence,
      coverage: {
        id: requirement.id,
        jurisdictionId: requirement.jurisdiction.id,
        medicationCategory: requirement.medicationCategory,
        guidanceType: requirement.guidanceType,
        status: "unknown",
        reason,
        revisionId: null,
        lastReviewedAt: null,
        staleAfter: null,
        effectiveFrom: null,
        effectiveTo: null,
      },
    };
  }

  return {
    requirement,
    record,
    actions: [record.actionText],
    riskLabel: record.riskLabel,
    confidence: record.confidence,
    coverage: {
      id: requirement.id,
      jurisdictionId: requirement.jurisdiction.id,
      medicationCategory: requirement.medicationCategory,
      guidanceType: requirement.guidanceType,
      status: "covered",
      reason: "covered",
      revisionId: record.id,
      lastReviewedAt: record.lastReviewedAt?.toISOString() ?? null,
      staleAfter: record.staleAfter?.toISOString() ?? null,
      effectiveFrom: record.effectiveFrom?.toISOString() ?? null,
      effectiveTo: record.effectiveTo?.toISOString() ?? null,
    },
  };
}

function summarizeCoverage(
  items: GuidanceCoverageItem[],
): GuidanceCoverageSummary {
  const covered = items.filter(({ status }) => status === "covered").length;
  return {
    requested: items.length,
    covered,
    unknown: items.length - covered,
    complete: covered === items.length,
    items,
  };
}

function uniqueSources(records: PublicGuidanceRecord[]) {
  const sources = new Map<string, SourceReference>();
  for (const source of records.flatMap((record) => record.sources)) {
    sources.set(source.id, {
      id: source.id,
      title: source.title,
      url: source.url,
      sourceType: source.sourceType,
      qualityTier: source.qualityTier,
      excerpt: source.excerpt,
      accessedAt: source.accessedAt.toISOString(),
      lastVerifiedAt: source.lastVerifiedAt?.toISOString() ?? "",
    });
  }
  return [...sources.values()];
}

function resultToGuidanceItem(result: RequirementResult): GuidanceItem {
  return {
    medicationCategory: result.requirement.medicationCategory,
    guidanceType: result.requirement.guidanceType,
    routeRole: result.requirement.routeRole,
    riskLabel: result.riskLabel,
    actions: result.actions,
    confidence: result.confidence,
    lastReviewedAt: result.coverage.lastReviewedAt ?? "",
    staleAfter: result.coverage.staleAfter,
    revisionIds: result.record ? [result.record.id] : [],
    coverage: summarizeCoverage([result.coverage]),
    sources: result.record ? uniqueSources([result.record]) : [],
    isFallback: result.record === null,
  };
}

function earliestDate(values: Array<Date | null>) {
  const timestamps = values.flatMap((value) =>
    value ? [value.getTime()] : [],
  );
  return timestamps.length > 0
    ? new Date(Math.min(...timestamps)).toISOString()
    : null;
}

export async function evaluateRouteGuidance(
  repository: PublicGuidanceRepository,
  input: EvaluateGuidanceInput,
  now = new Date(),
  evaluationId = crypto.randomUUID(),
): Promise<GuidanceEvaluation> {
  const route = resolveRoute(input.routeStopIds);
  const durationDays = getTripDuration(input.departureDate, input.returnDate);
  const requirements = buildRequirements(
    route.jurisdictions,
    input.medicationCategories,
    durationDays,
  );
  const publicRequirementMap = new Map<string, PublicGuidanceRequirement>();
  for (const requirement of requirements) {
    if (requirement.medicationCategory !== null) continue;
    const lookup = {
      type: requirement.jurisdiction.type,
      code: requirement.jurisdiction.code,
      medicationCategorySlug: requirement.medicationCategory,
      guidanceType: requirement.guidanceType,
    };
    publicRequirementMap.set(
      [
        lookup.type,
        lookup.code,
        lookup.medicationCategorySlug,
        lookup.guidanceType,
      ].join(":"),
      lookup,
    );
  }
  for (const jurisdiction of route.jurisdictions) {
    for (const medicationCategorySlug of new Set(input.medicationCategories)) {
      const lookup: PublicGuidanceRequirement = {
        type: jurisdiction.type,
        code: jurisdiction.code,
        medicationCategorySlug,
        guidanceType: null,
      };
      publicRequirementMap.set(
        [lookup.type, lookup.code, lookup.medicationCategorySlug, "*"].join(
          ":",
        ),
        lookup,
      );
    }
  }
  const publicRequirements = [...publicRequirementMap.values()];

  let records: PublicGuidanceRecord[];
  try {
    records = await repository.getGuidanceForRoute(publicRequirements);
  } catch (error) {
    throw new GuidanceUnavailableError({ cause: error });
  }

  const requiredResults = requirements.map((requirement) =>
    evaluateRequirement(requirement, records, now),
  );
  const optionalResults = route.jurisdictions.flatMap((jurisdiction) =>
    jurisdiction.roles.flatMap((routeRole) =>
      [...new Set(input.medicationCategories)].flatMap((medicationCategory) => {
        const requiredType =
          jurisdiction.type === "country" ? "restricted" : "screening";
        return records
          .filter(
            (record) =>
              record.jurisdictionType === jurisdiction.type &&
              record.jurisdictionCode === jurisdiction.code &&
              record.medicationCategorySlug === medicationCategory &&
              record.guidanceType !== "general" &&
              record.guidanceType !== requiredType &&
              (routeRole !== "transit" || record.appliesToTransit) &&
              isPubliclyEligible(record, now),
          )
          .map((record) =>
            evaluateRequirement(
              {
                id: requirementId(
                  jurisdiction,
                  record.guidanceType,
                  medicationCategory,
                  routeRole,
                ),
                jurisdiction,
                medicationCategory,
                guidanceType: record.guidanceType,
                routeRole,
              },
              [record],
              now,
            ),
          );
      }),
    ),
  );
  const results = [...requiredResults, ...optionalResults];
  const coverage = summarizeCoverage(
    requiredResults.map(({ coverage: item }) => item),
  );
  const coveredRecords = results.flatMap(({ record }) =>
    record ? [record] : [],
  );
  const revisionIds = [...new Set(coveredRecords.map(({ id }) => id))];
  const sources = uniqueSources(coveredRecords);
  const earliestStaleAfter = earliestDate(
    coveredRecords.map(({ staleAfter }) => staleAfter),
  );
  const oldestVerifiedAt = earliestDate(
    coveredRecords.flatMap(({ sources: recordSources }) =>
      recordSources.map(({ lastVerifiedAt: verifiedAt }) => verifiedAt),
    ),
  );

  const jurisdictions = route.jurisdictions.map((jurisdiction) => {
    const jurisdictionResults = results.filter(
      ({ requirement }) => requirement.jurisdiction.id === jurisdiction.id,
    );
    const items = jurisdictionResults.map(resultToGuidanceItem);

    return {
      jurisdictionId: jurisdiction.id,
      name: jurisdiction.name,
      countryCode: jurisdiction.countryCode,
      airportCodes: jurisdiction.airportCodes,
      roles: jurisdiction.roles,
      transitOnly: jurisdiction.transitOnly,
      riskLabel: aggregateRisk(items.map(({ riskLabel }) => riskLabel)),
      confidence: lowestConfidence(items.map(({ confidence }) => confidence)),
      generalGuidance: items.filter(
        ({ medicationCategory }) => medicationCategory === null,
      ),
      categoryGuidance: items.filter(
        ({ medicationCategory }) => medicationCategory !== null,
      ),
    };
  });

  return {
    overallRisk: aggregateRisk(jurisdictions.map(({ riskLabel }) => riskLabel)),
    durationDays,
    durationWarning: null,
    route,
    jurisdictions,
    metadata: {
      evaluation: {
        id: evaluationId,
        evaluatedAt: now.toISOString(),
        contractVersion: 2,
      },
      revisions: { ids: revisionIds },
      freshness: {
        status: coverage.complete ? "fresh" : "incomplete",
        earliestStaleAfter,
      },
      evidence: {
        sourceCount: sources.length,
        sourceIds: sources.map(({ id }) => id),
        oldestVerifiedAt,
      },
      coverage,
    },
  };
}
