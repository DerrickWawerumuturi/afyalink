export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function badRequest(message = 'Invalid request', fields) {
  return new ApiError(400, 'VALIDATION_ERROR', message, fields);
}

export function unauthorized(message = 'Authentication required') {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Access denied') {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Resource not found') {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function conflict(code, message) {
  return new ApiError(409, code, message);
}

export function serviceUnavailable(message = 'Service temporarily unavailable') {
  return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
}
