import { describe, expect, it } from "vitest";
import { resolveRoute } from "@/lib/routes";

describe("resolveRoute", () => {
  it("preserves stop roles and deduplicates countries with route context", () => {
    const route = resolveRoute(["airport_jfk", "airport_lhr", "airport_lgw"]);

    expect(route.stops.map(({ role }) => role)).toEqual([
      "origin",
      "transit",
      "destination",
    ]);
    expect(route.countries).toHaveLength(2);
    expect(route.countries[1]).toMatchObject({
      countryCode: "GB",
      roles: ["transit", "destination"],
      routePositions: [1, 2],
      airportCodes: ["LHR", "LGW"],
      transitOnly: false,
    });
  });

  it("marks a deduplicated intermediate country as transit-only", () => {
    const route = resolveRoute(["airport_jfk", "airport_lhr", "airport_dxb"]);

    expect(route.countries[1]).toMatchObject({
      countryCode: "GB",
      roles: ["transit"],
      transitOnly: true,
    });
  });

  it("rejects unknown airport IDs", () => {
    expect(() => resolveRoute(["airport_jfk", "airport_missing"])).toThrow(
      "Unknown airport IDs: airport_missing",
    );
  });
});
