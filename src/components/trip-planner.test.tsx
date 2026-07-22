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
  overallRisk: "check_documentation",
  durationDays: null,
  durationWarning: null,
  route,
  jurisdictions: [],
  metadata: {
    evaluation: {
      id: "evaluation-test",
      evaluatedAt: "2026-07-22T12:00:00.000Z",
      contractVersion: 2,
    },
    revisions: { ids: [] },
    freshness: { status: "fresh", earliestStaleAfter: null },
    evidence: { sourceCount: 0, sourceIds: [], oldestVerifiedAt: null },
    coverage: {
      requested: 0,
      covered: 0,
      unknown: 0,
      complete: true,
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
