import { describe, expect, it } from "vitest";
import {
  getDurationWarning,
  getTravelReferenceDate,
  getTripDuration,
  isValidDate,
} from "@/lib/dates";

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

  it("validates standalone calendar dates", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
  });

  it("uses the end of the known trip as the guidance reference date", () => {
    expect(
      getTravelReferenceDate(
        "2026-05-12",
        "2026-05-22",
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toBe("2026-05-22");
  });
});
