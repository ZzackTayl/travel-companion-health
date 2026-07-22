export const contentStatuses = [
  "draft",
  "reviewed",
  "published",
  "stale",
  "archived",
  "needs_verification",
] as const;

export type ContentStatus = (typeof contentStatuses)[number];

export const riskLabels = [
  "likely_ok",
  "check_documentation",
  "prior_permission_may_be_required",
  "high_risk",
  "unknown",
] as const;

export type RiskLabel = (typeof riskLabels)[number];

export const confidenceLevels = [
  "official_verified",
  "high",
  "medium",
  "low",
  "unknown",
] as const;

export type Confidence = (typeof confidenceLevels)[number];

export const guidanceTypes = [
  "general",
  "packaging",
  "documentation",
  "quantity_limit",
  "prohibited",
  "restricted",
  "screening",
  "declaration",
  "transit",
  "airline_carriage",
] as const;

export type GuidanceType = (typeof guidanceTypes)[number];

export const sourceTypes = [
  "government",
  "customs",
  "health_authority",
  "embassy",
  "aviation_authority",
  "airport",
  "airline",
  "incb",
  "cdc",
  "tsa",
  "trusted_secondary",
  "social",
] as const;

export type SourceType = (typeof sourceTypes)[number];

export interface SourceRecord {
  id: string;
  guidanceRecordId: string;
  url: string;
  title: string;
  sourceType: SourceType;
  qualityTier: 1 | 2 | 3 | 4;
  excerpt: string;
  accessedAt: Date;
  lastVerifiedAt: Date | null;
  supportsSummary: boolean;
}

export interface GuidanceRecord {
  id: string;
  jurisdictionId: string;
  medicationCategoryId: string | null;
  guidanceType: GuidanceType;
  riskLabel: RiskLabel;
  title: string;
  summary: string;
  actionText: string;
  appliesToTransit: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  status: ContentStatus;
  confidence: Confidence;
  lastReviewedAt: Date | null;
  staleAfter: Date | null;
  reviewerId: string | null;
  lowerTierEvidenceApprovedAt: Date | null;
  lowerTierEvidenceApprovedBy: string | null;
  lowerTierEvidenceReason: string | null;
  reviewedForPublication?: boolean;
  lowerTierEvidenceApproved?: boolean;
  unresolvedQuestions: string[];
  sources: SourceRecord[];
}

export interface PublicGuidanceRecord extends GuidanceRecord {
  jurisdictionType: "country" | "airport_authority";
  jurisdictionCode: string;
  medicationCategorySlug: string | null;
}

export interface PublicGuidanceRequirement {
  type: PublicGuidanceRecord["jurisdictionType"];
  code: string;
  medicationCategorySlug: string | null;
  guidanceType: GuidanceType | null;
}

export interface LaunchCoverageRequirement {
  id: string;
  jurisdictionId: string;
  medicationCategoryId: string | null;
  guidanceType: GuidanceType;
  label: string;
  requiredAtLaunch: boolean;
}

export interface PublicationValidation {
  valid: boolean;
  errors: string[];
}

export interface CoverageResult extends LaunchCoverageRequirement {
  covered: boolean;
  guidanceRecordId: string | null;
  reason: "covered" | "missing" | "stale" | "invalid_evidence";
}

export interface UnknownGuidance {
  jurisdictionId: string;
  medicationCategoryId: string | null;
  guidanceType: GuidanceType;
  riskLabel: "unknown";
  confidence: "unknown";
  title: string;
  summary: string;
  actionText: string;
  sources: [];
  isFallback: true;
}

export type EvaluatedGuidance = GuidanceRecord | UnknownGuidance;
