import { airports } from "@/data/airports";
import type { Airport } from "@/lib/domain";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function scoreAirport(airport: Airport, rawQuery: string) {
  const query = normalize(rawQuery);
  const iata = normalize(airport.iataCode);
  const name = normalize(airport.name);
  const city = normalize(airport.city);
  const country = normalize(airport.countryName);
  const searchable = `${iata} ${name} ${city} ${country}`;

  if (iata === query) return 1000;
  if (iata.startsWith(query)) return 900;
  if (city === query) return 800;
  if (name === query) return 750;
  if (country === query) return 700;
  if (city.startsWith(query)) return 650;
  if (name.startsWith(query)) return 600;

  const tokens = query.split(/\s+/);
  if (!tokens.every((token) => searchable.includes(token))) return 0;

  return (
    300 +
    tokens.reduce((score, token) => {
      if (city.includes(token)) return score + 30;
      if (name.includes(token)) return score + 20;
      if (country.includes(token)) return score + 10;
      return score;
    }, 0)
  );
}

export function searchAirports(query: string, limit = 8) {
  const normalizedQuery = normalize(query);
  if (/^[a-z]{3}$/.test(normalizedQuery)) {
    const exactMatch = airports.find(
      ({ iataCode }) => normalize(iataCode) === normalizedQuery,
    );
    return exactMatch ? [exactMatch] : [];
  }

  return airports
    .map((airport) => ({ airport, score: scoreAirport(airport, query) }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.airport.city.localeCompare(right.airport.city) ||
        left.airport.iataCode.localeCompare(right.airport.iataCode),
    )
    .slice(0, limit)
    .map(({ airport }) => airport);
}

export function findAirportById(id: string) {
  return airports.find((airport) => airport.id === id);
}
