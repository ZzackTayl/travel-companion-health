import type { Airport } from "@/lib/airports";
import type { Evaluation, MedicationCategory } from "@/lib/guidance";

export type SavedTrip = {
  id: string;
  route: Airport[];
  departureDate: string;
  returnDate: string;
  medicineName: string;
  categories: MedicationCategory[];
  evaluation: Evaluation;
  createdAt: string;
  updatedAt: string;
};

const databaseName = "travel-companion-health";
const storeName = "saved-trips";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        let result: T;

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          database.close();
          reject(request.error);
        };
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      }),
  );
}

export function getSavedTrips() {
  return runRequest<SavedTrip[]>("readonly", (store) => store.getAll()).then(
    (trips) =>
      trips.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
  );
}

export function saveTrip(trip: SavedTrip) {
  return runRequest<IDBValidKey>("readwrite", (store) => store.put(trip));
}

export function deleteSavedTrip(id: string) {
  return runRequest<undefined>("readwrite", (store) => store.delete(id));
}

export function clearSavedTrips() {
  return runRequest<undefined>("readwrite", (store) => store.clear());
}
