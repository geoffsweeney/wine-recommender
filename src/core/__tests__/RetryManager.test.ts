import { RetryManager, ExponentialBackoffPolicy, FixedDelayPolicy } from '../RetryManager';
import { CircuitBreaker, CircuitBreakerOptions } from '../CircuitBreaker';

class MockCircuitBreaker extends CircuitBreaker {
  constructor(options: CircuitBreakerOptions) {
    super(options);
  }
  
  async protect<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.status === 'open') {
      throw new Error('Circuit breaker is open');
    }
    return fn();
  }
}

describe('RetryManager', () => {
  const mockCircuitBreaker = new MockCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 5000,
    successThreshold: 2
  });

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
      const failingBreaker = new MockCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 1
      });
      failingBreaker['state'] = { status: 'open', failureCount: 1, successCount: 0, lastFailureTime: Date.now() };
      
      const retryManager = new (class extends RetryManager {
        constructor() {
          super({ maxAttempts: 3, circuitBreaker: failingBreaker }, [policy]);
        }
      })();

      await expect(retryManager.executeWithRetry(() => Promise.resolve('test')))
        .rejects.toThrow('Circuit breaker is open');
    });

    it('should handle half-open state correctly', async () => {
      const halfOpenBreaker = new MockCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 1
      });
      halfOpenBreaker['state'] = { status: 'half-open', failureCount: 0, successCount: 0, lastFailureTime: Date.now() };
      
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
      expect(duration).toBeGreaterThanOrEqual(200);
    });
  });
});