/** Typed application errors carry safe HTTP metadata to the centralized error middleware. */
class AppError extends Error {
  /** @param {string} message - User-safe message for expected failures. */
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  /** @param {string} [resource] - Resource label included in the safe response. */
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, { status: 404, code: 'NOT_FOUND' });
  }
}

class ValidationError extends AppError {
  /** @param {string} message - Summary plus optional field-level validation details. */
  constructor(message, details) {
    super(message, { status: 422, code: 'VALIDATION_ERROR', details });
  }
}

module.exports = { AppError, NotFoundError, ValidationError };
