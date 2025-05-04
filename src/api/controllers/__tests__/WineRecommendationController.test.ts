import 'reflect-metadata';
import { WineRecommendationController } from '../WineRecommendationController';
import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { Neo4jService } from '../../../services/Neo4jService';

jest.mock('../../../services/Neo4jService');

describe('WineRecommendationController', () => {
  let controller: WineRecommendationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNeo4j: jest.Mocked<Neo4jService>;

  beforeEach(() => {
    mockNeo4j = {
      executeQuery: jest.fn()
    } as unknown as jest.Mocked<Neo4jService>;
    
    container.registerInstance('Neo4jService', mockNeo4j);
    controller = new WineRecommendationController(mockNeo4j);
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('executeImpl', () => {
    it('should return recommendations successfully', async () => {
      const testData = [{ wine: 'Test Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(testData);
      mockRequest.body = { userId: 'test', preferences: {} };

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(testData);
    });
  });

  describe('searchWines', () => {
    it('should return search results with pagination', async () => {
      const testData = [{ wine: 'Test Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(testData);
      mockRequest.query = {
        query: 'test',
        page: '1',
        limit: '10'
      };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: testData,
        pagination: expect.any(Object)
      });
    });

    it('should handle region filter', async () => {
      const testData = [{ wine: 'Region Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(testData);
      mockRequest.query = {
        region: 'Bordeaux',
        page: '1',
        limit: '10'
      };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('w.region = $region'),
        expect.objectContaining({ region: 'Bordeaux' })
      );
    });

    it('should handle price range filter', async () => {
      const testData = [{ wine: 'Premium Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(testData);
      mockRequest.query = {
        minPrice: '50',
        maxPrice: '100',
        page: '1',
        limit: '10'
      };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('w.price >= $minPrice AND w.price <= $maxPrice'),
        expect.objectContaining({ minPrice: '50', maxPrice: '100' })
      );
    });

    it('should handle pagination limits', async () => {
      const testData = Array(50).fill({ wine: 'Test Wine' });
      mockNeo4j.executeQuery.mockResolvedValue(testData);
      mockRequest.query = {
        page: '2',
        limit: '100' // Should be capped at 50
      };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({ limit: 50 })
        })
      );
    });

    it('should handle database errors', async () => {
      mockNeo4j.executeQuery.mockRejectedValue(new Error('DB Error'));
      mockRequest.query = { query: 'test' };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});