import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/guidance/evaluate/route";

function request(body: unknown) {
  return new Request("http://localhost/api/guidance/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/guidance/evaluate", () => {
  it("accepts only normalized, privacy-safe inputs", async () => {
    const response = await POST(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-05-12",
        returnDate: "2026-05-22",
        medicationCategories: ["injectable"],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      contractVersion: 2,
      completeness: "partial",
      durationDays: 11,
      dataProvenance: {
        mode: "prototype_fixture",
        productionEligible: false,
      },
    });
  });

  it("rejects medicine names and unknown categories", async () => {
    const medicineNameResponse = await POST(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["prescription"],
        medicineName: "must-not-leave-client",
      }),
    );
    const categoryResponse = await POST(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["not_normalized"],
      }),
    );

    expect(medicineNameResponse.status).toBe(400);
    expect(categoryResponse.status).toBe(400);
  });

  it("rejects invalid travel dates before evaluation", async () => {
    const response = await POST(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        departureDate: "2026-05-22",
        returnDate: "2026-05-12",
        medicationCategories: [],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues).toContainEqual(
      expect.objectContaining({ path: "returnDate" }),
    );
  });

  it("rejects oversized request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/guidance/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(17 * 1024) }),
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("fails closed instead of serving fixtures in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(
      request({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: [],
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "GUIDANCE_DATA_UNAVAILABLE",
    });
  });
});
