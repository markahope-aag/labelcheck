/**
 * Client-Side Structured Logging Utility
 *
 * Provides consistent, structured logging for client-side components.
 * Uses console with structured data formatting for better debugging.
 *
 * Usage:
 *   import { clientLogger } from '@/lib/client-logger';
 *
 *   clientLogger.info('User action', { userId, action: 'click' });
 *   clientLogger.error('API call failed', { error, endpoint });
 *   clientLogger.warn('Validation warning', { field, value });
 *   clientLogger.debug('Component rendered', { props });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  [key: string]: unknown;
}

class ClientLogger {
  private formatMessage(level: LogLevel, message: string, options?: LogOptions): void {
    // Only log in development or if explicitly enabled
    if (process.env.NODE_ENV === 'production' && level === 'debug') {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...options,
    };

    // Use appropriate console method with structured data
    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] ${message}`, options || '');
        break;
      case 'info':
        console.info(`[${timestamp}] ${message}`, options || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] ${message}`, options || '');
        break;
      case 'error':
        console.error(`[${timestamp}] ${message}`, options || '');
        break;
    }
  }

  debug(message: string, options?: LogOptions): void {
    this.formatMessage('debug', message, options);
  }

  info(message: string, options?: LogOptions): void {
    this.formatMessage('info', message, options);
  }

  warn(message: string, options?: LogOptions): void {
    this.formatMessage('warn', message, options);
  }

  error(message: string, options?: LogOptions): void {
    this.formatMessage('error', message, options);
  }
}

export const clientLogger = new ClientLogger();
