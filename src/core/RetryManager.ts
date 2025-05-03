import { Neo4jCircuitWrapper } from '../services/Neo4jCircuitWrapper';

/**
 * Defines the contract for retry policies
 * @interface
 */
export interface RetryPolicy {
  /**
   * Determines if an operation should be retried
   * @param attempt The current attempt number (1-based)
   * @param error The error that occurred
   * @returns True if the operation should be retried
   */
  shouldRetry(attempt: number, error: Error): boolean;
  getDelay(attempt: number): number;
}

/**
 * Configuration options for RetryManager
 * @interface
 */
export interface RetryManagerOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts: number;
  circuitBreaker: {
    execute<T>(fn: () => Promise<T>): Promise<T>;
    protect?: <T>(fn: () => Promise<T>) => Promise<T>;
  };
}

/**
 * Abstract base class for managing retry operations with circuit breaker integration
 * @example
 * ```typescript
 * const retryManager = new (class extends RetryManager {
 *   constructor() {
 *     super(
 *       { maxAttempts: 3, circuitBreaker: new CircuitBreakerImpl() },
 *       [new ExponentialBackoffPolicy(100, 1000)]
 *     );
 *   }
 * })();
 *
 * await retryManager.executeWithRetry(() => fetchData());
 * ```
 */
export abstract class RetryManager {
  protected readonly options: RetryManagerOptions;
  protected readonly policies: RetryPolicy[];

  constructor(options: RetryManagerOptions, policies: RetryPolicy[]) {
    this.options = Object.freeze({...options});
    this.policies = [...policies];
  }

  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: Error = new Error('No attempts made');

    while (attempt < this.options.maxAttempts) {
      attempt++;
      
      try {
        return await this.options.circuitBreaker.execute(async () => fn());
      } catch (error) {
        lastError = error as Error;
        
        if (!this.shouldRetry(attempt, lastError)) {
          break;
        }

        const delay = this.getDelay(attempt);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  protected shouldRetry(attempt: number, error: Error): boolean {
    return this.policies.some(policy => policy.shouldRetry(attempt, error));
  }

  protected getDelay(attempt: number): number {
    return Math.max(...this.policies.map(policy => policy.getDelay(attempt)));
  }
}

/**
 * Implements exponential backoff retry policy
 * @example
 * ```typescript
 * const policy = new ExponentialBackoffPolicy(100, 1000);
 * ```
 */
export class ExponentialBackoffPolicy implements RetryPolicy {
  constructor(
    private readonly baseDelay: number,
    private readonly maxDelay: number,
    private readonly retryableErrors: ErrorConstructor[] = [Error]
  ) {}

  shouldRetry(attempt: number, error: Error): boolean {
    return this.retryableErrors.some(ErrorType => error instanceof ErrorType);
  }

  getDelay(attempt: number): number {
    return Math.min(
      this.baseDelay * Math.pow(2, attempt - 1),
      this.maxDelay
    );
  }
}

/**
 * Implements fixed delay retry policy
 * @example
 * ```typescript
 * const policy = new FixedDelayPolicy(200);
 * ```
 */
export class FixedDelayPolicy implements RetryPolicy {
  constructor(
    private readonly delay: number,
    private readonly retryableErrors: ErrorConstructor[] = [Error]
  ) {}

  shouldRetry(attempt: number, error: Error): boolean {
    return this.retryableErrors.some(ErrorType => error instanceof ErrorType);
  }

  getDelay(attempt: number): number {
    return this.delay;
  }
}