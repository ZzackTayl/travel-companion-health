import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/airports";

describe("searchAirports", () => {
  it("ranks an exact IATA match first", () => {
    const results = searchAirports("JFK");

    expect(results[0]).toMatchObject({
      id: "airport_jfk",
      iataCode: "JFK",
      city: "New York",
    });
  });

  it("returns all matching city airports in stable order", () => {
    const results = searchAirports("London");

    expect(results.map(({ iataCode }) => iataCode)).toEqual(["LGW", "LHR"]);
  });

  it("matches countries and accent-insensitive city names", () => {
    expect(searchAirports("Japan").map(({ iataCode }) => iataCode)).toEqual([
      "HND",
      "NRT",
    ]);
    expect(searchAirports("Sao Paulo")[0].iataCode).toBe("GRU");
  });

  it("honors the result limit", () => {
    expect(searchAirports("United States", 2)).toHaveLength(2);
  });
});
