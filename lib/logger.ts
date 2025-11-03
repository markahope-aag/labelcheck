/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application.
 * Uses Pino for fast, JSON-formatted logs that are easy to search and analyze.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('User login successful', { userId, email });
 *   logger.error('Analysis failed', { error, userId, analysisId });
 *   logger.warn('Rate limit approaching', { userId, usage: 9, limit: 10 });
 *   logger.debug('Processing image', { fileName, size });
 */

import pino from 'pino';

/**
 * Configure Pino logger
 *
 * Development: Pretty-printed, colorized output
 * Production: JSON output for log aggregation services
 * Test: Simple console output (no worker threads)
 */

// Check if we're in a test environment (Playwright, Jest, etc.)
const isTestEnvironment =
  process.env.NODE_ENV === 'test' ||
  process.env.PLAYWRIGHT_TEST === '1' ||
  !!process.env.JEST_WORKER_ID;

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Pretty print in development for better readability
  // Disable in test mode to avoid worker thread issues
  ...(process.env.NODE_ENV === 'development' &&
    !process.env.CI &&
    !isTestEnvironment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          sync: true, // Use synchronous mode to avoid worker thread issues
        },
      },
    }),

  // Add base fields to all logs
  base: {
    env: process.env.NODE_ENV,
  },

  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
  },
});

/**
 * Wrapper to provide flexible logger API
 * Accepts: logger.info(message, data) instead of Pino's logger.info(data, message)
 */
class FlexibleLogger {
  private pino: pino.Logger;

  constructor(pinoInstance: pino.Logger) {
    this.pino = pinoInstance;
  }

  info(message: string, data?: Record<string, any>): void {
    if (data) {
      this.pino.info(data, message);
    } else {
      this.pino.info(message);
    }
  }

  error(message: string, data?: Record<string, any>): void {
    if (data) {
      this.pino.error(data, message);
    } else {
      this.pino.error(message);
    }
  }

  warn(message: string, data?: Record<string, any>): void {
    if (data) {
      this.pino.warn(data, message);
    } else {
      this.pino.warn(message);
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    if (data) {
      this.pino.debug(data, message);
    } else {
      this.pino.debug(message);
    }
  }

  child(context: Record<string, any>): FlexibleLogger {
    return new FlexibleLogger(this.pino.child(context));
  }
}

export const logger = new FlexibleLogger(pinoLogger);

/**
 * Helper: Create a child logger with consistent context
 *
 * Useful for adding request-specific context to all logs in a request handler.
 *
 * Example:
 *   const requestLogger = createRequestLogger({ userId, requestId });
 *   requestLogger.info('Starting analysis');
 *   requestLogger.error('Analysis failed', { error });
 */
export function createRequestLogger(context: {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}): FlexibleLogger {
  return logger.child(context);
}

/**
 * Helper: Log timing information
 *
 * Example:
 *   const timer = startTimer();
 *   // ... do work ...
 *   timer.end('Analysis completed');
 */
export function startTimer() {
  const start = Date.now();
  return {
    end: (message: string, meta?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.info(message, { ...meta, duration });
      return duration;
    },
  };
}

/**
 * IMPORTANT: Never log sensitive data
 *
 * ❌ DO NOT log:
 * - Passwords or API keys
 * - Full email addresses (use partial: user@example.com → u***@example.com)
 * - Credit card numbers
 * - Personal health information
 * - Full user addresses
 *
 * ✅ DO log:
 * - User IDs (UUIDs are safe)
 * - Timestamps
 * - Status codes
 * - Error messages (without sensitive context)
 * - Performance metrics
 * - Business events
 */
