import { evaluateGuidance } from "@/lib/guidance";
import { jsonNoStore, readJsonBody, RequestBodyError } from "@/lib/http";
import { RouteResolutionError } from "@/lib/routes";
import { guidanceRequestSchema, validationError } from "@/lib/validation";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonNoStore(
      {
        error:
          "Governed guidance data is not configured. Guidance is unavailable.",
        code: "GUIDANCE_DATA_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

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

  const parsed = guidanceRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonNoStore(evaluateGuidance(parsed.data));
  } catch (error) {
    if (error instanceof RouteResolutionError) {
      return jsonNoStore(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    return jsonNoStore(
      {
        error: "Unable to evaluate guidance",
        code: "GUIDANCE_EVALUATION_FAILED",
      },
      { status: 500 },
    );
  }
}
