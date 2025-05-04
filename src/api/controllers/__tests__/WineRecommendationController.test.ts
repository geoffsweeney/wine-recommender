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

    it('should handle missing userId', async () => {
      mockRequest.body = { preferences: {} };

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});