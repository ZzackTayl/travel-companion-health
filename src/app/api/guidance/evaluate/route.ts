import { evaluateGuidance } from "@/lib/guidance";
import { guidanceRequestSchema, validationError } from "@/lib/validation";

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

  const parsed = guidanceRequestSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return Response.json(evaluateGuidance(parsed.data));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to evaluate guidance",
      },
      { status: 422 },
    );
  }
}
