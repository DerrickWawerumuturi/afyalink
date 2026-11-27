import { ApiError } from './errors.js';

export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request', fields);
  }
  return result.data;
}
