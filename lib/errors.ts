/**
 * Base application error class
 * All custom errors extend this class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }
}

/**
 * Validation errors (400)
 * Use when request data is invalid
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
  }
}

/**
 * Authentication errors (401)
 * Use when user is not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
  }
}

/**
 * Authorization errors (403)
 * Use when user lacks permissions
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Not found errors (404)
 * Use when resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
  }
}

/**
 * Rate limit errors (429)
 * Use when user exceeds usage limits
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    metadata?: { limit?: number; current?: number; resetDate?: string }
  ) {
    super(message, 'RATE_LIMIT', 429, metadata);
  }
}

/**
 * External service errors (502)
 * Use when external API calls fail (OpenAI, Stripe, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error | string) {
    super(`External service error: ${service}`, 'EXTERNAL_SERVICE_ERROR', 502, {
      service,
      originalError: typeof originalError === 'string' ? originalError : originalError?.message,
    });
  }
}

/**
 * Database errors (500)
 * Use when Supabase queries fail
 */
export class DatabaseError extends AppError {
  constructor(operation: string, details?: string) {
    super(`Database error during ${operation}`, 'DATABASE_ERROR', 500, { operation, details });
  }
}

/**
 * Configuration errors (500)
 * Use when environment variables or config is missing
 */
export class ConfigurationError extends AppError {
  constructor(configKey: string) {
    super(`Missing or invalid configuration: ${configKey}`, 'CONFIG_ERROR', 500, { configKey });
  }
}
