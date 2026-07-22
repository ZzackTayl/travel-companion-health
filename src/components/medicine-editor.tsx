"use client";

import type { MedicationCategory } from "@/lib/domain";
import {
  categoryLabels,
  createLocalMedicine,
  medicationCategories,
} from "@/lib/medicines";
import type { LocalMedicine } from "@/lib/saved-trips";

interface MedicineEditorProps {
  medicines: LocalMedicine[];
  onChange: (medicines: LocalMedicine[]) => void;
}

export function MedicineEditor({ medicines, onChange }: MedicineEditorProps) {
  function update(
    id: string,
    transform: (medicine: LocalMedicine) => LocalMedicine,
  ) {
    onChange(
      medicines.map((medicine) =>
        medicine.id === id ? transform(medicine) : medicine,
      ),
    );
  }

  function toggle(id: string, category: MedicationCategory) {
    update(id, (medicine) => {
      if (medicine.categories.includes(category)) {
        return {
          ...medicine,
          categories: medicine.categories.filter((item) => item !== category),
        };
      }
      return {
        ...medicine,
        categories:
          category === "unknown"
            ? ["unknown"]
            : [
                ...medicine.categories.filter((item) => item !== "unknown"),
                category,
              ],
      };
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        3 · Medicine context (optional)
      </p>
      <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100">
        Medicine names stay in this browser. Only normalized category flags are
        sent for evaluation. Saved details may be visible to other people using
        this browser profile.
      </div>
      <div className="mt-4 space-y-4">
        {medicines.map((medicine, index) => (
          <fieldset
            key={medicine.id}
            className="rounded-xl border border-white/15 p-4"
          >
            <legend className="px-2 text-sm font-semibold">
              Medicine {index + 1}
            </legend>
            <label className="block text-sm font-medium">
              Medicine name (saved locally only)
              <input
                aria-label={
                  index === 0
                    ? "Medicine name (saved locally only)"
                    : `Medicine ${index + 1} name (saved locally only)`
                }
                value={medicine.name}
                onChange={(event) =>
                  update(medicine.id, (current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                autoComplete="off"
                maxLength={200}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/30 bg-slate-950 px-4"
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {medicationCategories.map((category) => (
                <label
                  key={category}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={medicine.categories.includes(category)}
                    onChange={() => toggle(medicine.id, category)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                  {categoryLabels[category]}
                </label>
              ))}
            </div>
            {medicines.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  onChange(medicines.filter(({ id }) => id !== medicine.id))
                }
                className="mt-3 min-h-11 text-sm text-rose-200 underline"
              >
                Remove medicine {index + 1}
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...medicines, createLocalMedicine()])}
        className="mt-4 min-h-11 rounded-full border border-white/20 px-4"
      >
        Add another medicine
      </button>
    </section>
  );
}
