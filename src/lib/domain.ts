export const medicationCategories = [
  "prescription",
  "over_the_counter",
  "controlled_substance",
  "opioid",
  "stimulant_adhd",
  "sedative_anxiety",
  "sleep_medication",
  "pseudoephedrine",
  "cannabis_derived",
  "injectable",
  "liquid_over_100ml",
  "refrigerated",
  "medical_device",
  "needles_or_sharps",
  "unknown",
] as const;

export type MedicationCategory = (typeof medicationCategories)[number];

export const riskLabels = [
  "likely_ok",
  "check_documentation",
  "prior_permission_may_be_required",
  "high_risk",
  "unknown",
] as const;

export type RiskLabel = (typeof riskLabels)[number];
export type Confidence =
  | "official_verified"
  | "high"
  | "medium"
  | "low"
  | "unknown";
export type RouteRole = "origin" | "transit" | "destination";

export interface Airport {
  id: string;
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  countryCode: string;
  countryName: string;
  regionCode?: string;
}

export interface RouteStop extends Airport {
  position: number;
  role: RouteRole;
}

export interface ResolvedJurisdiction {
  id: string;
  type: "country" | "airport_authority";
  name: string;
  countryCode: string;
  code: string;
  roles: RouteRole[];
  routePositions: number[];
  airportIds: string[];
  airportCodes: string[];
  transitOnly: boolean;
}

export interface ResolvedRoute {
  stops: RouteStop[];
  countries: ResolvedJurisdiction[];
  jurisdictions: ResolvedJurisdiction[];
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  qualityTier: number;
  excerpt: string;
  accessedAt: string;
  lastVerifiedAt: string;
}

export type GuidanceCoverageReason =
  | "covered"
  | "missing_or_ineligible"
  | "stale"
  | "unpublished"
  | "not_effective"
  | "invalid_evidence";

export interface GuidanceCoverageItem {
  id: string;
  jurisdictionId: string;
  medicationCategory: MedicationCategory | null;
  guidanceType: string;
  status: "covered" | "unknown";
  reason: GuidanceCoverageReason;
  revisionId: string | null;
  lastReviewedAt: string | null;
  staleAfter: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface GuidanceCoverageSummary {
  requested: number;
  covered: number;
  unknown: number;
  complete: boolean;
  items: GuidanceCoverageItem[];
}

export interface JurisdictionGuidance {
  jurisdictionId: string;
  name: string;
  countryCode: string;
  airportCodes: string[];
  roles: RouteRole[];
  transitOnly: boolean;
  riskLabel: RiskLabel;
  actions: string[];
  confidence: Confidence;
  lastReviewedAt: string;
  staleAfter: string | null;
  revisionIds: string[];
  coverage: GuidanceCoverageSummary;
  sources: SourceReference[];
}

export interface GuidanceEvaluationMetadata {
  evaluation: {
    id: string;
    evaluatedAt: string;
    contractVersion: 2;
  };
  revisions: {
    ids: string[];
  };
  freshness: {
    status: "fresh" | "incomplete";
    earliestStaleAfter: string | null;
  };
  evidence: {
    sourceCount: number;
    sourceIds: string[];
    oldestVerifiedAt: string | null;
  };
  coverage: GuidanceCoverageSummary;
}

export interface GuidanceEvaluation {
  overallRisk: RiskLabel;
  durationDays: number | null;
  durationWarning: string | null;
  route: ResolvedRoute;
  jurisdictions: JurisdictionGuidance[];
  metadata: GuidanceEvaluationMetadata;
}
