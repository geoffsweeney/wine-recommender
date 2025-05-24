import 'reflect-metadata';
import { RetryManager, ExponentialBackoffPolicy, FixedDelayPolicy } from '../RetryManager';
import { Neo4jCircuitWrapper } from '../../services/Neo4jCircuitWrapper';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  successThreshold: number;
}

export class MockCircuitBreaker {
  state = {
    status: 'closed' as 'closed' | 'open' | 'half-open',
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0
  };

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.status === 'open') {
      throw new Error('Circuit breaker is open');
    }
    return fn();
  }

  async protect<T>(fn: () => Promise<T>): Promise<T> {
    return this.execute(fn);
  }
}

describe('RetryManager', () => {
  const mockCircuitBreaker = new MockCircuitBreaker();

  const successAfter = (attempts: number) => {
    let count = 0;
    return () => {
      count++;
      if (count >= attempts) {
        return Promise.resolve('success');
      }
      return Promise.reject(new Error('failed'));
    };
  };

  describe('with ExponentialBackoffPolicy', () => {
    const policy = new ExponentialBackoffPolicy(100, 1000);
    const retryManager = new (class extends RetryManager {
      constructor() {
        super({ maxAttempts: 3, circuitBreaker: mockCircuitBreaker }, [policy]);
      }
    })();

    it('should retry with exponential backoff', async () => {
      const start = Date.now();
      await expect(retryManager.executeWithRetry(successAfter(2)))
        .resolves.toBe('success');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100); // 1st retry delay
    });

    it('should give up after max attempts', async () => {
      await expect(retryManager.executeWithRetry(successAfter(4)))
        .rejects.toThrow('failed');
    });

    it('should respect circuit breaker open state', async () => {
      const failingBreaker = new MockCircuitBreaker();
      (failingBreaker as any)['state'] = { status: 'open', failureCount: 1, successCount: 0, lastFailureTime: Date.now() };
      
      const retryManager = new (class extends RetryManager {
        constructor() {
          super({ maxAttempts: 3, circuitBreaker: failingBreaker }, [policy]);
        }
      })();

      await expect(retryManager.executeWithRetry(() => Promise.resolve('test')))
        .rejects.toThrow('Circuit breaker is open');
    });

    it('should handle half-open state correctly', async () => {
      const halfOpenBreaker = new MockCircuitBreaker();
      (halfOpenBreaker as any)['state'] = { status: 'half-open', failureCount: 0, successCount: 0, lastFailureTime: Date.now() };
      
      const retryManager = new (class extends RetryManager {
        constructor() {
          super({ maxAttempts: 3, circuitBreaker: halfOpenBreaker }, [policy]);
        }
      })();

      await expect(retryManager.executeWithRetry(() => Promise.resolve('test')))
        .resolves.toBe('test');
    });
  });

  describe('with FixedDelayPolicy', () => {
    const policy = new FixedDelayPolicy(200);
    const retryManager = new (class extends RetryManager {
      constructor() {
        super({ maxAttempts: 3, circuitBreaker: mockCircuitBreaker }, [policy]);
      }
    })();

    it('should retry with fixed delay', async () => {
      const start = Date.now();
      await expect(retryManager.executeWithRetry(successAfter(2)))
        .resolves.toBe('success');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(200);
    });
  });

  describe('policy evaluation', () => {
    it('should use the maximum delay from all policies', async () => {
      const policies = [
        new FixedDelayPolicy(100),
        new FixedDelayPolicy(200)
      ];
      const retryManager = new (class extends RetryManager {
        constructor() {
          super({ maxAttempts: 3, circuitBreaker: mockCircuitBreaker }, policies);
        }
      })();

      const start = Date.now();
      await expect(retryManager.executeWithRetry(successAfter(2)))
        .resolves.toBe('success');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(190); // Allow slight timing variance
    });
  });
});