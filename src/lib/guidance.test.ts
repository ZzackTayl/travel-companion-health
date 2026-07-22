import { describe, expect, it } from "vitest";
import { airports } from "@/data/airports";
import { launchCountryCodes } from "@/data/guidance";
import { medicationCategories } from "@/lib/domain";
import { aggregateRisk, evaluateGuidance } from "@/lib/guidance";

const launchMatrix = launchCountryCodes.flatMap((countryCode) =>
  medicationCategories.map((category) => ({ countryCode, category })),
);

const airportAuthorityMatrix = airports.flatMap((airport) =>
  medicationCategories.map((category) => ({
    airportCode: airport.iataCode,
    airportId: airport.id,
    countryCode: airport.countryCode,
    category,
  })),
);

const verifiedRestrictions = new Set([
  "GB:controlled_substance",
  "AE:controlled_substance",
  "JP:controlled_substance",
  "SG:controlled_substance",
]);

const verifiedAirportScreening = new Set([
  "LHR:liquid_over_100ml",
  "DXB:liquid_over_100ml",
]);

describe("guidance evaluation", () => {
  it("aggregates the most cautious risk deterministically", () => {
    expect(
      aggregateRisk(["likely_ok", "check_documentation", "high_risk"]),
    ).toBe("high_risk");
    expect(aggregateRisk(["prior_permission_may_be_required", "unknown"])).toBe(
      "unknown",
    );
  });

  it("keeps general guidance separate from category-specific coverage", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      medicationCategories: ["prescription"],
    });
    const unitedKingdom = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_gb",
    );

    expect(unitedKingdom?.generalGuidance).toEqual([
      expect.objectContaining({
        medicationCategory: null,
        guidanceType: "general",
        routeRole: "destination",
        confidence: "official_verified",
        isFallback: false,
      }),
    ]);
    expect(unitedKingdom?.categoryGuidance).toEqual([
      expect.objectContaining({
        medicationCategory: "prescription",
        guidanceType: "restricted",
        routeRole: "destination",
        riskLabel: "unknown",
        confidence: "unknown",
        isFallback: true,
        sources: [],
      }),
    ]);
    expect(result.overallRisk).toBe("unknown");
  });

  it("returns known category records without letting them cover other categories or types", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr", "airport_dxb"],
      medicationCategories: ["controlled_substance", "liquid_over_100ml"],
    });
    const unitedKingdom = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_gb",
    );
    const controlledRestriction = unitedKingdom?.categoryGuidance.find(
      (item) =>
        item.medicationCategory === "controlled_substance" &&
        item.guidanceType === "restricted",
    );
    const liquidRestriction = unitedKingdom?.categoryGuidance.find(
      (item) =>
        item.medicationCategory === "liquid_over_100ml" &&
        item.guidanceType === "restricted",
    );

    expect(result.overallRisk).toBe("high_risk");
    expect(controlledRestriction).toMatchObject({
      riskLabel: "prior_permission_may_be_required",
      confidence: "official_verified",
      isFallback: false,
    });
    expect(controlledRestriction?.sources.length).toBeGreaterThan(0);
    expect(liquidRestriction).toMatchObject({
      riskLabel: "unknown",
      confidence: "unknown",
      isFallback: true,
    });
    expect(
      result.jurisdictions
        .flatMap((jurisdiction) => [
          ...jurisdiction.generalGuidance,
          ...jurisdiction.categoryGuidance,
        ])
        .flatMap(({ actions }) => actions),
    ).not.toContain("Draft content must never be returned.");
  });

  it("does not let documentation guidance satisfy restriction coverage", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_lhr", "airport_jfk"],
      medicationCategories: ["injectable"],
    });
    const unitedStates = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_us",
    );

    expect(unitedStates?.categoryGuidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "restricted",
          riskLabel: "unknown",
          isFallback: true,
        }),
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "documentation",
          riskLabel: "check_documentation",
          isFallback: false,
        }),
      ]),
    );
    expect(result.overallRisk).toBe("unknown");
  });

  it("evaluates route roles independently", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr", "airport_lga"],
      medicationCategories: ["prescription"],
    });
    const unitedStates = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_us",
    );
    const unitedKingdom = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_gb",
    );

    expect(
      unitedStates?.categoryGuidance.map(({ routeRole }) => routeRole),
    ).toEqual(["origin", "destination"]);
    expect(unitedKingdom?.categoryGuidance).toEqual([
      expect.objectContaining({ routeRole: "transit", isFallback: true }),
    ]);
    expect(unitedKingdom?.generalGuidance).toEqual([
      expect.objectContaining({ routeRole: "transit", isFallback: false }),
    ]);
  });

  it("returns verified airport screening only for its exact category and role", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr", "airport_dxb"],
      medicationCategories: ["liquid_over_100ml"],
    });
    const heathrow = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "airport_authority_lhr",
    );

    expect(heathrow?.categoryGuidance).toEqual([
      expect.objectContaining({
        medicationCategory: "liquid_over_100ml",
        guidanceType: "screening",
        routeRole: "transit",
        confidence: "official_verified",
        isFallback: false,
      }),
    ]);
  });

  it("adds duration guidance only to general country guidance", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      departureDate: "2026-05-01",
      returnDate: "2026-06-15",
      medicationCategories: ["controlled_substance"],
    });
    const unitedStates = result.jurisdictions.find(
      ({ jurisdictionId }) => jurisdictionId === "country_us",
    );

    expect(result.durationDays).toBe(46);
    expect(result.durationWarning).toMatch(/quantity-limit/);
    expect(unitedStates?.generalGuidance[0].actions).toContain(
      result.durationWarning,
    );
    expect(
      unitedStates?.categoryGuidance.flatMap(({ actions }) => actions),
    ).not.toContain(result.durationWarning);
  });

  it("does not overstate confidence for an unknown medicine category", () => {
    const result = evaluateGuidance({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      medicationCategories: ["unknown"],
    });
    const unknownResult = result.jurisdictions
      .find(({ jurisdictionId }) => jurisdictionId === "country_us")
      ?.categoryGuidance.find(
        ({ medicationCategory }) => medicationCategory === "unknown",
      );

    expect(result.overallRisk).toBe("unknown");
    expect(unknownResult).toMatchObject({
      riskLabel: "unknown",
      confidence: "unknown",
      isFallback: true,
    });
    expect(unknownResult?.actions.join(" ")).toMatch(
      /Do not treat missing guidance as permission/,
    );
  });

  it.each(launchMatrix)(
    "returns a restriction result for $category in launch jurisdiction $countryCode",
    ({ countryCode, category }) => {
      const destination = airports.find(
        (airport) => airport.countryCode === countryCode,
      );
      const origin = airports.find(
        (airport) => airport.countryCode !== countryCode,
      );
      expect(destination).toBeDefined();
      expect(origin).toBeDefined();

      const result = evaluateGuidance({
        routeStopIds: [origin!.id, destination!.id],
        medicationCategories: [category],
      });
      const countryGuidance = result.jurisdictions.find(
        ({ jurisdictionId }) =>
          jurisdictionId === `country_${countryCode.toLocaleLowerCase()}`,
      );
      const restriction = countryGuidance?.categoryGuidance.find(
        (item) =>
          item.medicationCategory === category &&
          item.guidanceType === "restricted" &&
          item.routeRole === "destination",
      );

      expect(restriction).toBeDefined();
      expect(restriction?.isFallback).toBe(
        !verifiedRestrictions.has(`${countryCode}:${category}`),
      );
      expect(
        countryGuidance?.generalGuidance.every(
          ({ medicationCategory }) => medicationCategory === null,
        ),
      ).toBe(true);
    },
  );

  it.each(airportAuthorityMatrix)(
    "returns a screening result for $category at launch airport $airportCode",
    ({ airportCode, airportId, countryCode, category }) => {
      const origin = airports.find(
        (airport) => airport.countryCode !== countryCode,
      );
      expect(origin).toBeDefined();

      const result = evaluateGuidance({
        routeStopIds: [origin!.id, airportId],
        medicationCategories: [category],
      });
      const airportGuidance = result.jurisdictions.find(
        ({ jurisdictionId }) =>
          jurisdictionId ===
          `airport_authority_${airportCode.toLocaleLowerCase()}`,
      );
      const screening = airportGuidance?.categoryGuidance.find(
        (item) =>
          item.medicationCategory === category &&
          item.guidanceType === "screening" &&
          item.routeRole === "destination",
      );

      expect(screening).toBeDefined();
      expect(screening?.isFallback).toBe(
        !verifiedAirportScreening.has(`${airportCode}:${category}`),
      );
    },
  );
});
