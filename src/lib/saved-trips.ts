import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Airport,
  GuidanceEvaluation,
  MedicationCategory,
} from "@/lib/domain";

export interface LocalMedicine {
  id: string;
  name: string;
  categories: MedicationCategory[];
}

export interface SavedTrip {
  schemaVersion?: 2;
  id: string;
  routeStops: Airport[];
  departureDate?: string;
  returnDate?: string;
  medicines: LocalMedicine[];
  evaluatedGuidanceSnapshot: GuidanceEvaluation;
  createdAt: string;
  updatedAt: string;
}

interface SavedTripsDatabase extends DBSchema {
  trips: {
    key: string;
    value: SavedTrip;
    indexes: { "by-updated": string };
  };
}

let databasePromise: Promise<IDBPDatabase<SavedTripsDatabase>> | undefined;

function getDatabase() {
  databasePromise ??= openDB<SavedTripsDatabase>("travel-companion-health", 1, {
    upgrade(database) {
      const store = database.createObjectStore("trips", { keyPath: "id" });
      store.createIndex("by-updated", "updatedAt");
    },
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function saveTrip(
  trip: Omit<SavedTrip, "id" | "createdAt" | "updatedAt"> &
    Partial<Pick<SavedTrip, "id" | "createdAt">>,
) {
  const now = new Date().toISOString();
  const record: SavedTrip = {
    ...trip,
    schemaVersion: 2,
    id: trip.id ?? crypto.randomUUID(),
    createdAt: trip.createdAt ?? now,
    updatedAt: now,
  };
  await (await getDatabase()).put("trips", record);
  return record;
}

export async function getSavedTrip(id: string) {
  return (await getDatabase()).get("trips", id);
}

export async function listSavedTrips() {
  const records = await (
    await getDatabase()
  ).getAllFromIndex("trips", "by-updated");
  return records.reverse();
}

export async function deleteSavedTrip(id: string) {
  await (await getDatabase()).delete("trips", id);
}

export async function clearSavedTrips() {
  await (await getDatabase()).clear("trips");
}

export async function closeSavedTripsDatabase() {
  if (!databasePromise) return;
  (await databasePromise).close();
  databasePromise = undefined;
}
