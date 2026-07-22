import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripPlanner } from "@/components/trip-planner";
import type { Airport, GuidanceEvaluation, ResolvedRoute } from "@/lib/domain";
import { clearSavedTrips, closeSavedTripsDatabase } from "@/lib/saved-trips";

const jfk: Airport = {
  id: "airport_jfk",
  iataCode: "JFK",
  icaoCode: "KJFK",
  name: "John F. Kennedy International Airport",
  city: "New York",
  countryCode: "US",
  countryName: "United States",
};

const lhr: Airport = {
  id: "airport_lhr",
  iataCode: "LHR",
  icaoCode: "EGLL",
  name: "Heathrow Airport",
  city: "London",
  countryCode: "GB",
  countryName: "United Kingdom",
};

const route: ResolvedRoute = {
  stops: [
    { ...jfk, position: 0, role: "origin" },
    { ...lhr, position: 1, role: "destination" },
  ],
  countries: [],
  jurisdictions: [],
};

const evaluation: GuidanceEvaluation = {
  overallRisk: "unknown",
  durationDays: null,
  durationWarning: null,
  route,
  jurisdictions: [
    {
      jurisdictionId: "country_gb",
      name: "United Kingdom",
      countryCode: "GB",
      airportCodes: ["LHR"],
      roles: ["destination"],
      transitOnly: false,
      riskLabel: "unknown",
      confidence: "unknown",
      generalGuidance: [
        {
          medicationCategory: null,
          guidanceType: "general",
          routeRole: "destination",
          riskLabel: "check_documentation",
          actions: ["Keep medicines in original labeled packaging."],
          confidence: "official_verified",
          lastReviewedAt: "2026-06-15",
          sources: [
            {
              id: "source_gb",
              title: "Official United Kingdom guidance",
              url: "https://www.gov.uk/",
              sourceType: "government",
              qualityTier: 1,
              lastVerifiedAt: "2026-06-15",
            },
          ],
          isFallback: false,
        },
      ],
      categoryGuidance: [
        {
          medicationCategory: "controlled_substance",
          guidanceType: "restricted",
          routeRole: "destination",
          riskLabel: "unknown",
          actions: [
            "Official restrictions have not been verified. Do not treat missing guidance as permission.",
          ],
          confidence: "unknown",
          lastReviewedAt: "",
          sources: [],
          isFallback: true,
        },
      ],
    },
  ],
};

afterEach(async () => {
  vi.restoreAllMocks();
  await clearSavedTrips();
  await closeSavedTripsDatabase();
});

describe("TripPlanner", () => {
  it("sends categories without medicine names and invalidates changed guidance", async () => {
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        requests.push({ url, body: init?.body?.toString() });
        if (url.startsWith("/api/airports/search")) {
          const airport = url.includes("JFK") ? jfk : lhr;
          return Response.json({ results: [airport] });
        }
        if (url === "/api/routes/resolve") return Response.json(route);
        if (url === "/api/guidance/evaluate") return Response.json(evaluation);
        return Response.json({ error: "Unexpected request" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    render(<TripPlanner />);

    const search = screen.getByLabelText(
      "Airport code, airport, city, or country",
    );
    await user.type(search, "JFK");
    await user.click(await screen.findByRole("button", { name: /JFK/ }));
    await user.type(search, "LHR");
    await user.click(await screen.findByRole("button", { name: /LHR/ }));

    await user.type(
      screen.getByLabelText("Medicine name (saved locally only)"),
      "private medicine name",
    );
    await user.click(screen.getByLabelText("Controlled substance"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Get route guidance" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Get route guidance" }),
    );
    await screen.findByText("Overall result");
    expect(screen.getByText("General route guidance")).toBeInTheDocument();
    expect(
      screen.getByText("Medication category guidance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Do not treat missing guidance as permission/),
    ).toBeInTheDocument();

    const guidanceRequest = requests.find(
      ({ url }) => url === "/api/guidance/evaluate",
    );
    const payload = JSON.parse(guidanceRequest?.body ?? "{}");
    expect(payload).toEqual({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      medicationCategories: ["controlled_substance"],
    });
    expect(guidanceRequest?.body).not.toContain("private medicine name");

    await user.click(screen.getByLabelText("Injectable"));
    expect(
      screen.getByText("Your route guidance will appear here"),
    ).toBeInTheDocument();
  });
});
