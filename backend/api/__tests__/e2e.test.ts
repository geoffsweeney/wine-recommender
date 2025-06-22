import "reflect-metadata"; // Required for tsyringe
import request from 'supertest';
import { Express } from 'express'; // Import Express type
import { DependencyContainer } from 'tsyringe'; // Import DependencyContainer
import { TYPES } from '../../di/Types'; // Import TYPES
import { createServer } from '../../server'; // Adjusted path and import registerDependencies
import { Neo4jService } from '../../services/Neo4jService'; // Import Neo4jService for afterAll cleanup
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService'; // Import KnowledgeGraphService
import { createTestContainer } from '../../test-setup'; // Import createTestContainer

describe('E2E Tests', () => {
  jest.setTimeout(30000); // Increase timeout for E2E tests
  let app: Express; // Explicitly define the type of app
  let server: any; // Declare server variable
  let container: DependencyContainer; // Declare container variable
  let resetMocks: () => void; // Declare resetMocks variable

  beforeAll(() => {
    console.log('e2e.test.ts: beforeAll started'); // Add logging

    // Use createTestContainer to get a fresh container with mocked dependencies
    ({ container, resetMocks } = createTestContainer());

    // Create the app instance, passing the test container
    app = createServer(container);
    server = app.listen(0); // Start the server and assign to the server variable. Use port 0 to get a random available port.
  });

  afterEach(() => {
    resetMocks(); // Reset mocks after each test
    jest.clearAllMocks(); // Clear all Jest mocks
  });

  it('should return a successful response for the health check', async () => {
    const response = await request(app).get('/health'); // Use the health check endpoint
    // console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy'); // Check for the status property
  });

  it('should return an error response for an invalid request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      // Missing required fields
    });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Validation failed'); // Expect 'Validation failed' message
    expect(response.body).toHaveProperty('errors');
  });

  it('should return a successful response for a valid recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user',
      input: { // Wrap preferences in the 'input' property
        preferences: {
          wineType: 'red',
          priceRange: [10, 30],
          foodPairing: 'salmon',
          excludeAllergens: []
        },
        message: 'Recommend a wine for salmon' // Added message field
      },
      recommendationSource: 'knowledgeGraph', // Added recommendationSource
      conversationHistory: [] // Include an empty conversation history array
    });
    // console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.status).toBe(200); // Expect a 200 status code
    expect(response.body).toHaveProperty('primaryRecommendation'); // Check for the primaryRecommendation property
    expect(response.body).toHaveProperty('explanation'); // Check for the explanation property
    expect(response.body).toHaveProperty('confidence'); // Check for the confidence property
  }, 30000); // Increased timeout to 30 seconds

  it('should return a successful response for a valid ingredient-based recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user-ingredient',
      input: { // Wrap ingredients in the 'input' property
        ingredients: ['beef'],
        recommendationSource: 'knowledgeGraph' // Added recommendationSource
      },
      conversationHistory: [] // Include an empty conversation history array
    });
    // console.log('Test response (ingredient-based):', response.body); // Log the response body for debugging
    expect(response.status).toBe(200); // Expect a 200 status code
    expect(response.body).toHaveProperty('primaryRecommendation'); // Check for the primaryRecommendation property
    expect(response.body).toHaveProperty('explanation'); // Check for the explanation property
    expect(response.body).toHaveProperty('confidence'); // Check for the confidence property
  }, 30000); // Increased timeout to 30 seconds

  it('should return a successful response for an LLM-based recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user-llm',
      input: { // Wrap message in the 'input' property
        message: 'Recommend a sweet white wine',
        recommendationSource: 'llm' // Set recommendationSource to 'llm'
      },
      conversationHistory: [] // Include an empty conversation history array
    });
    // console.log('Test response (LLM-based):', response.body); // Log the response body for debugging
    expect(response.status).toBe(200); // Expect a 200 status code
    expect(response.body).toHaveProperty('primaryRecommendation'); // Check for the primaryRecommendation property
    expect(response.body).toHaveProperty('explanation'); // Check for the explanation property
    expect(response.body).toHaveProperty('confidence'); // Check for the confidence property
  }, 30000); // Increased timeout to 30 seconds

  afterAll(async () => {
    console.log('e2e.test.ts: afterAll started'); // Add logging
    try {
      // Close server first
      if (server) { // Check if server is defined
        console.log('e2e.test.ts: Attempting to close server'); // Log before closing
        await new Promise((resolve, reject) => {
          server.close((err: Error | undefined) => { // Add type annotation for err
            if (err) {
              console.error('e2e.test.ts: Error closing server:', err); // Log the error
              reject(err);
            } else {
              console.log('e2e.test.ts: Server closed successfully'); // Log successful closure
              resolve(undefined);
            }
          });
        });
        console.log('e2e.test.ts: server.close() promise resolved'); // Log after closing
      } else {
        console.log('e2e.test.ts: Server instance not found, skipping close'); // Log if server is not defined
      }
    } catch (error) {
      console.error('e2e.test.ts: Error during server closure promise:', error); // More specific error logging
    }

    // No need to close Neo4jService here, as it's mocked in createTestContainer
    // and its close method is mocked.
    // The container is reset by resetMocks() in afterEach.
  });
  describe('User Preference API E2E Tests', () => {
    it('should return 200 with user preferences', async () => {
      // Mock the KnowledgeGraphService.getPreferences to return some data
      const mockKnowledgeGraphService = container.resolve(TYPES.KnowledgeGraphService) as jest.Mocked<KnowledgeGraphService>;
      mockKnowledgeGraphService.getPreferences.mockResolvedValueOnce([
        { type: 'wineType', value: 'red', active: true, source: 'manual', timestamp: new Date().toISOString() }
      ]);

      const response = await request(app).get('/api/users/testUser123/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({ type: 'wineType', value: 'red' })
      ]);
      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith('testUser123');
    }, 30000);

    it('should return 200 on successful preference addition', async () => {
      const mockKnowledgeGraphService = container.resolve(TYPES.KnowledgeGraphService) as jest.Mocked<KnowledgeGraphService>;
      mockKnowledgeGraphService.addOrUpdatePreference.mockResolvedValueOnce(undefined);

      const newPreference = { type: 'grapeVarietal', value: 'Merlot', active: true, source: 'manual', timestamp: new Date().toISOString() };
      const response = await request(app)
        .post('/api/users/testUser123/preferences')
        .send(newPreference);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preference added/updated successfully' });
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(
        'testUser123',
        expect.objectContaining(newPreference)
      );
    }, 30000);

    it('should return 200 on successful preference deletion', async () => {
      const mockKnowledgeGraphService = container.resolve(TYPES.KnowledgeGraphService) as jest.Mocked<KnowledgeGraphService>;
      mockKnowledgeGraphService.deletePreference.mockResolvedValueOnce(undefined);

      const response = await request(app).delete('/api/users/testUser123/preferences/prefId456');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preference deleted successfully' });
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(
        'testUser123',
        'prefId456'
      );
    }, 30000);
  });

  describe('Search API E2E Tests', () => {
    it('should return 200 with search results for a valid query', async () => {
      const mockSearchStrategy = container.resolve(TYPES.ISearchStrategy) as jest.Mocked<any>; // Mock ISearchStrategy
      mockSearchStrategy.execute.mockResolvedValueOnce([
        { id: 'w1', name: 'Test Wine', type: 'red', region: 'Bordeaux' }
      ]);

      const response = await request(app)
        .get('/api/wine-recommendations') // Corrected endpoint
        .query({ query: 'red wine' })
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({ id: 'w1', name: 'Test Wine' })
      ]);
      expect(mockSearchStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'red wine' })
      );
    }, 30000);

    it('should return 400 for an invalid search query', async () => {
      const response = await request(app)
        .get('/api/wine-recommendations') // Corrected endpoint
        .query({ query: '' })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    }, 30000);
  });
});
