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
  });

  it("returns published, source-backed guidance for each route jurisdiction", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr", "airport_dxb"],
      medicationCategories: ["controlled_substance", "liquid_over_100ml"],
    });

    expect(result.overallRisk).toBe("high_risk");
    expect(
      result.jurisdictions.find(
        ({ jurisdictionId }) => jurisdictionId === "country_gb",
      ),
    ).toMatchObject({
      transitOnly: true,
      riskLabel: "prior_permission_may_be_required",
      confidence: "official_verified",
    });
    expect(
      result.jurisdictions.flatMap(({ actions }) => actions),
    ).not.toContain("Draft content must never be returned.");
    expect(
      result.jurisdictions.every(({ sources }) => sources.length > 0),
    ).toBe(true);
  });

  it("adds duration guidance without accepting medicine names", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      departureDate: "2026-05-01",
      returnDate: "2026-06-15",
      medicationCategories: [],
    });

    expect(result.durationDays).toBe(46);
    expect(result.durationWarning).toMatch(/quantity-limit/);
    expect(result.jurisdictions[0].actions).toContain(result.durationWarning);
  });

  it("does not overstate confidence for an unknown medicine category", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      medicationCategories: ["unknown"],
    });

    expect(result.overallRisk).toBe("unknown");
    expect(result.jurisdictions[0]).toMatchObject({
      riskLabel: "unknown",
      confidence: "unknown",
    });
    expect(result.jurisdictions[0].actions).toContain(
      "The medicine category is uncertain; verify it against current official requirements.",
    );
  });
});
