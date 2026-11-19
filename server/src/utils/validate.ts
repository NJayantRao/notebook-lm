import type { z } from "zod";

import { BadRequestError } from "./api-error.js";

/**
 * Parses unknown request data with a Zod schema and throws a
 * BadRequestError (handled by the global error middleware) on failure.
 */
const validate = <TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    throw new BadRequestError(details.join("; "), "VALIDATION_FAILED");
  }

  return result.data;
};

export default validate;
