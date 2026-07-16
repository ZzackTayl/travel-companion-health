import {
  auditLaunchCoverage,
  createUnknownFallback,
  isPubliclyEligible,
  validateForPublication,
} from "./governance";
import type {
  CoverageResult,
  EvaluatedGuidance,
  GuidanceRecord,
  LaunchCoverageRequirement,
} from "./types";

export interface GuidanceRepository {
  getGuidanceForRequirements(
    requirements: LaunchCoverageRequirement[],
  ): Promise<GuidanceRecord[]>;
  getGuidanceForCoverage(
    requirements: LaunchCoverageRequirement[],
  ): Promise<GuidanceRecord[]>;
  getGuidanceById(id: string): Promise<GuidanceRecord | null>;
  savePublished(record: GuidanceRecord): Promise<void>;
  listLaunchCoverageRequirements(): Promise<LaunchCoverageRequirement[]>;
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

export async function evaluateGuidance(
  repository: GuidanceRepository,
  requirements: LaunchCoverageRequirement[],
  now = new Date(),
): Promise<EvaluatedGuidance[]> {
  const records = await repository.getGuidanceForRequirements(requirements);

  return requirements.map((requirement) => {
    const match = records.find(
      (record) =>
        record.jurisdictionId === requirement.jurisdictionId &&
        record.medicationCategoryId === requirement.medicationCategoryId &&
        record.guidanceType === requirement.guidanceType &&
        (requirement.guidanceType !== "transit" || record.appliesToTransit) &&
        isPubliclyEligible(record, now),
    );

    return match ?? createUnknownFallback(requirement);
  });
}

export async function getLaunchCoverage(
  repository: GuidanceRepository,
  now = new Date(),
): Promise<CoverageResult[]> {
  const requirements = await repository.listLaunchCoverageRequirements();
  const records = await repository.getGuidanceForCoverage(requirements);
  return auditLaunchCoverage(requirements, records, now);
}

export async function getPublicGuidanceById(
  repository: GuidanceRepository,
  id: string,
  now = new Date(),
) {
  const record = await repository.getGuidanceById(id);
  return record && isPubliclyEligible(record, now) ? record : null;
}
