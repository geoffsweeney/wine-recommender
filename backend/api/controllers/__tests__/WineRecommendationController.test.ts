import { container } from 'tsyringe';
import { WineRecommendationController } from '../WineRecommendationController';
import { Request, Response } from 'express';
import { IRecommendationStrategy } from '../../../services/interfaces/IRecommendationStrategy';
import { ISearchStrategy } from '../../../services/interfaces/ISearchStrategy';
import { LLMService } from '../../../services/LLMService';
import { ILogger } from '../../../di/Types'; // Corrected import path for ILogger
import { TYPES } from '../../../di/Types';
import { mock } from 'jest-mock-extended';
import { RecommendationRequest } from '../../dtos/RecommendationRequest.dto';
import { SearchRequest } from '../../dtos/SearchRequest.dto';

describe('WineRecommendationController', () => {
  let controller: WineRecommendationController;
  let mockRequest: Partial<Request> & { validatedBody?: any; validatedQuery?: any; }; // Explicitly add validatedBody and validatedQuery
  let mockResponse: Partial<Response>;
  let mockRecommendationStrategy: jest.Mocked<IRecommendationStrategy>;
  let mockSearchStrategy: jest.Mocked<ISearchStrategy>;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockLogger: jest.Mocked<ILogger>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    container.clearInstances(); // Clear container before each test

    mockRecommendationStrategy = mock<IRecommendationStrategy>();
    mockSearchStrategy = mock<ISearchStrategy>();
    mockLLMService = mock<LLMService>();
    mockLogger = mock<ILogger>();

    container.register(TYPES.IRecommendationStrategy, { useValue: mockRecommendationStrategy });
    container.register(TYPES.ISearchStrategy, { useValue: mockSearchStrategy });
    container.register(TYPES.LLMService, { useValue: mockLLMService });
    container.register(TYPES.Logger, { useValue: mockLogger });

    controller = container.resolve(WineRecommendationController);

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };
    mockRequest = {
      // Initialize with validatedBody and validatedQuery directly
      validatedBody: {},
      validatedQuery: {},
      // Add other necessary Request properties if they are accessed by the controller
      method: 'POST', // Default method for POST tests
      query: {}, // Ensure query is present for GET tests
      body: {}, // Ensure body is present for POST tests
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    container.reset(); // Reset container after each test
  });

  describe('executeImpl - POST /wine-recommendations', () => {
    it('should return recommendations successfully', async () => {
      const testData = [{
        id: 'test-wine-id',
        name: 'Test Wine',
        type: 'Red',
        region: 'Bordeaux',
        rank: 1,
        finalScore: 0.95
      }];
      mockRecommendationStrategy.execute.mockResolvedValue(testData);
      
      const requestBody: RecommendationRequest = {
        userId: 'test-user-123',
        input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' },
      };
      mockRequest.validatedBody = requestBody; // Use validatedBody

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRecommendationStrategy.execute).toHaveBeenCalledWith(requestBody);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(testData);
    });

    it('should handle service errors', async () => {
      mockRecommendationStrategy.execute.mockRejectedValue(new Error('Service Error'));
      
      const requestBody: RecommendationRequest = {
        userId: 'test-user-123',
        input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' },
      };
      mockRequest.validatedBody = requestBody; // Use validatedBody

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRecommendationStrategy.execute).toHaveBeenCalledWith(requestBody);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Service Error' }); // Expect specific error message
    });
  });

  describe('executeImpl - GET /wine-recommendations', () => {
    beforeEach(() => {
      mockRequest.method = 'GET'; // Set method to GET for these tests
    });

    it('should return search results successfully', async () => {
      const testData = [{
        id: 'search-wine-id',
        name: 'Search Wine',
        type: 'White',
        region: 'Napa',
      }];
      mockSearchStrategy.execute.mockResolvedValue(testData);

      const queryParams: SearchRequest = {
        query: 'test',
        limit: 10,
        offset: 0,
        page: 1,
      };
      mockRequest.validatedQuery = queryParams; // Use validatedQuery

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSearchStrategy.execute).toHaveBeenCalledWith(queryParams);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(testData);
    });

    it('should handle search service errors', async () => {
      mockSearchStrategy.execute.mockRejectedValue(new Error('Search Service Error'));

      const queryParams: SearchRequest = {
        query: 'test',
        limit: 10,
        offset: 0,
        page: 1,
      };
      mockRequest.validatedQuery = queryParams; // Use validatedQuery

      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSearchStrategy.execute).toHaveBeenCalledWith(queryParams);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Search Service Error' }); // Expect specific error message
    });
  });

  it('should return 405 for unsupported HTTP method', async () => {
    mockRequest.method = 'PATCH';
    await controller.execute(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(405);
    expect(jsonSpy).toHaveBeenCalledWith({ message: 'Method not allowed' });
  });
});
