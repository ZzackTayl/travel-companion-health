import type { GuidanceEvaluation } from "@/lib/domain";
import { getTripDuration } from "@/lib/dates";
import {
  GuidanceUnavailableError,
  type EvaluateGuidanceInput,
} from "@/lib/guidance/service";
import { resolveRoute } from "@/lib/routes";
import { guidanceRequestSchema, validationError } from "@/lib/validation";

type GuidanceEvaluator = (
  input: EvaluateGuidanceInput,
) => Promise<GuidanceEvaluation>;

const noStoreHeaders = { "Cache-Control": "no-store" };

export function createGuidancePostHandler(evaluate: GuidanceEvaluator) {
  return async function post(request: Request) {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON" },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const parsed = guidanceRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const response = validationError(parsed.error);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    try {
      resolveRoute(parsed.data.routeStopIds);
      getTripDuration(parsed.data.departureDate, parsed.data.returnDate);
      return Response.json(await evaluate(parsed.data), {
        headers: noStoreHeaders,
      });
    } catch (error) {
      if (error instanceof GuidanceUnavailableError) {
        return Response.json(
          {
            error:
              "Verified guidance is temporarily unavailable. Check official authorities before travel.",
          },
          { status: 503, headers: noStoreHeaders },
        );
      }

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to evaluate guidance",
        },
        { status: 422, headers: noStoreHeaders },
      );
    }
  };
}
