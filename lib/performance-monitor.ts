/**
 * Performance monitoring utilities for tracking API route performance
 */

export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, number>;
  private durations: Map<string, number>;
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
  addMetadata(key: string, value: any): void {
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
    for (const [transition, duration] of this.durations.entries()) {
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
   * Log the performance summary to console
   */
  logSummary(): void {
    const summary = this.getSummary();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║ 📊 Performance Report: ${summary.operation.padEnd(38)} ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Time: ${summary.totalTime}ms`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');

    // Sort steps by duration (descending) to show bottlenecks first
    const sortedSteps = [...summary.steps].sort((a, b) => b.duration - a.duration);

    for (const step of sortedSteps) {
      const bar = this.createProgressBar(step.percentage);
      const durationStr = `${step.duration}ms`;
      const percentStr = `${step.percentage.toFixed(1)}%`;

      console.log(`║ ${step.from} → ${step.to}`.padEnd(61) + '║');
      console.log(`║   ${bar} ${durationStr.padEnd(8)} (${percentStr})`.padEnd(61) + '║');
    }

    console.log('╠════════════════════════════════════════════════════════════╣');

    // Show metadata
    if (Object.keys(summary.metadata).length > 1) { // More than just 'operation'
      console.log('║ Metadata:'.padEnd(61) + '║');
      for (const [key, value] of Object.entries(summary.metadata)) {
        if (key !== 'operation') {
          const line = `║   ${key}: ${value}`;
          console.log(line.padEnd(61) + '║');
        }
      }
      console.log('╠════════════════════════════════════════════════════════════╣');
    }

    // Identify bottlenecks (>20% of total time)
    const bottlenecks = sortedSteps.filter(s => s.percentage > 20);
    if (bottlenecks.length > 0) {
      console.log('║ ⚠️  BOTTLENECKS (>20% of total time):'.padEnd(61) + '║');
      for (const bottleneck of bottlenecks) {
        const line = `║   • ${bottleneck.from} → ${bottleneck.to} (${bottleneck.duration}ms)`;
        console.log(line.padEnd(61) + '║');
      }
      console.log('╠════════════════════════════════════════════════════════════╣');
    }

    console.log('╚════════════════════════════════════════════════════════════╝\n');
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
    console.log(`⏱️  ${name}: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ ${name}: ${duration}ms (failed)`);
    throw error;
  }
}
