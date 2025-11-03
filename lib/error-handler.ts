import { NextResponse } from 'next/server';
import { AppError, DatabaseError } from './errors';
import { logger } from './logger';
import type { PostgrestError } from '@supabase/supabase-js';

// Re-export error classes for convenience
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
} from './errors';

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  metadata?: Record<string, unknown>;
}

/**
 * Convert Supabase PostgrestError to AppError
 */
export function handleSupabaseError(error: PostgrestError, operation: string): AppError {
  logger.error('Supabase error', {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return new DatabaseError(operation, error.message);
}

/**
 * Main error handler for API routes
 * Use this in all catch blocks
 */
export function handleApiError(err: unknown): NextResponse<ErrorResponse> {
  // Handle known AppError instances
  if (err instanceof AppError) {
    logger.error(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      metadata: err.metadata,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        metadata: err.metadata,
      },
      { status: err.statusCode }
    );
  }

  // Handle standard Error instances
  if (err instanceof Error) {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        metadata: { originalMessage: err.message },
      },
      { status: 500 }
    );
  }

  // Handle unknown error types (should be rare after type safety migration)
  logger.error('Unknown error type', { error: String(err) });

  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    },
    { status: 500 }
  );
}

/**
 * Async wrapper for API route handlers
 * Automatically catches errors and applies handleApiError
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err: unknown) {
      return handleApiError(err);
    }
  };
}
