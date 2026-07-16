import { resolveRoute } from "@/lib/routes";
import { routeRequestSchema, validationError } from "@/lib/validation";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = routeRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return Response.json(resolveRoute(parsed.data.routeStopIds));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to resolve route",
      },
      { status: 422 },
    );
  }
}
