export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class ConflictError extends Error {}

export function toHttpError(error: unknown) {
  if (error instanceof NotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: error.message } };
  }
  if (error instanceof ConflictError) {
    return { status: 409, body: { error: error.message } };
  }
  return { status: 500, body: { error: 'Internal Server Error' } };
}
