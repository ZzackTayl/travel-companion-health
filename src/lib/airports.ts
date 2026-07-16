export type Airport = {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
};

export const airports: Airport[] = [
  {
    id: "jfk",
    code: "JFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    country: "United States",
    countryCode: "US",
  },
  {
    id: "lga",
    code: "LGA",
    name: "LaGuardia Airport",
    city: "New York",
    country: "United States",
    countryCode: "US",
  },
  {
    id: "lax",
    code: "LAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
    countryCode: "US",
  },
  {
    id: "sfo",
    code: "SFO",
    name: "San Francisco International Airport",
    city: "San Francisco",
    country: "United States",
    countryCode: "US",
  },
  {
    id: "ord",
    code: "ORD",
    name: "O'Hare International Airport",
    city: "Chicago",
    country: "United States",
    countryCode: "US",
  },
  {
    id: "lhr",
    code: "LHR",
    name: "Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
  },
  {
    id: "lgw",
    code: "LGW",
    name: "Gatwick Airport",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
  },
  {
    id: "cdg",
    code: "CDG",
    name: "Charles de Gaulle Airport",
    city: "Paris",
    country: "France",
    countryCode: "FR",
  },
  {
    id: "ory",
    code: "ORY",
    name: "Paris Orly Airport",
    city: "Paris",
    country: "France",
    countryCode: "FR",
  },
  {
    id: "fco",
    code: "FCO",
    name: "Leonardo da Vinci–Fiumicino Airport",
    city: "Rome",
    country: "Italy",
    countryCode: "IT",
  },
  {
    id: "dxb",
    code: "DXB",
    name: "Dubai International Airport",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
  },
  {
    id: "nrt",
    code: "NRT",
    name: "Narita International Airport",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
  },
  {
    id: "hnd",
    code: "HND",
    name: "Haneda Airport",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
  },
  {
    id: "yyz",
    code: "YYZ",
    name: "Toronto Pearson International Airport",
    city: "Toronto",
    country: "Canada",
    countryCode: "CA",
  },
];

export function searchAirports(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return airports
    .map((airport) => {
      const code = airport.code.toLowerCase();
      const searchable = [
        airport.name,
        airport.city,
        airport.country,
        airport.code,
      ].map((value) => value.toLowerCase());
      const exactCode = code === normalizedQuery;
      const startsWithCode = code.startsWith(normalizedQuery);
      const startsWithValue = searchable.some((value) =>
        value.startsWith(normalizedQuery),
      );
      const includesValue = searchable.some((value) =>
        value.includes(normalizedQuery),
      );

      return {
        airport,
        score: exactCode
          ? 4
          : startsWithCode
            ? 3
            : startsWithValue
              ? 2
              : includesValue
                ? 1
                : 0,
      };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.airport.code.localeCompare(right.airport.code),
    )
    .slice(0, 6)
    .map(({ airport }) => airport);
}
