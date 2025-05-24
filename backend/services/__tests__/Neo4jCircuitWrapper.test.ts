import { CircuitOptions } from '../../core/CircuitBreaker';
import { Neo4jCircuitWrapper } from '../Neo4jCircuitWrapper';
import { logger } from '../../utils/logger';
import neo4j from 'neo4j-driver';

jest.mock('../../core/CircuitBreaker', () => {
  const originalModule = jest.requireActual('../../core/CircuitBreaker');
  return {
    CircuitBreaker: jest.fn().mockImplementation((options: CircuitOptions) => ({
      ...originalModule.CircuitBreaker.prototype,
      execute: jest.fn().mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          options.fallback(error as Error);
          return []; // Return fallback value
        }
      }),
      getState: jest.fn().mockReturnValue('CLOSED')
    }))
  };
});

describe('Neo4jCircuitWrapper', () => {
  let wrapper: Neo4jCircuitWrapper;
  let mockDriver: any;
  let mockSession: any;

  beforeEach(() => {
    mockSession = {
      run: jest.fn(),
      close: jest.fn()
    };
    mockDriver = {
      session: jest.fn(() => mockSession)
    };
    wrapper = new Neo4jCircuitWrapper(mockDriver);
    jest.spyOn(logger, 'error').mockImplementation(() => logger);
    jest.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  it('should execute query successfully', async () => {
    const mockResult = {
      records: [
        { toObject: () => ({ id: 1 }) },
        { toObject: () => ({ id: 2 }) }
      ]
    };
    mockSession.run.mockResolvedValue(mockResult);

    const result = await wrapper.executeQuery('MATCH (n) RETURN n');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should use fallback when circuit is open', async () => {
    const mockCircuitBreaker = require('../../core/CircuitBreaker').CircuitBreaker;
    mockCircuitBreaker.mockImplementationOnce((options: CircuitOptions) => ({
      execute: jest.fn().mockResolvedValue(options.fallback(new Error())),
      getState: jest.fn().mockReturnValue('OPEN')
    }));

    const wrapper = new Neo4jCircuitWrapper(mockDriver);
    const result = await wrapper.executeQuery('MATCH (n) RETURN n');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('Circuit open - using fallback');
  });

  it('should log errors when query fails', async () => {
    const error = new Error('Neo4j error');
    mockSession.run.mockRejectedValue(error);

    const result = await wrapper.executeQuery('MATCH (n) RETURN n');
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Neo4j query failed', {
      query: 'MATCH (n) RETURN n',
      error
    });
  });
});