import { findAirportById } from "@/lib/airports";
import type {
  ResolvedJurisdiction,
  ResolvedRoute,
  RouteRole,
} from "@/lib/domain";

export class RouteResolutionError extends Error {
  readonly code: "ADJACENT_DUPLICATE_STOP" | "UNKNOWN_AIRPORT_ID";

  constructor(
    code: "ADJACENT_DUPLICATE_STOP" | "UNKNOWN_AIRPORT_ID",
    message: string,
  ) {
    super(message);
    this.name = "RouteResolutionError";
    this.code = code;
  }
}

function roleAt(position: number, stopCount: number): RouteRole {
  if (position === 0) return "origin";
  if (position === stopCount - 1) return "destination";
  return "transit";
}

function mergeJurisdiction(
  collection: Map<string, ResolvedJurisdiction>,
  jurisdiction: Omit<
    ResolvedJurisdiction,
    "roles" | "routePositions" | "airportIds" | "airportCodes" | "transitOnly"
  >,
  role: RouteRole,
  position: number,
  airportId: string,
  airportCode: string,
) {
  const current = collection.get(jurisdiction.id);
  if (current) {
    if (!current.roles.includes(role)) current.roles.push(role);
    if (!current.routePositions.includes(position))
      current.routePositions.push(position);
    if (!current.airportIds.includes(airportId))
      current.airportIds.push(airportId);
    if (!current.airportCodes.includes(airportCode))
      current.airportCodes.push(airportCode);
    current.transitOnly = current.roles.every((item) => item === "transit");
    return;
  }

  collection.set(jurisdiction.id, {
    ...jurisdiction,
    roles: [role],
    routePositions: [position],
    airportIds: [airportId],
    airportCodes: [airportCode],
    transitOnly: role === "transit",
  });
}

export function resolveRoute(routeStopIds: string[]): ResolvedRoute {
  const duplicatePosition = routeStopIds.findIndex(
    (id, position) => position > 0 && routeStopIds[position - 1] === id,
  );
  if (duplicatePosition >= 0) {
    throw new RouteResolutionError(
      "ADJACENT_DUPLICATE_STOP",
      "Adjacent route stops must be different airports",
    );
  }

  const unknownIds: string[] = [];
  const stops = routeStopIds.flatMap((id, position) => {
    const airport = findAirportById(id);
    if (!airport) {
      unknownIds.push(id);
      return [];
    }
    return [
      { ...airport, position, role: roleAt(position, routeStopIds.length) },
    ];
  });

  if (unknownIds.length > 0) {
    throw new RouteResolutionError(
      "UNKNOWN_AIRPORT_ID",
      `Unknown airport IDs: ${unknownIds.join(", ")}`,
    );
  }

  const countries = new Map<string, ResolvedJurisdiction>();
  const jurisdictions = new Map<string, ResolvedJurisdiction>();

  for (const stop of stops) {
    const country = {
      id: `country_${stop.countryCode.toLocaleLowerCase()}`,
      type: "country" as const,
      name: stop.countryName,
      countryCode: stop.countryCode,
      code: stop.countryCode,
    };
    const authority = {
      id: `airport_authority_${stop.iataCode.toLocaleLowerCase()}`,
      type: "airport_authority" as const,
      name: `${stop.name} authority`,
      countryCode: stop.countryCode,
      code: stop.iataCode,
    };

    mergeJurisdiction(
      countries,
      country,
      stop.role,
      stop.position,
      stop.id,
      stop.iataCode,
    );
    mergeJurisdiction(
      jurisdictions,
      country,
      stop.role,
      stop.position,
      stop.id,
      stop.iataCode,
    );
    mergeJurisdiction(
      jurisdictions,
      authority,
      stop.role,
      stop.position,
      stop.id,
      stop.iataCode,
    );
  }

  return {
    stops,
    countries: [...countries.values()],
    jurisdictions: [...jurisdictions.values()],
  };
}
