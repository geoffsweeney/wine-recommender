import request from 'supertest';
import express, { Express } from 'express';
import { container, DependencyContainer } from 'tsyringe';
import { TYPES } from '../../../di/Types';
import createWineRecommendationRouter from '../../wineRecommendationRoutes';
import { IRecommendationStrategy } from '../../../services/interfaces/IRecommendationStrategy';
import { ISearchStrategy } from '../../../services/interfaces/ISearchStrategy';
import { LLMService } from '../../../services/LLMService';
import { mock } from 'jest-mock-extended';
import { ILogger } from '../../../services/LLMService'; // Assuming ILogger is defined here or similar
import { WineNode } from '../../../types'; // Corrected import path for WineNode

describe('WineRecommendationController', () => {
  let app: Express;
  const mockRecommendationStrategy = mock<IRecommendationStrategy>();
  const mockSearchStrategy = mock<ISearchStrategy>();
  const mockLLMService = mock<LLMService>();
  const mockLogger = mock<ILogger>();

  beforeAll(() => {
    // Mock dependencies for WineRecommendationController
    container.register(TYPES.IRecommendationStrategy, {
      useValue: mockRecommendationStrategy,
    });
    container.register(TYPES.ISearchStrategy, {
      useValue: mockSearchStrategy,
    });
    container.register(TYPES.LLMService, {
      useValue: mockLLMService,
    });
    container.register(TYPES.Logger, {
      useValue: mockLogger,
    });

    app = express();
    app.use(express.json());
    app.use(createWineRecommendationRouter(container));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.reset();
  });

  describe('POST /wine-recommendations', () => {
    it('should return 200 with recommendations', async () => {
      const mockRecommendations: WineNode[] = [{ id: '1', name: 'Test Wine', type: 'red', region: 'France' }];
      mockRecommendationStrategy.execute.mockResolvedValue(mockRecommendations);

      const requestBody = {
        userId: 'test-user-123',
        input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, // Explicitly add default
      };

      const response = await request(app)
        .post('/wine-recommendations')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendations);
      expect(mockRecommendationStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          input: expect.objectContaining({
            preferences: expect.objectContaining({ wineType: 'red' }),
            recommendationSource: 'knowledgeGraph',
          }),
        })
      );
    });

    it('should return 400 for invalid recommendation request', async () => {
      const invalidRequestBody = {
        userId: 'test-user-123',
        input: { invalidField: 'value' }, // Invalid input
      };

      const response = await request(app)
        .post('/wine-recommendations')
        .send(invalidRequestBody);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 on recommendation strategy error', async () => {
      mockRecommendationStrategy.execute.mockRejectedValue(new Error('Strategy error'));

      const requestBody = {
        userId: 'test-user-123',
        input: { preferences: { wineType: 'red' } },
      };

      const response = await request(app)
        .post('/wine-recommendations')
        .send(requestBody);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Strategy error' });
    });
  });

  describe('GET /wine-recommendations', () => {
    it('should return 200 with search results', async () => {
      const mockSearchResults: WineNode[] = [{ id: '2', name: 'Search Wine', type: 'white', region: 'Italy' }];
      mockSearchStrategy.execute.mockResolvedValue(mockSearchResults);

      const queryParams = { query: 'test', limit: '10' }; // Send limit as string

      const response = await request(app)
        .get('/wine-recommendations')
        .query(queryParams);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSearchResults);
      expect(mockSearchStrategy.execute).toHaveBeenCalledWith({
        query: 'test',
        limit: 10, // Expect limit as number after transformation
        offset: 0, // Default value
        page: 1, // Default value
      });
    });

    it('should return 400 for invalid search request', async () => {
      const invalidQueryParams = { invalidParam: 'value' }; // Invalid query

      const response = await request(app)
        .get('/wine-recommendations')
        .query(invalidQueryParams);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 on search strategy error', async () => {
      mockSearchStrategy.execute.mockRejectedValue(new Error('Search error'));

      const queryParams = { query: 'test', limit: 10 };

      const response = await request(app)
        .get('/wine-recommendations')
        .query(queryParams);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Search error' }); // Expect the specific error message
    });
  });
});