export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  fallback: (error: Error) => any;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly options: CircuitOptions;

  constructor(options: CircuitOptions) {
    this.options = options;
  }

  protect<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return ((...args: Parameters<T>) => {
      return this.execute(() => fn(...args));
    }) as T;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        return this.options.fallback(new Error('Circuit is open'));
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.reset();
      }
    }
  }

  private recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const now = Date.now();
      return now - this.lastFailureTime > this.options.timeoutMs;
    }
    return false;
  }

  private reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  // For testing purposes only
  getState(): CircuitState {
    return this.state;
  }

  // For testing purposes only
  _setStateForTesting(state: CircuitState, lastFailureTime?: number): void {
    this.state = state;
    if (lastFailureTime) {
      this.lastFailureTime = lastFailureTime;
    }
  }

}