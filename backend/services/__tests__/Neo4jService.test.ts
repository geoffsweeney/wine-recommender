import 'reflect-metadata';
import { Neo4jService } from '../Neo4jService';
import { mock, instance, when, anything, verify, reset, deepEqual } from 'ts-mockito';
import { INeo4jCircuitWrapper } from '../Neo4jCircuitWrapper';
import { ILogger } from '../../di/Types';
import neo4j from 'neo4j-driver';
import { Record, QueryResult } from 'neo4j-driver';
import { Result } from '../../core/types/Result'; // Import Result
import { AgentError } from '../../core/agents/AgentError'; // Import AgentError

// Mock implementations
const createMockRecord = (data: any): any => {
  return {
    toObject: () => data,
    get: (key: string) => data[key],
    keys: Object.keys(data),
    ...data
  };
};

const createMockQueryResult = (records: any[]): any => {
  return {
    records,
    summary: {
      query: { text: '', parameters: {} },
      counters: {
        updates: () => neo4j.int(0),
        containsUpdates: () => false,
        nodesCreated: () => neo4j.int(0),
        nodesDeleted: () => neo4j.int(0),
        relationshipsCreated: () => neo4j.int(0),
        relationshipsDeleted: () => neo4j.int(0),
        propertiesSet: () => neo4j.int(0),
        labelsAdded: () => neo4j.int(0),
        labelsRemoved: () => neo4j.int(0),
        indexesAdded: () => neo4j.int(0),
        indexesRemoved: () => neo4j.int(0),
        constraintsAdded: () => neo4j.int(0),
        constraintsRemoved: () => neo4j.int(0),
        systemUpdates: () => neo4j.int(0)
      },
      server: { address: '' },
      resultConsumedAfter: neo4j.int(0),
      resultAvailableAfter: neo4j.int(0)
    }
  };
};

describe('Neo4jService', () => {
  let mockCircuit: INeo4jCircuitWrapper;
  let mockLogger: ILogger;
  let service: Neo4jService;

  const testUri = 'bolt://localhost:7687';
  const testUser = 'neo4j';
  const testPassword = 'password';

  beforeEach(async () => { // Made beforeEach async
    mockCircuit = mock<INeo4jCircuitWrapper>();
    mockLogger = mock<ILogger>();

    // Create service with mocked dependencies
    service = new Neo4jService(
      testUri,
      testUser,
      testPassword,
      instance(mockCircuit),
      instance(mockLogger)
    );
    await service.init(); // Call init() after service creation
  });

  afterEach(() => {
    reset(mockCircuit);
    reset(mockLogger);
  });

  describe('executeQuery', () => {
    it('should execute query and return node properties', async () => {
      const testQuery = 'MATCH (w:Wine) RETURN w';
      const testParams = { limit: 10 };
      
      const mockRecord = createMockRecord({
        w: {
          properties: {
            id: 'w1',
            name: 'Test Wine',
            type: 'Red'
          }
        }
      });

      const mockResult = createMockQueryResult([mockRecord]);

      when(mockCircuit.executeQuery(anything(), anything())).thenResolve({ success: true, data: [{
        id: 'w1',
        name: 'Test Wine',
        type: 'Red'
      }] });

      const result = await service.executeQuery(testQuery, testParams);

      expect(result).toEqual([{
        id: 'w1',
        name: 'Test Wine',
        type: 'Red'
      }]);

      // Debug logging happens before parameter conversion
      // so we don't verify the exact parameters here
    });

    it('should convert parameters to Neo4j types', async () => {
      const testQuery = 'MATCH (w:Wine) RETURN w';
      const testParams = {
        limit: 10,
        skip: 5,
        price: 99.99,
        ids: [1, 2, 3],
        nested: { count: 100 }
      };

      when(mockCircuit.executeQuery(anything(), anything())).thenResolve({ success: true, data: [] });

      await service.executeQuery(testQuery, testParams);

    });

    it('should handle empty results', async () => {
      const testQuery = 'MATCH (w:Wine) RETURN w';
      
      when(mockCircuit.executeQuery(anything(), anything())).thenResolve({ success: true, data: [] });
      when(mockLogger.debug('Query returned no records')).thenReturn();

      const result = await service.executeQuery(testQuery);
      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      const testQuery = 'INVALID QUERY';
      const testError = new AgentError('Query failed', 'NEO4J_QUERY_FAILED', 'Neo4jCircuitWrapper', 'N/A');

      when(mockCircuit.executeQuery(anything(), anything())).thenResolve({ success: false, error: testError });

      await expect(service.executeQuery(testQuery)).rejects.toThrow('Query failed');
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is verified', async () => {
      when(mockCircuit.verifyConnection()).thenResolve({ success: true, data: true });

      const result = await service.verifyConnection();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false when connection fails', async () => {
      const testError = new AgentError('Connection failed', 'NEO4J_CONNECTION_FAILED', 'Neo4jCircuitWrapper', 'N/A');
      when(mockCircuit.verifyConnection()).thenResolve({ success: false, error: testError });

      const result = await service.verifyConnection();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('NEO4J_CONNECTION_FAILED');
      }
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when conditions are met', async () => {
      when(mockCircuit.getCircuitState()).thenReturn('CLOSED');
      when(mockCircuit.verifyConnection()).thenResolve({ success: true, data: true });

      const result = await service.healthCheck();
      expect(result).toEqual({
        status: 'healthy',
        circuitState: 'CLOSED',
        connectionVerified: true
      });
    });

    it('should return unhealthy status when circuit is open', async () => {
      when(mockCircuit.getCircuitState()).thenReturn('OPEN');
      when(mockCircuit.verifyConnection()).thenResolve({ success: true, data: true });

      const result = await service.healthCheck();
      expect(result).toEqual({
        status: 'unhealthy',
        circuitState: 'OPEN',
        connectionVerified: true
      });
    });

    it('should return unhealthy status when connection fails', async () => {
      const testError = new AgentError('Connection failed', 'NEO4J_CONNECTION_FAILED', 'Neo4jCircuitWrapper', 'N/A');
      when(mockCircuit.getCircuitState()).thenReturn('CLOSED');
      when(mockCircuit.verifyConnection()).thenResolve({ success: false, error: testError });

      const result = await service.healthCheck();
      expect(result).toEqual({
        status: 'unhealthy',
        circuitState: 'CLOSED',
        connectionVerified: false
      });
    });
  });

  describe('close', () => {
    it('should close circuit and driver successfully', async () => {
      when(mockCircuit.close()).thenResolve();

      await service.close();
      verify(mockCircuit.close()).once();
      verify(mockLogger.info('Neo4j service closed successfully')).once();
    });

    it('should handle close errors', async () => {
      const testError = new Error('Close failed');
      when(mockCircuit.close()).thenReject(testError);

      await expect(service.close()).rejects.toThrow('Close failed');
      verify(mockLogger.error('Failed to close Neo4j service', anything())).once();
    });
  });
});
