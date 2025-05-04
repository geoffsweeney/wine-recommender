import 'reflect-metadata';
import { WineRecommendationController } from '../WineRecommendationController';
import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { RecommendationService } from '../../../services/RecommendationService';

jest.mock('../../../services/RecommendationService');

describe('WineRecommendationController', () => {
  let controller: WineRecommendationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockRecommendationService: jest.Mocked<RecommendationService>;

  beforeEach(() => {
    mockRecommendationService = {
      getRecommendations: jest.fn(),
      searchWines: jest.fn()
    } as unknown as jest.Mocked<RecommendationService>;
    
    container.registerInstance('RecommendationService', mockRecommendationService);
    controller = new WineRecommendationController(mockRecommendationService);
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      sendStatus: jest.fn()
    };
  });

  describe('executeImpl', () => {
    it('should return recommendations successfully', async () => {
      const testData = [{ wine: 'Test Wine' }];
      mockRecommendationService.getRecommendations.mockResolvedValue(testData);
      mockRequest.body = { userId: 'test', preferences: {} };

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(testData);
    });

    it('should handle service errors', async () => {
      mockRecommendationService.getRecommendations.mockRejectedValue(new Error('Service Error'));
      mockRequest.body = { userId: 'test' };

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('searchWines', () => {
    it('should return search results with pagination', async () => {
      const testData = {
        data: [{ wine: 'Test Wine' }],
        pagination: { page: 1, limit: 10, total: 1 }
      };
      mockRecommendationService.searchWines.mockResolvedValue(testData);
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
      expect(mockResponse.json).toHaveBeenCalledWith(testData);
    });

    it('should pass query params to service', async () => {
      const testData = {
        data: [{ wine: 'Region Wine' }],
        pagination: { page: 1, limit: 10, total: 1 }
      };
      mockRecommendationService.searchWines.mockResolvedValue(testData);
      mockRequest.query = {
        region: 'Bordeaux',
        minPrice: '50',
        maxPrice: '100',
        page: '1',
        limit: '10'
      };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRecommendationService.searchWines).toHaveBeenCalledWith({
        region: 'Bordeaux',
        minPrice: '50',
        maxPrice: '100',
        page: '1',
        limit: '10'
      });
    });

    it('should handle service errors', async () => {
      mockRecommendationService.searchWines.mockRejectedValue(new Error('Service Error'));
      mockRequest.query = { query: 'test' };

      await controller.searchWines(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});