import { describe, expect, it } from "vitest";
import { getDurationWarning, getTripDuration } from "@/lib/dates";

describe("trip duration", () => {
  it("counts both travel dates", () => {
    expect(getTripDuration("2026-05-12", "2026-05-22")).toBe(11);
  });

  it("returns no duration when either date is omitted", () => {
    expect(getTripDuration("2026-05-12")).toBeNull();
  });

  it("rejects invalid ranges and calendar dates", () => {
    expect(() => getTripDuration("2026-05-12", "2026-05-11")).toThrow(
      "Return date must be on or after departure date",
    );
    expect(() => getTripDuration("2026-02-30", "2026-03-02")).toThrow(
      "Dates must use a valid YYYY-MM-DD format",
    );
  });

  it("warns only for trips longer than 30 days", () => {
    expect(getDurationWarning(30)).toBeNull();
    expect(getDurationWarning(31)).toMatch(/quantity-limit verification/);
  });
});
