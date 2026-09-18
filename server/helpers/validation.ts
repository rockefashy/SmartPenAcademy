import { z } from 'zod';
import { ValidationError } from '../errors.ts';

/**
 * Validates any input against a Zod schema.
 * Throws a typed ValidationError if validation fails, returning the parsed data on success.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
  defaultMessage: string = 'Validation failed'
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message || defaultMessage;
    throw new ValidationError(message, result.error.issues);
  }
  return result.data;
}
