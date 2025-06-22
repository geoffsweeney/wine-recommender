import { CircuitBreaker } from '../CircuitBreaker';
import { jest } from '@jest/globals';

describe('CircuitBreaker', () => {
  let circuit: CircuitBreaker;
  const options = {
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 5000,
    fallback: jest.fn(() => 'fallback')
  };

  beforeEach(() => {
    jest.useFakeTimers();
    circuit = new CircuitBreaker(options);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state should be CLOSED', () => {
    expect(circuit.getState()).toBe('CLOSED');
  });

  test('should open circuit after failure threshold', async () => {
    const failingOperation = jest.fn(async () => {
      throw new Error('Operation failed');
    });
    
    // First failure
    await expect(circuit.execute(failingOperation))
      .rejects.toThrow('Operation failed');
    expect(circuit.getState()).toBe('CLOSED');

    // Second failure  
    await expect(circuit.execute(failingOperation))
      .rejects.toThrow('Operation failed');
    expect(circuit.getState()).toBe('CLOSED');

    // Third failure - should open circuit
    await expect(circuit.execute(failingOperation))
      .rejects.toThrow('Operation failed');
    expect(circuit.getState()).toBe('OPEN');

    // Subsequent call when circuit is open should return fallback
    const fallbackResult = await circuit.execute(failingOperation);
    expect(fallbackResult).toBe('fallback');
    expect(circuit.getState()).toBe('OPEN'); // Still OPEN
  });

  test('should use fallback when circuit is open', async () => {
    circuit._setStateForTesting('OPEN');
    const result = await circuit.execute(jest.fn(async () => 'success'));
    expect(result).toBe('fallback');
    expect(options.fallback).toHaveBeenCalled();
  });

  test('should transition to HALF_OPEN after timeout', async () => {
    const now = Date.now();
    circuit._setStateForTesting('OPEN', now - options.timeoutMs - 1000);
    
    const result = await circuit.execute(jest.fn(async () => 'success'));
    expect(circuit.getState()).toBe('HALF_OPEN');
    expect(result).toBe('success');
  });

  test('should reset to CLOSED after success threshold', async () => {
    circuit._setStateForTesting('HALF_OPEN');
    
    // First success
    await circuit.execute(jest.fn(async () => 'success'));
    expect(circuit.getState()).toBe('HALF_OPEN');

    // Second success - should reset
    await circuit.execute(jest.fn(async () => 'success'));
    expect(circuit.getState()).toBe('CLOSED');
  });
});