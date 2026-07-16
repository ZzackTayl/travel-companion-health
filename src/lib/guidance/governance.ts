import type {
  CoverageResult,
  GuidanceRecord,
  LaunchCoverageRequirement,
  PublicationValidation,
  UnknownGuidance,
} from "./types";

const VERIFY_ACTION_PATTERN =
  /\b(verify|check|confirm|contact)\b[\s\S]*\b(official|authority|embassy|customs|government)\b/i;
const GUARANTEE_PATTERN =
  /\b(guaranteed|definitely legal|completely safe|will be allowed|will clear customs)\b/i;

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isSecureUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function expectedQualityTier(
  sourceType: GuidanceRecord["sources"][number]["sourceType"],
) {
  if (sourceType === "social") return 4;
  if (sourceType === "trusted_secondary") return 3;
  if (["aviation_authority", "airport", "airline"].includes(sourceType)) {
    return 2;
  }
  return 1;
}

export function validateForPublication(
  record: GuidanceRecord,
  now = new Date(),
): PublicationValidation {
  const errors: string[] = [];

  if (!hasText(record.title)) errors.push("title is required");
  if (!hasText(record.summary)) errors.push("summary is required");
  if (!hasText(record.actionText)) errors.push("action text is required");
  if (!record.reviewerId && !record.reviewedForPublication) {
    errors.push("reviewer is required");
  }
  if (!record.lastReviewedAt) errors.push("last-reviewed date is required");
  if (record.lastReviewedAt && record.lastReviewedAt > now) {
    errors.push("last-reviewed date cannot be in the future");
  }
  if (!record.staleAfter) errors.push("stale-after date is required");
  if (record.staleAfter && record.staleAfter <= now) {
    errors.push("stale-after date must be in the future");
  }
  if (
    record.lowerTierEvidenceApprovedAt &&
    record.lowerTierEvidenceApprovedAt > now
  ) {
    errors.push("lower-tier evidence approval cannot be in the future");
  }
  if (
    record.lastReviewedAt &&
    record.staleAfter &&
    record.staleAfter <= record.lastReviewedAt
  ) {
    errors.push("stale-after date must follow the review date");
  }
  if (record.lastReviewedAt && record.staleAfter) {
    const maximumReviewDays = record.riskLabel === "high_risk" ? 60 : 180;
    const maximumStaleAfter = new Date(record.lastReviewedAt);
    maximumStaleAfter.setUTCDate(
      maximumStaleAfter.getUTCDate() + maximumReviewDays,
    );
    if (record.staleAfter > maximumStaleAfter) {
      errors.push(
        `${record.riskLabel === "high_risk" ? "high-risk" : "guidance"} review cadence cannot exceed ${maximumReviewDays} days`,
      );
    }
  }
  if (record.unresolvedQuestions.some(hasText)) {
    errors.push("unresolved questions must be resolved before publication");
  }
  if (GUARANTEE_PATTERN.test(`${record.summary} ${record.actionText}`)) {
    errors.push("guidance cannot make a legal or medical guarantee");
  }
  if (
    (record.riskLabel === "high_risk" || record.riskLabel === "unknown") &&
    !VERIFY_ACTION_PATTERN.test(record.actionText)
  ) {
    errors.push(
      "high-risk and unknown guidance must direct users to an official authority",
    );
  }

  const supportingSources = record.sources.filter(
    (source) =>
      source.sourceType !== "social" &&
      source.qualityTier < 4 &&
      source.supportsSummary,
  );

  if (supportingSources.length === 0) {
    errors.push("at least one supporting non-social source is required");
  }

  for (const source of supportingSources) {
    if (source.qualityTier !== expectedQualityTier(source.sourceType)) {
      errors.push(
        `source ${source.id} quality tier does not match its source type`,
      );
    }
    if (!hasText(source.url) || !isSecureUrl(source.url)) {
      errors.push(`source ${source.id} must have a valid HTTPS URL`);
    }
    if (!hasText(source.title)) {
      errors.push(`source ${source.id} must have a title`);
    }
    if (source.excerpt.trim().length < 20) {
      errors.push(
        `source ${source.id} excerpt is too short to support guidance`,
      );
    }
    if (!source.lastVerifiedAt) {
      errors.push(`source ${source.id} must be verified by a reviewer`);
    }
    if (source.lastVerifiedAt && source.lastVerifiedAt > now) {
      errors.push(
        `source ${source.id} verification date cannot be in the future`,
      );
    }
    if (
      source.lastVerifiedAt &&
      record.lastReviewedAt &&
      source.lastVerifiedAt < record.lastReviewedAt
    ) {
      errors.push(
        `source ${source.id} must be verified during the current review`,
      );
    }
    if (source.accessedAt > now) {
      errors.push(`source ${source.id} accessed date cannot be in the future`);
    }
  }

  const hasStrongSource = supportingSources.some(
    (source) => source.qualityTier <= 2,
  );
  const hasApprovedFallback =
    record.lowerTierEvidenceApproved ||
    (Boolean(record.lowerTierEvidenceApprovedAt) &&
      Boolean(record.lowerTierEvidenceApprovedBy) &&
      hasText(record.lowerTierEvidenceReason));

  if (!hasStrongSource && supportingSources.length > 0) {
    if (supportingSources.length < 2) {
      errors.push("Tier 3 fallback guidance requires at least two sources");
    }
    if (!hasApprovedFallback) {
      errors.push(
        "Tier 3 evidence requires reviewer approval and a documented reason",
      );
    }
    if (!["low", "medium"].includes(record.confidence)) {
      errors.push("Tier 3 fallback guidance must use low or medium confidence");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isStale(record: GuidanceRecord, now = new Date()) {
  return (
    record.status === "stale" ||
    !record.staleAfter ||
    record.staleAfter.getTime() <= now.getTime()
  );
}

export function isPubliclyEligible(record: GuidanceRecord, now = new Date()) {
  const currentDate = now.toISOString().slice(0, 10);
  const effectiveFrom = record.effectiveFrom?.toISOString().slice(0, 10);
  const effectiveTo = record.effectiveTo?.toISOString().slice(0, 10);

  return (
    record.status === "published" &&
    !isStale(record, now) &&
    (!effectiveFrom || effectiveFrom <= currentDate) &&
    (!effectiveTo || effectiveTo >= currentDate) &&
    validateForPublication(record, now).valid
  );
}

export function createUnknownFallback(
  requirement: Pick<
    LaunchCoverageRequirement,
    "jurisdictionId" | "medicationCategoryId" | "guidanceType"
  >,
): UnknownGuidance {
  return {
    ...requirement,
    riskLabel: "unknown",
    confidence: "unknown",
    title: "Official guidance not verified",
    summary:
      "We could not verify current guidance for this part of your route. Do not treat missing guidance as permission.",
    actionText:
      "Check with an official government, customs, embassy, or airport authority before travel.",
    sources: [],
    isFallback: true,
  };
}

function matchesRequirement(
  record: GuidanceRecord,
  requirement: LaunchCoverageRequirement,
) {
  return (
    record.jurisdictionId === requirement.jurisdictionId &&
    record.medicationCategoryId === requirement.medicationCategoryId &&
    record.guidanceType === requirement.guidanceType &&
    (requirement.guidanceType !== "transit" || record.appliesToTransit)
  );
}

export function auditLaunchCoverage(
  requirements: LaunchCoverageRequirement[],
  records: GuidanceRecord[],
  now = new Date(),
): CoverageResult[] {
  return requirements
    .filter((requirement) => requirement.requiredAtLaunch)
    .map((requirement) => {
      const candidates = records.filter((record) =>
        matchesRequirement(record, requirement),
      );
      const eligible = candidates.find((record) =>
        isPubliclyEligible(record, now),
      );

      if (eligible) {
        return {
          ...requirement,
          covered: true,
          guidanceRecordId: eligible.id,
          reason: "covered" as const,
        };
      }

      const reason = candidates.some((record) => isStale(record, now))
        ? ("stale" as const)
        : candidates.some(
              (record) =>
                record.status === "published" &&
                !validateForPublication(record, now).valid,
            )
          ? ("invalid_evidence" as const)
          : ("missing" as const);

      return {
        ...requirement,
        covered: false,
        guidanceRecordId: null,
        reason,
      };
    });
}
