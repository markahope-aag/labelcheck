/**
 * Performance monitoring utilities for tracking API route performance
 */

import { logger } from './logger';

export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, number>;
  private durations: Map<string, number>;
  /** Flexible metadata storage for performance tracking (any value type for extensibility) */
  private metadata: Record<string, any>;

  constructor(operation: string) {
    this.startTime = Date.now();
    this.checkpoints = new Map();
    this.durations = new Map();
    this.metadata = { operation };
    this.checkpoint('start');
  }

  /**
   * Mark a checkpoint in the operation
   */
  checkpoint(name: string): void {
    const now = Date.now();
    this.checkpoints.set(name, now);

    // Calculate duration since last checkpoint
    const checkpointKeys = Array.from(this.checkpoints.keys());
    if (checkpointKeys.length > 1) {
      const previousKey = checkpointKeys[checkpointKeys.length - 2];
      const previousTime = this.checkpoints.get(previousKey)!;
      const duration = now - previousTime;
      this.durations.set(`${previousKey} → ${name}`, duration);
    }
  }

  /**
   * Add metadata to the performance report
   */
  addMetadata(key: string, value: string | number | boolean | null): void {
    this.metadata[key] = value;
  }

  /**
   * Get the total elapsed time
   */
  getTotalTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get a summary of all timings
   */
  getSummary(): PerformanceSummary {
    const totalTime = this.getTotalTime();
    const steps: PerformanceStep[] = [];

    // Convert durations to array of steps
    for (const [transition, duration] of Array.from(this.durations.entries())) {
      const [from, to] = transition.split(' → ');
      steps.push({
        from,
        to,
        duration,
        percentage: (duration / totalTime) * 100,
      });
    }

    return {
      operation: this.metadata.operation,
      totalTime,
      steps,
      metadata: this.metadata,
    };
  }

  /**
   * Log the performance summary to structured logger
   */
  logSummary(): void {
    const summary = this.getSummary();

    // Sort steps by duration (descending) to identify bottlenecks
    const sortedSteps = [...summary.steps].sort((a, b) => b.duration - a.duration);
    const bottlenecks = sortedSteps.filter((s) => s.percentage > 20);

    logger.info('Performance report', {
      operation: summary.operation,
      totalTime: summary.totalTime,
      stepCount: summary.steps.length,
      bottlenecks:
        bottlenecks.length > 0
          ? bottlenecks.map((b) => ({
              from: b.from,
              to: b.to,
              duration: b.duration,
              percentage: b.percentage,
            }))
          : undefined,
      metadata: Object.keys(summary.metadata).length > 1 ? summary.metadata : undefined,
    });

    // Log detailed steps for debugging
    logger.debug('Performance steps', {
      operation: summary.operation,
      steps: summary.steps.map((step) => ({
        from: step.from,
        to: step.to,
        duration: step.duration,
        percentage: step.percentage,
      })),
    });
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number): string {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Export summary as JSON for analysis
   */
  toJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2);
  }
}

export interface PerformanceStep {
  from: string;
  to: string;
  duration: number;
  percentage: number;
}

export interface PerformanceSummary {
  operation: string;
  totalTime: number;
  steps: PerformanceStep[];
  metadata: Record<string, any>;
}

/**
 * Utility function to measure async operation performance
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  monitor?: PerformanceMonitor
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug('Async operation completed', { operation: name, duration });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Async operation failed', { operation: name, duration, error });
    throw error;
  }
}
