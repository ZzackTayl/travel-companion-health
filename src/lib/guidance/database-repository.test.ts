import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DatabaseGuidanceRepository,
  GuidanceDatabaseError,
} from "./database-repository";

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "revision-1",
    jurisdiction_id: "jurisdiction-1",
    jurisdiction_type: "country",
    jurisdiction_code: "US",
    medication_category_id: null,
    medication_category_slug: null,
    guidance_type: "general",
    risk_label: "check_documentation",
    title: "Official guidance",
    summary: "Official requirements may include documentation.",
    action_text: "Check current requirements with the official authority.",
    applies_to_transit: true,
    effective_from: null,
    effective_to: null,
    status: "published",
    confidence: "official_verified",
    last_reviewed_at: "2026-07-20T00:00:00.000Z",
    stale_after: "2026-10-01T00:00:00.000Z",
    reviewed_for_publication: true,
    lower_tier_evidence_approved: false,
    sources: [
      {
        id: "source-1",
        url: "https://government.example/medicine",
        title: "Official medicine guidance",
        sourceType: "government",
        qualityTier: 1,
        excerpt:
          "Travelers should carry medicine with the documentation required by authorities.",
        accessedAt: "2026-07-20T00:00:00.000Z",
        lastVerifiedAt: "2026-07-20T00:00:00.000Z",
        supportsSummary: true,
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DatabaseGuidanceRepository", () => {
  it("rejects non-loopback plaintext database URLs", () => {
    expect(
      () =>
        new DatabaseGuidanceRepository({
          baseUrl: "http://database.example",
          publicKey: "public-key",
        }),
    ).toThrow(GuidanceDatabaseError);
  });

  it("uses the kill-switch-protected route RPC without caching", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json([publicRow()]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new DatabaseGuidanceRepository({
      baseUrl: "https://database.example",
      publicKey: "public-key",
    });

    const records = await repository.getGuidanceForRoute([
      {
        type: "country",
        code: "US",
        medicationCategorySlug: null,
        guidanceType: "general",
      },
    ]);

    expect(records[0]).toMatchObject({
      id: "revision-1",
      jurisdictionType: "country",
      jurisdictionCode: "US",
      medicationCategorySlug: null,
      status: "published",
    });
    expect(records[0].sources[0].lastVerifiedAt).toEqual(
      new Date("2026-07-20T00:00:00.000Z"),
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://database.example/rest/v1/rpc/get_public_guidance_for_route",
    );
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({
        p_requirements: [
          {
            type: "country",
            code: "US",
            medicationCategorySlug: null,
            guidanceType: "general",
          },
        ],
      }),
    });
    expect(new Headers(options?.headers).get("authorization")).toBe(
      "Bearer public-key",
    );
  });

  it.each([
    ["draft status", publicRow({ status: "draft" })],
    ["missing evidence", publicRow({ sources: [] })],
    ["invalid date", publicRow({ stale_after: "not-a-date" })],
  ])("rejects a malformed public payload with %s", async (_label, row) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([row])),
    );
    const repository = new DatabaseGuidanceRepository({
      baseUrl: "https://database.example",
      publicKey: "public-key",
    });

    await expect(
      repository.getGuidanceForRoute([
        {
          type: "country",
          code: "US",
          medicationCategorySlug: null,
          guidanceType: "general",
        },
      ]),
    ).rejects.toBeInstanceOf(GuidanceDatabaseError);
  });

  it("requires an audited reason for per-record archival requests", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json([]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new DatabaseGuidanceRepository({
      baseUrl: "https://database.example",
      publicKey: "public-key",
      adminAccessToken: "admin-token",
    });

    await repository.archiveGuidance(
      "revision-1",
      "Emergency correction requested",
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://database.example/rest/v1/rpc/archive_guidance");
    expect(options?.body).toBe(
      JSON.stringify({
        p_guidance_id: "revision-1",
        p_reason: "Emergency correction requested",
      }),
    );
    expect(new Headers(options?.headers).get("authorization")).toBe(
      "Bearer admin-token",
    );
  });

  it("sends global kill-switch changes through the audited admin RPC", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(false),
    );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new DatabaseGuidanceRepository({
      baseUrl: "https://database.example",
      publicKey: "public-key",
      adminAccessToken: "admin-token",
    });

    await repository.setPublicEvaluationEnabled(
      false,
      "Emergency global withdrawal",
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://database.example/rest/v1/rpc/set_guidance_public_evaluation_enabled",
    );
    expect(options?.body).toBe(
      JSON.stringify({
        p_enabled: false,
        p_reason: "Emergency global withdrawal",
      }),
    );
    expect(new Headers(options?.headers).get("authorization")).toBe(
      "Bearer admin-token",
    );
  });
});
