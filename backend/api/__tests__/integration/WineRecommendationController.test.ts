import express, { Express } from 'express';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { container } from 'tsyringe';
import { ILogger, TYPES } from '../../../di/Types';
import { IRecommendationStrategy } from '../../../services/interfaces/IRecommendationStrategy';
import { ISearchStrategy } from '../../../services/interfaces/ISearchStrategy';
import { LLMService } from '../../../services/LLMService';
import { WineNode } from '../../../types'; // Corrected import path for WineNode
import { WineRecommendationController } from '../../controllers/WineRecommendationController'; // Add this import
import createWineRecommendationRouter from '../../wineRecommendationRoutes';

describe('WineRecommendationController', () => {
  let app: Express;
  let wineRecommendationController: WineRecommendationController; // Declare here
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
    // wineRecommendationController = container.resolve(WineRecommendationController); // Removed useless assignment
    app.use('/api', createWineRecommendationRouter(container));

    // Add a simple test route to verify Express setup
    app.get('/test', (req, res) => {
      res.status(200).send('Test route works!');
    });
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
        .post('/api/wine-recommendations') // Added /api prefix
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
        .post('/api/wine-recommendations') // Added /api prefix
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
        .post('/api/wine-recommendations') // Added /api prefix
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
        .get('/api/wine-recommendations') // Added /api prefix
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
        .get('/api/wine-recommendations') // Added /api prefix
        .query(invalidQueryParams);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 on search strategy error', async () => {
      mockSearchStrategy.execute.mockRejectedValue(new Error('Search error'));

      const queryParams = { query: 'test', limit: 10 };

      const response = await request(app)
        .get('/api/wine-recommendations') // Added /api prefix
        .query(queryParams);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Search error' }); // Expect the specific error message
    });
  });

  it('should return 200 for the /test route', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Test route works!');
  });
});
