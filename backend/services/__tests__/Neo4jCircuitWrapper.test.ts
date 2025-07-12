import { Driver, Record, Session } from 'neo4j-driver';
import { container } from 'tsyringe';
import { CircuitBreaker, CircuitOptions } from '../../core/CircuitBreaker';
import { TYPES } from '../../di/Types';
import { Neo4jCircuitWrapper } from '../Neo4jCircuitWrapper';

describe('Neo4jCircuitWrapper', () => {
  let wrapper: Neo4jCircuitWrapper;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockLogger: any;

  beforeEach(() => {
    container.clearInstances();
    container.reset();

    mockDriver = {
      session: jest.fn(),
      close: jest.fn()
    } as any;

    mockSession = {
      run: jest.fn(),
      close: jest.fn()
    } as any;

    mockCircuitBreaker = {
      execute: jest.fn(),
      getState: jest.fn()
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    container.registerInstance(TYPES.Neo4jDriver, mockDriver);
    container.registerInstance(TYPES.CircuitOptions, {
      timeoutMs: 1000,
      failureThreshold: 50,
      successThreshold: 5,
      fallback: jest.fn()
    });
    container.registerInstance(TYPES.Logger, mockLogger);

    // Create wrapper with same options format as implementation
    wrapper = new Neo4jCircuitWrapper(
      mockDriver,
      {
        timeoutMs: 1000,
        failureThreshold: 50,
        successThreshold: 5,
        fallback: jest.fn()
      } satisfies CircuitOptions,
      mockLogger
    );
    container.registerInstance(TYPES.Neo4jCircuitWrapper, wrapper);
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(wrapper).toBeDefined();
      expect(mockCircuitBreaker).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute function through circuit breaker', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      jest.spyOn(wrapper['circuit'], 'execute').mockImplementation(async (fn) => {
        return fn(); // Actually call the provided function
      });

      const result = await wrapper.execute(mockFn);
      
      expect(result).toBe('result');
      expect(wrapper['circuit'].execute).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith(mockDriver);
    });

    it('should propagate circuit breaker errors', async () => {
      jest.spyOn(wrapper['circuit'], 'execute').mockRejectedValue(new Error('Circuit open'));
      
      await expect(wrapper.execute(jest.fn()))
        .rejects.toThrow('Circuit open');
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      mockDriver.session.mockReturnValue(mockSession);
      const mockRecord = {
        keys: ['n'],
        length: 1,
        _fields: [{}],
        _fieldLookup: { n: 0 },
        get: jest.fn((key: string) => {
          if (key === 'n') {
            return {
              properties: { id: 1, name: 'Node 1' },
              elementId: 'element-1'
            };
          }
          return undefined;
        }),
        has: jest.fn(),
        forEach: jest.fn(),
        map: jest.fn(),
        slice: jest.fn(),
        toArray: jest.fn(),
        toObject: jest.fn(() => ({ n: { id: 1, name: 'Node 1' } })),
        getIdentity: jest.fn()
      } as unknown as Record;
 
      mockSession.run.mockResolvedValue({
        records: [mockRecord],
        summary: {} as any
      });
 
      jest.spyOn(wrapper['circuit'], 'execute').mockImplementation(async (fn) => fn());
 
      const results = await wrapper.executeQuery('MATCH (n) RETURN n');
      
      expect(results.success).toBe(true);
      if (results.success) { // Type guard
        expect(results.data).toEqual([{ n: { id: 'element-1', name: 'Node 1' } }]);
      }
      expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n', {});
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      mockDriver.session.mockReturnValue(mockSession);
      mockSession.run.mockResolvedValue({
        records: [],
        summary: {} as any
      });
      jest.spyOn(wrapper['circuit'], 'execute').mockImplementation(async (fn) => fn());

      const results = await wrapper.executeQuery('MATCH (n) RETURN n');
      
      expect(results.success).toBe(true);
      if (results.success) { // Type guard
        expect(results.data).toEqual([]);
      }
    });

    it('should close session on error', async () => {
      mockDriver.session.mockReturnValue(mockSession);
      mockSession.run.mockRejectedValue(new Error('Query failed'));
      jest.spyOn(wrapper['circuit'], 'execute').mockImplementation(async (fn) => fn());

      const result = await wrapper.executeQuery('INVALID QUERY');
      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error.message).toContain('Query failed');
      }
      
      expect(mockSession.close).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('verifyConnection', () => {
    it('should return true for successful connection', async () => {
      mockDriver.session.mockReturnValue(mockSession);
      mockSession.run.mockResolvedValue({
        records: [],
        summary: {} as any
      });
      jest.spyOn(wrapper['circuit'], 'execute').mockImplementation(async (fn) => fn());

      const result = await wrapper.verifyConnection();
      
      expect(result.success).toBe(true);
      if (result.success) { // Type guard
        expect(result.data).toBe(true);
      }
      expect(mockSession.run).toHaveBeenCalledWith('RETURN 1 as test');
    });

    it('should return false for failed connection', async () => {
      jest.spyOn(wrapper['circuit'], 'execute').mockRejectedValue(new Error('Connection failed'));

      const result = await wrapper.verifyConnection();
      
      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeDefined(); // Expect an error object
        // Optionally, check the error message or code if needed
      }
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close driver successfully', async () => {
      mockDriver.close.mockResolvedValue(undefined);

      await wrapper.close();
      
      expect(mockDriver.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      mockDriver.close.mockRejectedValue(new Error('Close failed'));

      await expect(wrapper.close())
        .rejects.toThrow('Close failed');
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getCircuitState', () => {
    it('should return circuit state', () => {
      jest.spyOn(wrapper['circuit'], 'getState').mockReturnValue('closed' as any);
      
      const state = wrapper.getCircuitState();
      
      expect(state).toBe('closed');
      expect(wrapper['circuit'].getState).toHaveBeenCalled();
    });
  });
});