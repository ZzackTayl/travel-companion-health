import { searchAirports } from "@/lib/airports";
import { jsonNoStore } from "@/lib/http";
import { airportSearchSchema, validationError } from "@/lib/validation";

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = airportSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) return validationError(parsed.error);

  const results = searchAirports(parsed.data.q, parsed.data.limit);
  return jsonNoStore({
    count: results.length,
    results,
  });
}
