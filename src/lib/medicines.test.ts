import { describe, expect, it } from "vitest";
import { nonEmptyMedicines, selectedCategories } from "@/lib/medicines";
import type { LocalMedicine } from "@/lib/saved-trips";

describe("medicine normalization", () => {
  it("deduplicates category flags across medicines", () => {
    const medicines: LocalMedicine[] = [
      {
        id: "one",
        name: "local only",
        categories: ["injectable"],
      },
      {
        id: "two",
        name: "",
        categories: ["injectable", "refrigerated"],
      },
    ];

    expect(selectedCategories(medicines)).toEqual([
      "injectable",
      "refrigerated",
    ]);
    expect(nonEmptyMedicines(medicines)).toHaveLength(2);
  });
});
