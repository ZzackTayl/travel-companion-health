import { describe, expect, it } from "vitest";
import { aggregateRisk, evaluateGuidance } from "@/lib/guidance";

describe("guidance evaluation", () => {
  it("aggregates the most cautious risk deterministically", () => {
    expect(
      aggregateRisk(["likely_ok", "check_documentation", "high_risk"]),
    ).toBe("high_risk");
    expect(aggregateRisk(["prior_permission_may_be_required", "unknown"])).toBe(
      "unknown",
    );
    expect(aggregateRisk([])).toBe("unknown");
  });

  it("returns published, source-backed guidance for each route jurisdiction", () => {
    const result = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_lhr", "airport_dxb"],
        medicationCategories: ["controlled_substance", "liquid_over_100ml"],
      },
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(result.overallRisk).toBe("high_risk");
    expect(result.contractVersion).toBe(2);
    expect(result.completeness).toBe("partial");
    expect(result.jurisdictions).toHaveLength(
      result.route.jurisdictions.length,
    );
    expect(
      result.jurisdictions.find(
        ({ jurisdictionId }) => jurisdictionId === "country_gb",
      ),
    ).toMatchObject({
      transitOnly: true,
      riskLabel: "unknown",
      confidence: "unknown",
      coverageStatus: "partial",
    });
    expect(
      result.jurisdictions.flatMap(({ actions }) => actions),
    ).not.toContain("Draft content must never be returned.");
    expect(
      result.jurisdictions.find(
        ({ jurisdictionId }) => jurisdictionId === "airport_authority_jfk",
      ),
    ).toMatchObject({
      riskLabel: "unknown",
      coverageStatus: "unknown",
      sources: [],
    });
  });

  it("adds duration guidance without accepting medicine names", () => {
    const result = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-05-01",
        returnDate: "2026-06-15",
        medicationCategories: [],
      },
      new Date("2026-05-01T00:00:00.000Z"),
    );

    expect(result.durationDays).toBe(46);
    expect(result.durationWarning).toMatch(/quantity-limit/);
    expect(result.jurisdictions[0].actions).toContain(result.durationWarning);
  });

  it("does not overstate confidence for an unknown medicine category", () => {
    const result = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["unknown"],
      },
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(result.overallRisk).toBe("unknown");
    expect(result.jurisdictions[0]).toMatchObject({
      riskLabel: "unknown",
      confidence: "unknown",
    });
    expect(result.jurisdictions[0].actions.join(" ")).toMatch(
      /Do not treat missing guidance as permission/,
    );
  });

  it("does not let general guidance mask a missing category", () => {
    const result = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_dxb"],
        medicationCategories: ["cannabis_derived"],
      },
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(
      result.jurisdictions
        .filter(({ jurisdictionType }) => jurisdictionType === "country")
        .every(
          ({ confidence, coverageGaps, riskLabel }) =>
            riskLabel === "unknown" &&
            confidence === "unknown" &&
            coverageGaps.some(
              ({ medicationCategory }) =>
                medicationCategory === "cannabis_derived",
            ),
        ),
    ).toBe(true);
  });

  it("withholds fixture records that expire before travel", () => {
    const result = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2030-12-01",
        returnDate: "2030-12-15",
        medicationCategories: ["controlled_substance"],
      },
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(result.overallRisk).toBe("unknown");
    expect(
      result.jurisdictions.every(
        ({ coverageStatus }) => coverageStatus === "unknown",
      ),
    ).toBe(true);
  });
});
