// =============================================================================
// Application error types
// =============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class WorkflowTransitionError extends AppError {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Invalid workflow transition from ${currentStatus} to ${targetStatus}`,
      'INVALID_TRANSITION',
      409
    );
    this.name = 'WorkflowTransitionError';
  }
}

export class DuplicateEmailError extends AppError {
  constructor(messageId: string) {
    super(
      `Email already processed: ${messageId}`,
      'DUPLICATE_EMAIL',
      409
    );
    this.name = 'DuplicateEmailError';
  }
}

export class BetaModeRestrictionError extends AppError {
  constructor(domain: string) {
    super(
      `Sender domain not allowed in beta mode: ${domain}`,
      'BETA_RESTRICTION',
      403
    );
    this.name = 'BetaModeRestrictionError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      details
    );
    this.name = 'ExternalServiceError';
  }
}
