import 'reflect-metadata';
import { Neo4jService } from '../Neo4jService';
import neo4j, { Driver, Session, Record, QueryResult } from 'neo4j-driver';
import { container } from 'tsyringe';
import { mockDeep } from 'jest-mock-extended';
import { Neo4jCircuitWrapper } from '../Neo4jCircuitWrapper';

// Mock the neo4j driver and auth
jest.mock('neo4j-driver', () => ({
  driver: jest.fn(),
  auth: {
    basic: jest.fn().mockReturnValue({})
  },
  types: {
    Record: jest.fn()
  }
}));

// Mock the circuit wrapper
jest.mock('../Neo4jCircuitWrapper', () => ({
  Neo4jCircuitWrapper: jest.fn()
}));

describe('Neo4jService', () => {
  let service: Neo4jService;
  const mockDriver = mockDeep<Driver>();
  const mockCircuit = mockDeep<Neo4jCircuitWrapper>();
  const mockSession = mockDeep<Session>();
  const mockRecord = mockDeep<Record>();
  const mockQueryResult = mockDeep<QueryResult>();

  beforeEach(() => {
    (neo4j.driver as jest.Mock).mockReturnValue(mockDriver);
    (Neo4jCircuitWrapper as jest.Mock).mockImplementation(() => mockCircuit);
    
    container.clearInstances();
    service = container.resolve(Neo4jService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://localhost:7687',
        expect.anything()
      );
      expect(Neo4jCircuitWrapper).toHaveBeenCalledWith(mockDriver);
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return formatted results', async () => {
      const testData = { id: 1, name: 'Test' };
      
      mockCircuit.execute.mockImplementation(async (fn) => {
        mockDriver.session.mockReturnValue(mockSession);
        mockRecord.toObject.mockReturnValue(testData);
        mockQueryResult.records = [mockRecord];
        mockSession.run.mockResolvedValue(mockQueryResult);
        return fn(mockDriver);
      });

      const result = await service.executeQuery('MATCH (n) RETURN n');
      expect(result).toEqual([testData]);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      mockCircuit.execute.mockImplementation(async (fn) => {
        mockDriver.session.mockReturnValue(mockSession);
        mockQueryResult.records = [];
        mockSession.run.mockResolvedValue(mockQueryResult);
        return fn(mockDriver);
      });

      const result = await service.executeQuery('MATCH (n) RETURN n');
      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      mockCircuit.execute.mockRejectedValue(new Error('Query failed'));
      await expect(service.executeQuery('INVALID')).rejects.toThrow('Query failed');
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockCircuit.execute.mockResolvedValue(undefined);
      expect(await service.verifyConnection()).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockCircuit.execute.mockRejectedValue(new Error('Connection failed'));
      expect(await service.verifyConnection()).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the driver connection', async () => {
      await service.close();
      expect(mockDriver.close).toHaveBeenCalled();
    });
  });
});