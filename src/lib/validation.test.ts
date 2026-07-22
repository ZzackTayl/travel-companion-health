import { describe, expect, it } from "vitest";
import { guidanceRequestSchema, routeRequestSchema } from "@/lib/validation";

describe("request validation", () => {
  it("rejects adjacent duplicate route stops", () => {
    expect(
      routeRequestSchema.safeParse({
        routeStopIds: ["airport_jfk", "airport_jfk"],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid and incomplete date ranges", () => {
    const invalidDate = guidanceRequestSchema.safeParse({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      departureDate: "2026-02-30",
      medicationCategories: [],
    });
    const returnOnly = guidanceRequestSchema.safeParse({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      returnDate: "2026-05-22",
      medicationCategories: [],
    });

    expect(invalidDate.success).toBe(false);
    expect(returnOnly.success).toBe(false);
  });

  it("rejects a return before departure", () => {
    const result = guidanceRequestSchema.safeParse({
      routeStopIds: ["airport_jfk", "airport_lhr"],
      departureDate: "2026-05-22",
      returnDate: "2026-05-12",
      medicationCategories: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("returnDate");
    }
  });

  it("does not combine the unknown category with known categories", () => {
    expect(
      guidanceRequestSchema.safeParse({
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["unknown", "injectable"],
      }).success,
    ).toBe(false);
  });
});
