import { z } from "zod";
import { medicationCategories } from "@/lib/domain";

const airportQueryPattern = /^[\p{L}\p{N}\s.'’/&()-]+$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const airportSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Enter an airport code, airport, city, or country")
    .max(80, "Search must be 80 characters or fewer")
    .regex(airportQueryPattern, "Search contains unsupported characters"),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const routeRequestSchema = z
  .object({
    routeStopIds: z
      .array(z.string().trim().min(1).max(80))
      .min(2, "At least an origin and destination are required")
      .max(10, "Routes are limited to 10 stops"),
  })
  .strict();

export const guidanceRequestSchema = routeRequestSchema
  .extend({
    departureDate: z.string().regex(datePattern).optional(),
    returnDate: z.string().regex(datePattern).optional(),
    medicationCategories: z
      .array(z.enum(medicationCategories))
      .max(15)
      .default([]),
  })
  .strict();

export function validationError(error: z.ZodError) {
  return Response.json(
    {
      error: "Invalid request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}
