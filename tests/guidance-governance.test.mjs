import assert from "node:assert/strict";
import test from "node:test";

import {
  auditLaunchCoverage,
  createUnknownFallback,
  isPubliclyEligible,
  validateForPublication,
} from "../src/lib/guidance/governance.ts";

const now = new Date("2026-07-16T12:00:00Z");

function source(overrides = {}) {
  return {
    id: "source-1",
    guidanceRecordId: "guidance-1",
    url: "https://www.gov.example/travel-medicine",
    title: "Official travel medicine guidance",
    sourceType: "government",
    qualityTier: 1,
    excerpt:
      "Travelers should keep prescription medicine in its original labelled container.",
    accessedAt: new Date("2026-07-01T00:00:00Z"),
    lastVerifiedAt: new Date("2026-07-10T00:00:00Z"),
    supportsSummary: true,
    ...overrides,
  };
}

function guidance(overrides = {}) {
  return {
    id: "guidance-1",
    jurisdictionId: "jurisdiction-gb",
    medicationCategoryId: null,
    guidanceType: "documentation",
    riskLabel: "check_documentation",
    title: "Carry prescription documentation",
    summary: "Official guidance recommends carrying prescription documentation.",
    actionText: "Carry a copy of your prescription while traveling.",
    appliesToTransit: true,
    effectiveFrom: null,
    effectiveTo: null,
    status: "published",
    confidence: "official_verified",
    lastReviewedAt: new Date("2026-07-10T00:00:00Z"),
    staleAfter: new Date("2026-10-08T00:00:00Z"),
    reviewerId: "reviewer-1",
    lowerTierEvidenceApprovedAt: null,
    lowerTierEvidenceApprovedBy: null,
    lowerTierEvidenceReason: null,
    unresolvedQuestions: [],
    sources: [source()],
    ...overrides,
  };
}

function requirement(overrides = {}) {
  return {
    id: "coverage-1",
    jurisdictionId: "jurisdiction-gb",
    medicationCategoryId: null,
    guidanceType: "documentation",
    label: "United Kingdom documentation",
    requiredAtLaunch: true,
    ...overrides,
  };
}

test("accepts current reviewed guidance backed by strong evidence", () => {
  assert.deepEqual(validateForPublication(guidance(), now), {
    valid: true,
    errors: [],
  });
  assert.equal(isPubliclyEligible(guidance(), now), true);
});

test("rejects publication without evidence and reviewer metadata", () => {
  const result = validateForPublication(
    guidance({
      sources: [],
      reviewerId: null,
      lastReviewedAt: null,
      staleAfter: null,
    }),
    now,
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /reviewer is required/);
  assert.match(result.errors.join(" "), /supporting non-social source/);
});

test("requires explicit approval when only Tier 3 evidence is available", () => {
  const lowerTier = guidance({
    sources: [
      source({
        sourceType: "trusted_secondary",
        qualityTier: 3,
      }),
    ],
  });

  assert.match(
    validateForPublication(lowerTier, now).errors.join(" "),
    /Tier 3 evidence requires reviewer approval/,
  );

  const approved = {
    ...lowerTier,
    confidence: "medium",
    sources: [
      ...lowerTier.sources,
      source({
        id: "source-2",
        sourceType: "trusted_secondary",
        qualityTier: 3,
      }),
    ],
    lowerTierEvidenceApprovedAt: new Date("2026-07-11T00:00:00Z"),
    lowerTierEvidenceApprovedBy: "reviewer-2",
    lowerTierEvidenceReason:
      "No Tier 1 source is available; this is clearly labelled lower confidence.",
  };
  assert.equal(validateForPublication(approved, now).valid, true);
});

test("withholds stale guidance and reports the launch coverage gap", () => {
  const stale = guidance({
    staleAfter: new Date("2026-07-15T00:00:00Z"),
  });

  assert.equal(isPubliclyEligible(stale, now), false);
  assert.deepEqual(auditLaunchCoverage([requirement()], [stale], now), [
    {
      ...requirement(),
      covered: false,
      guidanceRecordId: null,
      reason: "stale",
    },
  ]);
});

test("reports invalid evidence separately from missing launch guidance", () => {
  const invalid = guidance({
    sources: [source({ supportsSummary: false })],
  });
  const missingRequirement = requirement({
    id: "coverage-2",
    guidanceType: "packaging",
  });

  const result = auditLaunchCoverage(
    [requirement(), missingRequirement],
    [invalid],
    now,
  );
  assert.equal(result[0].reason, "invalid_evidence");
  assert.equal(result[1].reason, "missing");
});

test("unknown fallback never implies that missing guidance is permission", () => {
  const fallback = createUnknownFallback(requirement());

  assert.equal(fallback.riskLabel, "unknown");
  assert.equal(fallback.confidence, "unknown");
  assert.equal(fallback.sources.length, 0);
  assert.match(fallback.summary, /Do not treat missing guidance as permission/);
  assert.match(fallback.actionText, /official/);
});

test("unknown and high-risk guidance must include official verification", () => {
  const result = validateForPublication(
    guidance({
      riskLabel: "high_risk",
      actionText: "Pack this item carefully.",
    }),
    now,
  );
  assert.match(result.errors.join(" "), /official authority/);
});

test("legal guarantees block publication", () => {
  const result = validateForPublication(
    guidance({
      summary: "You will be allowed through customs with this medicine.",
    }),
    now,
  );
  assert.match(result.errors.join(" "), /legal or medical guarantee/);
});

test("effective-to dates remain eligible for the entire final day", () => {
  const finalDay = guidance({
    effectiveTo: new Date("2026-07-16"),
  });

  assert.equal(isPubliclyEligible(finalDay, now), true);
});

test("transit coverage requires guidance that applies to transit passengers", () => {
  const transitRequirement = requirement({ guidanceType: "transit" });
  const countryOnly = guidance({
    guidanceType: "transit",
    appliesToTransit: false,
  });

  assert.equal(
    auditLaunchCoverage([transitRequirement], [countryOnly], now)[0].covered,
    false,
  );
});