import { resolveRoute, RouteResolutionError } from "@/lib/routes";
import { routeRequestSchema, validationError } from "@/lib/validation";
import { jsonNoStore, readJsonBody, RequestBodyError } from "@/lib/http";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonNoStore(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return jsonNoStore(
      { error: "Unable to read request body", code: "REQUEST_READ_FAILED" },
      { status: 400 },
    );
  }

  const parsed = routeRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonNoStore(resolveRoute(parsed.data.routeStopIds));
  } catch (error) {
    if (error instanceof RouteResolutionError) {
      return jsonNoStore(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    return jsonNoStore(
      {
        error: "Unable to resolve route",
        code: "ROUTE_RESOLUTION_FAILED",
      },
      { status: 500 },
    );
  }
}
