import { searchAirports } from "@/lib/airports";
import { airportSearchSchema, validationError } from "@/lib/validation";

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = airportSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) return validationError(parsed.error);

  const results = searchAirports(parsed.data.q, parsed.data.limit);
  return Response.json({
    query: parsed.data.q,
    count: results.length,
    results,
  });
}
