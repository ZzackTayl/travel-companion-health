import { describe, expect, it } from "vitest";
import { aggregateRisk } from "./service";

describe("governed guidance service", () => {
  it("aggregates the most cautious risk deterministically", () => {
    expect(
      aggregateRisk(["likely_ok", "check_documentation", "high_risk"]),
    ).toBe("high_risk");
    expect(aggregateRisk(["prior_permission_may_be_required", "unknown"])).toBe(
      "unknown",
    );
  });
});
