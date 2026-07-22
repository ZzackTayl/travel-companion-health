import { describe, expect, it } from "vitest";
import { evaluateGuidance } from "@/lib/guidance";
import {
  buildTravelCardModel,
  formatTravelCardPlainText,
} from "@/lib/travel-card";

describe("travel card", () => {
  it("formats a readable card without exporting medicine names", () => {
    const evaluation = evaluateGuidance(
      {
        routeStopIds: ["airport_jfk", "airport_lhr"],
        medicationCategories: ["injectable"],
      },
      new Date("2026-07-22T00:00:00.000Z"),
    );
    const model = buildTravelCardModel(evaluation, "", "", [
      {
        id: "medicine_1",
        name: "private medicine name",
        categories: ["injectable"],
      },
    ]);
    const text = formatTravelCardPlainText(model);

    expect(text).toContain("JFK → LHR");
    expect(text).toContain("injectable");
    expect(text).toMatch(/missing guidance as permission/i);
    expect(text).not.toContain("private medicine name");
  });
});
