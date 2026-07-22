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

  it("rejects adjacent duplicate stops", () => {
    expect(() => resolveRoute(["airport_jfk", "airport_jfk"])).toThrow(
      "Adjacent route stops must be different airports",
    );
  });

  it("allows a non-adjacent return to the origin", () => {
    expect(
      resolveRoute(["airport_jfk", "airport_lhr", "airport_jfk"]).stops.map(
        ({ role }) => role,
      ),
    ).toEqual(["origin", "transit", "destination"]);
  });
});
