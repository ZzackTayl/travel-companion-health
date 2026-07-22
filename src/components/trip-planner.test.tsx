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
          staleAfter: "2026-10-01T00:00:00.000Z",
          revisionIds: ["revision-gb-general"],
          coverage: {
            requested: 1,
            covered: 1,
            unknown: 0,
            complete: true,
            items: [
              {
                id: "country:GB:general:all:destination",
                jurisdictionId: "country_gb",
                medicationCategory: null,
                guidanceType: "general",
                status: "covered",
                reason: "covered",
                revisionId: "revision-gb-general",
                lastReviewedAt: "2026-06-15",
                staleAfter: "2026-10-01T00:00:00.000Z",
                effectiveFrom: null,
                effectiveTo: null,
              },
            ],
          },
          sources: [
            {
              id: "source_gb",
              title: "Official United Kingdom guidance",
              url: "https://www.gov.uk/",
              sourceType: "government",
              qualityTier: 1,
              excerpt:
                "Travelers should keep medicines in their original packaging.",
              accessedAt: "2026-06-15T00:00:00.000Z",
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
          staleAfter: null,
          revisionIds: [],
          coverage: {
            requested: 1,
            covered: 0,
            unknown: 1,
            complete: false,
            items: [
              {
                id: "country:GB:restricted:controlled_substance:destination",
                jurisdictionId: "country_gb",
                medicationCategory: "controlled_substance",
                guidanceType: "restricted",
                status: "unknown",
                reason: "missing_or_ineligible",
                revisionId: null,
                lastReviewedAt: null,
                staleAfter: null,
                effectiveFrom: null,
                effectiveTo: null,
              },
            ],
          },
          sources: [],
          isFallback: true,
        },
      ],
    },
  ],
  metadata: {
    evaluation: {
      id: "evaluation-test",
      evaluatedAt: "2026-07-22T12:00:00.000Z",
      contractVersion: 2,
    },
    revisions: { ids: ["revision-gb-general"] },
    freshness: {
      status: "incomplete",
      earliestStaleAfter: "2026-10-01T00:00:00.000Z",
    },
    evidence: {
      sourceCount: 1,
      sourceIds: ["source_gb"],
      oldestVerifiedAt: "2026-06-15",
    },
    coverage: {
      requested: 2,
      covered: 1,
      unknown: 1,
      complete: false,
      items: [],
    },
  },
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

  it("does not apply an evaluation after its inputs change", async () => {
    let resolveEvaluation!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.startsWith("/api/airports/search")) {
          return Promise.resolve(
            Response.json({ results: [url.includes("JFK") ? jfk : lhr] }),
          );
        }
        if (url === "/api/routes/resolve") {
          return Promise.resolve(Response.json(route));
        }
        if (url === "/api/guidance/evaluate") {
          return new Promise<Response>((resolve) => {
            resolveEvaluation = resolve;
          });
        }
        return Promise.resolve(
          Response.json({ error: "Unexpected request" }, { status: 500 }),
        );
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Get route guidance" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Get route guidance" }),
    );
    await user.click(screen.getByLabelText("Controlled substance"));
    resolveEvaluation(Response.json(evaluation));

    await waitFor(() =>
      expect(
        screen.getByText("Your route guidance will appear here"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Overall result")).not.toBeInTheDocument();
  });

  it("clears a previous result when reevaluation fails closed", async () => {
    let evaluationCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.startsWith("/api/airports/search")) {
          return Response.json({
            results: [url.includes("JFK") ? jfk : lhr],
          });
        }
        if (url === "/api/routes/resolve") return Response.json(route);
        if (url === "/api/guidance/evaluate") {
          evaluationCount += 1;
          return evaluationCount === 1
            ? Response.json(evaluation)
            : Response.json(
                { error: "Verified guidance is temporarily unavailable." },
                { status: 503 },
              );
        }
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Get route guidance" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Get route guidance" }),
    );
    await screen.findByText("Overall result");
    await user.click(
      screen.getByRole("button", { name: "Get route guidance" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /temporarily unavailable/i,
    );
    expect(
      screen.getByText("Your route guidance will appear here"),
    ).toBeInTheDocument();
  });
});
