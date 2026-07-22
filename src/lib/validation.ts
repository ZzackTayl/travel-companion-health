import { z } from "zod";
import { medicationCategories } from "@/lib/domain";
import { isValidDate, parseDate } from "@/lib/dates";
import { jsonNoStore } from "@/lib/http";

const airportQueryPattern = /^[\p{L}\p{N}\s.'’/&()-]+$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
  .string()
  .regex(datePattern, "Date must use YYYY-MM-DD")
  .refine(isValidDate, "Date must be a valid calendar date");

const routeStopIdsSchema = z
  .array(z.string().trim().min(1).max(80))
  .min(2, "At least an origin and destination are required")
  .max(10, "Routes are limited to 10 stops");

function validateRouteStops(routeStopIds: string[], context: z.RefinementCtx) {
  routeStopIds.forEach((id, index) => {
    if (index > 0 && routeStopIds[index - 1] === id) {
      context.addIssue({
        code: "custom",
        path: [index],
        message: "Adjacent route stops must be different airports",
      });
    }
  });
}

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
    routeStopIds: routeStopIdsSchema,
  })
  .strict()
  .superRefine(({ routeStopIds }, context) => {
    validateRouteStops(routeStopIds, context);
  });

export const guidanceRequestSchema = z
  .object({
    routeStopIds: routeStopIdsSchema,
    departureDate: dateSchema.optional(),
    returnDate: dateSchema.optional(),
    medicationCategories: z
      .array(z.enum(medicationCategories))
      .max(15)
      .default([]),
  })
  .strict()
  .superRefine(
    (
      {
        departureDate,
        medicationCategories: categories,
        returnDate,
        routeStopIds,
      },
      context,
    ) => {
      validateRouteStops(routeStopIds, context);
      if (returnDate && !departureDate) {
        context.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Add a departure date before adding a return date",
        });
      }
      if (
        departureDate &&
        returnDate &&
        (parseDate(returnDate) ?? 0) < (parseDate(departureDate) ?? 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Return date must be on or after departure date",
        });
      }
      if (categories.includes("unknown") && categories.length > 1) {
        context.addIssue({
          code: "custom",
          path: ["medicationCategories"],
          message: '"Not sure" cannot be combined with another category',
        });
      }
    },
  );

export function validationError(error: z.ZodError) {
  return jsonNoStore(
    {
      error: "Invalid request",
      code: "INVALID_REQUEST",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}
