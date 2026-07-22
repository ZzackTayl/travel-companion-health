import { medicationCategories, type MedicationCategory } from "@/lib/domain";
import type { LocalMedicine } from "@/lib/saved-trips";

export { medicationCategories };

export const categoryLabels: Record<MedicationCategory, string> = {
  prescription: "Prescription medicine",
  over_the_counter: "Over-the-counter medicine",
  controlled_substance: "Controlled substance",
  opioid: "Opioid",
  stimulant_adhd: "ADHD stimulant",
  sedative_anxiety: "Sedative or anxiety medicine",
  sleep_medication: "Sleep medicine",
  pseudoephedrine: "Pseudoephedrine",
  cannabis_derived: "Cannabis-derived product",
  injectable: "Injectable",
  liquid_over_100ml: "Liquid over 100 mL",
  refrigerated: "Refrigerated medicine",
  medical_device: "Medical device",
  needles_or_sharps: "Needles or sharps",
  unknown: "Not sure",
};

export function createLocalMedicine(): LocalMedicine {
  return { id: crypto.randomUUID(), name: "", categories: [] };
}

export function nonEmptyMedicines(medicines: LocalMedicine[]) {
  return medicines.filter(
    ({ name, categories }) => name.trim() || categories.length > 0,
  );
}

export function selectedCategories(medicines: LocalMedicine[]) {
  return [
    ...new Set(
      nonEmptyMedicines(medicines).flatMap(({ categories }) => categories),
    ),
  ].sort() as MedicationCategory[];
}
