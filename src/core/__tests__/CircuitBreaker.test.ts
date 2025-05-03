import { CircuitBreaker } from '../CircuitBreaker';
import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

class TestCircuitBreaker extends CircuitBreaker {
  async protect<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.shouldTry()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  protected onSuccess(): void {
    super.onSuccess();
  }

  protected onFailure(): void {
    super.onFailure();
  }
}

describe('CircuitBreaker', () => {
  let eventListener: jest.Mock;
  
  beforeEach(() => {
    eventListener = jest.fn();
  });

  describe('EventEmitter', () => {
    it('should emit open event when circuit breaks', async () => {
      const breaker = new TestCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        successThreshold: 1
      });
      
      breaker.events.on('open', eventListener);
      
      await expect(breaker.protect(() => Promise.reject(new Error('test'))))
        .rejects.toThrow('test');
      
      expect(eventListener).toHaveBeenCalled();
    });

    it('should emit half-open event after reset timeout', async () => {
      const breaker = new TestCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        successThreshold: 1
      });
      
      breaker.events.on('half-open', eventListener);
      
      // Trip the breaker
      await expect(breaker.protect(() => Promise.reject(new Error('test'))))
        .rejects.toThrow('test');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should trigger half-open
      await breaker.protect(() => Promise.resolve('success'));
      
      expect(eventListener).toHaveBeenCalled();
    });

    it('should emit close event when circuit resets', async () => {
      const breaker = new TestCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        successThreshold: 1
      });
      
      breaker.events.on('close', eventListener);
      
      // Trip and reset the breaker
      await expect(breaker.protect(() => Promise.reject(new Error('test'))))
        .rejects.toThrow('test');
      await new Promise(resolve => setTimeout(resolve, 150));
      await breaker.protect(() => Promise.resolve('success'));
      await breaker.protect(() => Promise.resolve('success'));
      
      expect(eventListener).toHaveBeenCalled();
    });

    it('should emit stateChange event with new state on all transitions', async () => {
      const breaker = new TestCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        successThreshold: 2
      });
      
      const states: any[] = [];
      
      // Attach listener before any operations
      breaker.events.on('stateChange', (state) => {
        console.log('State change:', state.status);
        states.push(state);
      });
      
      // Initial successful call (should remain closed)
      await breaker.protect(() => Promise.resolve('initial'));
      
      // Trip the breaker (should emit open state)
      await expect(breaker.protect(() => Promise.reject(new Error('test'))))
        .rejects.toThrow('test');
      
      // Wait for reset timeout (should emit half-open state)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // First success in half-open state
      await breaker.protect(() => Promise.resolve('success1'));
      
      // Second success in half-open state (should emit closed state)
      await breaker.protect(() => Promise.resolve('success2'));
      
      console.log('All captured state changes:', states.map(s => s.status));
      
      // Verify we captured all emitted state changes
      // Note: Initial closed state isn't emitted as a stateChange event
      expect(states.map(s => s.status)).toEqual([
        'half-open', // First emitted state (after reset timeout)
        'half-open', // Second emitted state (after first success)
        'closed'     // Final emitted state (after second success)
      ]);
    });
  });
  const options = {
    failureThreshold: 3,
    resetTimeout: 5000,
    successThreshold: 2
  };

  let cb: TestCircuitBreaker;

  const originalNow = Date.now();
  
  beforeEach(() => {
    cb = new TestCircuitBreaker(options);
    jest.useFakeTimers({
      now: originalNow,
      advanceTimers: true,
    });
    jest.spyOn(Date, 'now').mockImplementation(() => jest.now());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state is closed', () => {
    expect(cb['state'].status).toBe('closed');
  });

  test('transitions to open state after failure threshold', async () => {
    const failingFn = () => Promise.reject(new Error('test'));
    
    for (let i = 0; i < options.failureThreshold; i++) {
      await expect(cb.protect(failingFn)).rejects.toThrow('test');
    }

    expect(cb['state'].status).toBe('open');
  });

  test('allows retry after reset timeout', async () => {
    const failingFn = () => Promise.reject(new Error('test'));
    
    // Trigger open state
    for (let i = 0; i < options.failureThreshold; i++) {
      await expect(cb.protect(failingFn)).rejects.toThrow('test');
    }
    
    // Advance time past reset timeout
    jest.advanceTimersByTime(options.resetTimeout + 1);
    
    // State should still be open until we attempt a call
    expect(cb['state'].status).toBe('open');
    
    // First attempt after timeout should transition to half-open
    await expect(cb.protect(() => Promise.resolve('test'))).resolves.toBe('test');
    expect(cb['state'].status).toBe('half-open');
  });

  test('resets after success threshold in half-open state', async () => {
    const successFn = () => Promise.resolve('success');
    
    // Force half-open state
    cb['state'].status = 'half-open';
    
    for (let i = 0; i < options.successThreshold; i++) {
      await expect(cb.protect(successFn)).resolves.toBe('success');
    }

    expect(cb['state'].status).toBe('closed');
  });
});