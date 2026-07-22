import { describe, expect, it, vi } from "vitest";
import { createGuidancePostHandler } from "@/app/api/guidance/evaluate/handler";
import {
  evaluateRouteGuidance,
  type PublicGuidanceRepository,
} from "@/lib/guidance/service";
import type { GuidanceCoverageReason } from "@/lib/domain";
import type {
  PublicGuidanceRecord,
  PublicGuidanceRequirement,
} from "@/lib/guidance/types";

function request(body: unknown) {
  return new Request("http://localhost/api/guidance/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = new Date("2026-07-22T12:00:00.000Z");

function source() {
  return {
    id: "source-valid",
    guidanceRecordId: "revision-valid",
    url: "https://government.example/medicine",
    title: "Official medicine guidance",
    sourceType: "government" as const,
    qualityTier: 1 as const,
    excerpt:
      "Travelers should carry medicine with the documentation required by authorities.",
    accessedAt: new Date("2026-07-20T00:00:00.000Z"),
    lastVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
    supportsSummary: true,
  };
}

function guidance(
  overrides: Partial<PublicGuidanceRecord> = {},
): PublicGuidanceRecord {
  return {
    id: "revision-valid",
    jurisdictionId: "database-jurisdiction-us",
    jurisdictionType: "country",
    jurisdictionCode: "US",
    medicationCategoryId: null,
    medicationCategorySlug: null,
    guidanceType: "general",
    riskLabel: "check_documentation",
    title: "Check official medicine requirements",
    summary: "Official requirements may include medicine documentation.",
    actionText: "Carry the documentation listed by the official authority.",
    appliesToTransit: true,
    effectiveFrom: null,
    effectiveTo: null,
    status: "published",
    confidence: "official_verified",
    lastReviewedAt: new Date("2026-07-20T00:00:00.000Z"),
    staleAfter: new Date("2026-10-01T00:00:00.000Z"),
    reviewerId: "reviewer-valid",
    lowerTierEvidenceApprovedAt: null,
    lowerTierEvidenceApprovedBy: null,
    lowerTierEvidenceReason: null,
    unresolvedQuestions: [],
    sources: [source()],
    ...overrides,
  };
}

function repository(records: PublicGuidanceRecord[]): PublicGuidanceRepository {
  return {
    async getGuidanceForRoute(_requirements: PublicGuidanceRequirement[]) {
      return records;
    },
  };
}

function handler(records: PublicGuidanceRecord[]) {
  return createGuidancePostHandler((input) =>
    evaluateRouteGuidance(repository(records), input, now, "evaluation-test"),
  );
}

const ineligibleRecords: Array<
  [
    label: string,
    record: PublicGuidanceRecord,
    expectedReason: Exclude<
      GuidanceCoverageReason,
      "covered" | "missing_or_ineligible"
    >,
  ]
> = [
  [
    "stale",
    guidance({ staleAfter: new Date("2026-07-21T00:00:00.000Z") }),
    "stale",
  ],
  ["draft", guidance({ status: "draft" }), "unpublished"],
  ["archived", guidance({ status: "archived" }), "unpublished"],
  [
    "future-effective",
    guidance({ effectiveFrom: new Date("2026-07-23T00:00:00.000Z") }),
    "not_effective",
  ],
  ["sourceless", guidance({ sources: [] }), "invalid_evidence"],
  [
    "partially invalid evidence",
    guidance({
      sources: [
        source(),
        {
          ...source(),
          id: "source-future",
          lastVerifiedAt: new Date("2026-07-23T00:00:00.000Z"),
        },
      ],
    }),
    "invalid_evidence",
  ],
  [
    "invalid",
    guidance({
      reviewerId: null,
      reviewedForPublication: false,
      actionText: "DRAFT OR INVALID CONTENT MUST NOT REACH USERS",
    }),
    "invalid_evidence",
  ],
];

describe("POST /api/guidance/evaluate", () => {
  it("returns governed revision, freshness, evidence, and coverage metadata", async () => {
    const injectableDocumentation = guidance({
      id: "revision-injectable-documentation",
      medicationCategoryId: "category-injectable",
      medicationCategorySlug: "injectable",
      guidanceType: "documentation",
      sources: [
        {
          ...source(),
          id: "source-injectable",
          guidanceRecordId: "revision-injectable-documentation",
        },
      ],
    });
    const response = await handler([guidance(), injectableDocumentation])(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-05-12",
        returnDate: "2026-05-22",
        medicationCategories: ["injectable"],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      overallRisk: "unknown",
      durationDays: 11,
      metadata: {
        evaluation: {
          id: "evaluation-test",
          evaluatedAt: now.toISOString(),
          contractVersion: 2,
        },
        revisions: {
          ids: ["revision-valid", "revision-injectable-documentation"],
        },
        freshness: {
          status: "incomplete",
          earliestStaleAfter: "2026-10-01T00:00:00.000Z",
        },
        evidence: {
          sourceCount: 2,
          sourceIds: ["source-valid", "source-injectable"],
          oldestVerifiedAt: "2026-07-20T00:00:00.000Z",
        },
        coverage: {
          complete: false,
        },
      },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(
      body.jurisdictions.find(
        ({ jurisdictionId }: { jurisdictionId: string }) =>
          jurisdictionId === "country_us",
      ),
    ).toMatchObject({
      riskLabel: "unknown",
      generalGuidance: expect.arrayContaining([
        expect.objectContaining({
          medicationCategory: null,
          confidence: "official_verified",
          isFallback: false,
        }),
      ]),
      categoryGuidance: expect.arrayContaining([
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "restricted",
          riskLabel: "unknown",
          isFallback: true,
        }),
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "documentation",
          isFallback: false,
        }),
      ]),
    });
  });

  it("rejects medicine names and unknown categories", async () => {
    const post = handler([]);
    const medicineNameResponse = await post(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["prescription"],
        medicineName: "must-not-leave-client",
      }),
    );
    const categoryResponse = await post(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["not_normalized"],
      }),
    );

    expect(medicineNameResponse.status).toBe(400);
    expect(categoryResponse.status).toBe(400);
  });

  it("returns a client error before invoking production dependencies", async () => {
    const evaluate = vi.fn();
    const post = createGuidancePostHandler(evaluate);
    const unknownAirportResponse = await post(
      request({
        routeStopIds: ["airport_jfk", "airport_missing"],
        medicationCategories: [],
      }),
    );
    const invalidDateResponse = await post(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-02-30",
        medicationCategories: [],
      }),
    );

    expect(unknownAirportResponse.status).toBe(422);
    expect(invalidDateResponse.status).toBe(422);
    expect(invalidDateResponse.headers.get("cache-control")).toBe("no-store");
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("uses governed quantity-limit coverage for longer trips", async () => {
    const response = await handler([])(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-05-01",
        returnDate: "2026-06-15",
        medicationCategories: [],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.durationDays).toBe(46);
    expect(body.durationWarning).toBeNull();
    expect(body.metadata.coverage.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guidanceType: "quantity_limit",
          status: "unknown",
          reason: "missing_or_ineligible",
        }),
      ]),
    );
  });

  it("requires transit records to apply to transit for mixed-role airports", async () => {
    const mixedRoleRecord = guidance({
      id: "revision-jfk-transit",
      jurisdictionId: "database-airport-jfk",
      jurisdictionType: "airport_authority",
      jurisdictionCode: "JFK",
      guidanceType: "transit",
      appliesToTransit: false,
      actionText: "NON-TRANSIT CONTENT MUST NOT REACH TRANSIT USERS",
    });
    const response = await handler([mixedRoleRecord])(
      request({
        routeStopIds: [
          "airport_jfk",
          "airport_lhr",
          "airport_jfk",
          "airport_cdg",
        ],
        medicationCategories: [],
      }),
    );
    const body = await response.json();
    const scope = body.metadata.coverage.items.find(
      ({ id }: { id: string }) =>
        id === "airport_authority:JFK:transit:all:transit",
    );

    expect(response.status).toBe(200);
    expect(scope).toMatchObject({
      status: "unknown",
      reason: "missing_or_ineligible",
    });
    expect(JSON.stringify(body)).not.toContain(mixedRoleRecord.actionText);
  });

  it.each(ineligibleRecords)(
    "withholds %s database records behind an unknown fallback",
    async (_label, record, expectedReason) => {
      const response = await handler([record])(
        request({
          routeStopIds: ["airport_jfk", "airport_lhr"],
          medicationCategories: [],
        }),
      );
      const body = await response.json();
      const scope = body.metadata.coverage.items.find(
        ({ id }: { id: string }) => id === "country:US:general:all:origin",
      );

      expect(response.status).toBe(200);
      expect(scope).toMatchObject({
        status: "unknown",
        reason: expectedReason,
        revisionId: null,
      });
      expect(JSON.stringify(body)).not.toContain(record.actionText);
      expect(body.jurisdictions[0]).toMatchObject({
        riskLabel: "unknown",
        confidence: "unknown",
      });
    },
  );

  it("fails closed when the governed database or global switch is unavailable", async () => {
    const post = createGuidancePostHandler((input) =>
      evaluateRouteGuidance(
        {
          async getGuidanceForRoute() {
            throw new Error("database detail must not be returned");
          },
        },
        input,
        now,
        "evaluation-test",
      ),
    );
    const response = await post(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: [],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(JSON.stringify(body)).not.toContain("database detail");
  });
});
