const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return timestamp;
}

export function isValidDate(value: string) {
  return parseDate(value) !== null;
}

export function getTripDuration(departureDate?: string, returnDate?: string) {
  if (!departureDate || !returnDate) return null;
  const departure = parseDate(departureDate);
  const returning = parseDate(returnDate);
  if (departure === null || returning === null) {
    throw new Error("Dates must use a valid YYYY-MM-DD format");
  }
  if (returning < departure) {
    throw new Error("Return date must be on or after departure date");
  }
  return Math.floor((returning - departure) / DAY_MS) + 1;
}

export function getTravelReferenceDate(
  departureDate: string | undefined,
  returnDate: string | undefined,
  now = new Date(),
) {
  const requestedDate = returnDate ?? departureDate;
  if (!requestedDate) return now.toISOString().slice(0, 10);
  if (!isValidDate(requestedDate)) {
    throw new Error("Dates must use a valid YYYY-MM-DD format");
  }
  return requestedDate;
}

export function getDurationWarning(durationDays: number | null) {
  if (durationDays === null || durationDays <= 30) return null;
  return "Longer trips may need quantity-limit verification or prior permission.";
}
