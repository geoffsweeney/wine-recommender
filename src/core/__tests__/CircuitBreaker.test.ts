import 'reflect-metadata';
import { Neo4jCircuitWrapper } from '../../services/Neo4jCircuitWrapper';
import { jest } from '@jest/globals';
import neo4j from 'neo4j-driver';

describe('Neo4jCircuitWrapper', () => {
  let wrapper: Neo4jCircuitWrapper;
  let mockDriver: { session: jest.Mock };

  beforeEach(() => {
    mockDriver = {
      session: jest.fn(() => ({
        run: jest.fn(),
        close: jest.fn()
      }))
    };

    wrapper = new Neo4jCircuitWrapper(mockDriver as any);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state should be closed', () => {
    expect(wrapper['state'].status).toBe('closed');
  });

  test('should open circuit after failure threshold', async () => {
    const failingOperation = jest.fn(async () => {
      throw new Error('DB error');
    });
    
    // First failure
    await expect(wrapper.execute(failingOperation))
      .rejects.toThrow('DB error');
    expect(wrapper['state'].status).toBe('closed');
    expect(wrapper['state'].failureCount).toBe(1);

    // Second failure
    await expect(wrapper.execute(failingOperation))
      .rejects.toThrow('DB error');
    expect(wrapper['state'].status).toBe('closed');
    expect(wrapper['state'].failureCount).toBe(2);

    // Third failure - should open circuit
    await expect(wrapper.execute(failingOperation))
      .rejects.toThrow('DB error');
    expect(wrapper['state'].status).toBe('open');
  });

  test('should reject when circuit is open', async () => {
    wrapper['state'].status = 'open';
    wrapper['state'].lastFailureTime = Date.now();
    
    await expect(wrapper.execute(jest.fn(async () => ({}))))
      .rejects.toThrow('Neo4j circuit breaker is open');
  });

  test('should transition to half-open after reset timeout', async () => {
    wrapper['state'].status = 'open';
    wrapper['state'].lastFailureTime = Date.now() - 10000; // Past timeout
    
    const successOperation = jest.fn(async () => ({}));
    await expect(wrapper.execute(successOperation)).resolves.toEqual({});
    expect(wrapper['state'].status).toBe('half-open');
  });

  test('should reset after success threshold in half-open', async () => {
    wrapper['state'].status = 'half-open';
    const successOperation = jest.fn(async () => ({}));
    
    // First success
    await wrapper.execute(successOperation);
    expect(wrapper['state'].status).toBe('half-open');
    expect(wrapper['state'].successCount).toBe(1);

    // Second success - should reset
    await wrapper.execute(successOperation);
    expect(wrapper['state'].status).toBe('closed');
    expect(wrapper['state'].successCount).toBe(0);
  });
});