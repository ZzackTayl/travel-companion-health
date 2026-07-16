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
    expect(await response.json()).toMatchObject({
      overallRisk: "check_documentation",
      durationDays: 11,
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
