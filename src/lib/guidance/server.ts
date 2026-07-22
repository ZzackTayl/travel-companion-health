import { DatabaseGuidanceRepository } from "./database-repository";
import {
  evaluateRouteGuidance,
  GuidanceUnavailableError,
  type EvaluateGuidanceInput,
} from "./service";

let repository: DatabaseGuidanceRepository | undefined;

function getRepository() {
  if (repository) return repository;

  const baseUrl = process.env.GUIDANCE_DATABASE_URL;
  const publicKey = process.env.GUIDANCE_DATABASE_PUBLIC_KEY;
  if (!baseUrl || !publicKey) {
    throw new GuidanceUnavailableError();
  }

  repository = new DatabaseGuidanceRepository({ baseUrl, publicKey });
  return repository;
}

export async function evaluateProductionGuidance(input: EvaluateGuidanceInput) {
  try {
    return await evaluateRouteGuidance(getRepository(), input);
  } catch (error) {
    if (error instanceof GuidanceUnavailableError) throw error;
    throw new GuidanceUnavailableError({ cause: error });
  }
}
