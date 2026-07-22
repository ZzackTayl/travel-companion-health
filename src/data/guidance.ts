import type { Confidence, MedicationCategory, RiskLabel } from "@/lib/domain";

export interface GuidanceRecord {
  id: string;
  jurisdictionId: string;
  medicationCategory: MedicationCategory | null;
  riskLabel: RiskLabel;
  actionText: string;
  appliesToTransit: boolean;
  status: "draft" | "reviewed" | "published" | "stale" | "archived";
  confidence: Confidence;
  lastReviewedAt: string;
  staleAfter: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceIds: string[];
}

const baselineCountries = [
  ["US", "source_us_state"],
  ["GB", "source_gb"],
  ["AE", "source_ae"],
  ["FR", "source_fr"],
  ["DE", "source_de"],
  ["NL", "source_nl"],
  ["JP", "source_jp"],
  ["SG", "source_sg"],
  ["IN", "source_in"],
  ["AU", "source_au"],
  ["CA", "source_ca"],
  ["MX", "source_mx"],
  ["QA", "source_qa"],
  ["BR", "source_br"],
  ["ZA", "source_za"],
  ["KR", "source_kr"],
] as const;

export const guidanceRecords: GuidanceRecord[] = [
  ...baselineCountries.map(
    ([countryCode, sourceId]): GuidanceRecord => ({
      id: `guidance_${countryCode.toLocaleLowerCase()}_general`,
      jurisdictionId: `country_${countryCode.toLocaleLowerCase()}`,
      medicationCategory: null,
      riskLabel: "check_documentation",
      actionText:
        "Keep medicines in original labeled packaging and carry prescription documentation.",
      appliesToTransit: true,
      status: "published",
      confidence: "high",
      lastReviewedAt: "2026-06-15",
      staleAfter: "2026-12-12",
      sourceIds: [sourceId],
    }),
  ),
  {
    id: "guidance_gb_controlled",
    jurisdictionId: "country_gb",
    medicationCategory: "controlled_substance",
    riskLabel: "prior_permission_may_be_required",
    actionText:
      "Check the official controlled-drug rules and required evidence before departure.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_gb"],
  },
  {
    id: "guidance_ae_controlled",
    jurisdictionId: "country_ae",
    medicationCategory: "controlled_substance",
    riskLabel: "high_risk",
    actionText:
      "Do not travel until you have checked the official controlled-medicine requirements and any approval process.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-08-14",
    sourceIds: ["source_ae"],
  },
  {
    id: "guidance_jp_controlled",
    jurisdictionId: "country_jp",
    medicationCategory: "controlled_substance",
    riskLabel: "prior_permission_may_be_required",
    actionText:
      "Confirm import limits and any advance application with Japan's health authority.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_jp"],
  },
  {
    id: "guidance_sg_controlled",
    jurisdictionId: "country_sg",
    medicationCategory: "controlled_substance",
    riskLabel: "prior_permission_may_be_required",
    actionText:
      "Use the official HSA checker and complete any required approval before travel.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_sg"],
  },
  {
    id: "guidance_us_injectable",
    jurisdictionId: "country_us",
    medicationCategory: "injectable",
    riskLabel: "check_documentation",
    actionText:
      "Carry supporting documentation for injectable medicines and related supplies.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_us_tsa"],
  },
  {
    id: "guidance_lhr_liquid",
    jurisdictionId: "airport_authority_lhr",
    medicationCategory: "liquid_over_100ml",
    riskLabel: "check_documentation",
    actionText:
      "Review Heathrow's current security process for essential medical liquids before travel.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_lhr"],
  },
  {
    id: "guidance_dxb_liquid",
    jurisdictionId: "airport_authority_dxb",
    medicationCategory: "liquid_over_100ml",
    riskLabel: "check_documentation",
    actionText:
      "Review Dubai Airports' current baggage rules for medicines and medical liquids.",
    appliesToTransit: true,
    status: "published",
    confidence: "high",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: ["source_dxb"],
  },
  {
    id: "guidance_draft_not_public",
    jurisdictionId: "country_gb",
    medicationCategory: "prescription",
    riskLabel: "high_risk",
    actionText: "Draft content must never be returned.",
    appliesToTransit: true,
    status: "draft",
    confidence: "low",
    lastReviewedAt: "2026-06-15",
    staleAfter: "2026-12-12",
    sourceIds: [],
  },
];
