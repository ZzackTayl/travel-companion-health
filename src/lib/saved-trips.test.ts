import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSavedTrips,
  closeSavedTripsDatabase,
  deleteSavedTrip,
  getSavedTrip,
  listSavedTrips,
  saveTrip,
} from "@/lib/saved-trips";
import type { GuidanceEvaluation } from "@/lib/domain";

const guidance = {
  overallRisk: "likely_ok",
  durationDays: null,
  durationWarning: null,
  route: { stops: [], countries: [], jurisdictions: [] },
  jurisdictions: [],
} satisfies GuidanceEvaluation;

describe("saved trips IndexedDB repository", () => {
  beforeEach(clearSavedTrips);
  afterEach(closeSavedTripsDatabase);

  it("persists local medicine names without a server call", async () => {
    const saved = await saveTrip({
      id: "trip_1",
      routeStops: [],
      medicines: [
        {
          id: "medicine_1",
          name: "local-only name",
          categories: ["prescription"],
        },
      ],
      evaluatedGuidanceSnapshot: guidance,
    });

    await closeSavedTripsDatabase();

    expect(await getSavedTrip(saved.id)).toMatchObject({
      medicines: [{ name: "local-only name" }],
    });
  });

  it("lists newest records first and deletes individual records", async () => {
    await saveTrip({
      id: "trip_old",
      createdAt: "2026-01-01T00:00:00.000Z",
      routeStops: [],
      medicines: [],
      evaluatedGuidanceSnapshot: guidance,
    });
    await saveTrip({
      id: "trip_new",
      routeStops: [],
      medicines: [],
      evaluatedGuidanceSnapshot: guidance,
    });

    expect((await listSavedTrips()).map(({ id }) => id)).toEqual([
      "trip_new",
      "trip_old",
    ]);

    await deleteSavedTrip("trip_new");
    expect(await getSavedTrip("trip_new")).toBeUndefined();
  });

  it("clears all locally saved trips", async () => {
    await saveTrip({
      id: "trip_1",
      routeStops: [],
      medicines: [],
      evaluatedGuidanceSnapshot: guidance,
    });

    await clearSavedTrips();

    expect(await listSavedTrips()).toEqual([]);
  });
});
