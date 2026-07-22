import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/guidance/evaluate/route";

function request(body: unknown) {
  return new Request("http://localhost/api/guidance/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
    const body = await response.json();
    expect(body).toMatchObject({
      overallRisk: "unknown",
      durationDays: 11,
    });
    expect(
      body.jurisdictions.find(
        ({ jurisdictionId }: { jurisdictionId: string }) =>
          jurisdictionId === "country_us",
      ),
    ).toMatchObject({
      riskLabel: "unknown",
      generalGuidance: [
        expect.objectContaining({
          medicationCategory: null,
          confidence: "official_verified",
        }),
      ],
      categoryGuidance: expect.arrayContaining([
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "restricted",
          riskLabel: "unknown",
          isFallback: true,
        }),
        expect.objectContaining({
          medicationCategory: "injectable",
          guidanceType: "documentation",
          isFallback: false,
        }),
      ]),
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
});
