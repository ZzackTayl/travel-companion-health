import { createGuidancePostHandler } from "./handler";

export const POST = createGuidancePostHandler(async (input) => {
  const { evaluateProductionGuidance } = await import("@/lib/guidance/server");
  return evaluateProductionGuidance(input);
});
