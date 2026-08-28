class AppError extends Error {
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
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, { status: 404, code: 'NOT_FOUND' });
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 422, code: 'VALIDATION_ERROR', details });
  }
}

module.exports = { AppError, NotFoundError, ValidationError };
