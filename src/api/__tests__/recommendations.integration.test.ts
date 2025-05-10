import request from 'supertest';
import { createServer } from '../../server';
import { container } from 'tsyringe';
import { Neo4jService } from '../../services/Neo4jService';
import { MockNeo4jService } from '../../services/MockNeo4jService';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator'; // Import agents
import { InputValidationAgent } from '../../core/agents/InputValidationAgent';
import { RecommendationAgent } from '../../core/agents/RecommendationAgent';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService'; // Import KnowledgeGraphService

// Mock Neo4jService for testing purposes
jest.mock('../../services/Neo4jService');

describe('Recommendations Integration', () => {
  let app: any;
  let mockNeo4jService: jest.Mocked<Neo4jService>;

  beforeAll(async () => {
    // Clear container before each test suite to avoid conflicts
    container.clearInstances();
    container.reset();

    // Resolve the mocked Neo4jService after jest.mock has been applied
    mockNeo4jService = container.resolve(Neo4jService) as jest.Mocked<Neo4jService>;

    // Register the mocked Neo4jService instance with the container
    container.registerInstance(Neo4jService, mockNeo4jService);

    // Register other services and agents with the container for the test environment
    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService });
    container.register(InputValidationAgent, { useClass: InputValidationAgent });
    container.register(RecommendationAgent, { useClass: RecommendationAgent });
    container.register(SommelierCoordinator, { useClass: SommelierCoordinator });

    app = createServer();
    // Ensure Neo4j connection is verified (mocked)
    mockNeo4jService.verifyConnection.mockResolvedValue(true);
  });

  afterAll(async () => {
    // Clean up container registrations after each test suite
    container.clearInstances();
    container.reset();
  });

  it('should return a recommendation for a preference-based request (wine type)', async () => {
    // Mock the executeQuery call in MockNeo4jService to return sample data for wine type
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w5', name: 'Preference Red Wine 1', type: 'Red', region: 'Test', vintage: 2017, price: 25, rating: 4.7 },
      { id: 'w6', name: 'Preference Red Wine 2', type: 'Red', region: 'Test', vintage: 2016, price: 22, rating: 4.4 },
    ]);

    const preferenceRequestBody = {
      userId: 'test-user-123',
      preferences: {
        wineType: 'red' // Preference for red wine
      },
      // message: 'Recommend a red wine' // No message needed for preference-based
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(preferenceRequestBody)
      .expect(200);

    // Assert on the response structure and content
    expect(response.body).toHaveProperty('recommendation');
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Based on your preferences, we recommend:'); // Check for expected prefix
    expect(response.body.recommendation).toContain('Preference Red Wine 1'); // Check for expected wine name
    expect(response.body.recommendation).toContain('Preference Red Wine 2'); // Check for expected wine name
  });

  it('should return an error for an invalid request', async () => {
    const invalidRequestBody = {
      // Missing userId and preferences
      message: 'Recommend a red wine'
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(invalidRequestBody)
      .expect(400); // Expect a validation error status

    // Assert on the error response structure
    expect(response.body).toHaveProperty('status', 400);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('should return a recommendation for ingredients in the message', async () => {
    // Mock the executeQuery call in MockNeo4jService to return sample data for ingredients
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w3', name: 'Ingredient Wine 1', type: 'White', region: 'Test', vintage: 2021, price: 15, rating: 4.2 },
      { id: 'w4', name: 'Ingredient Wine 2', type: 'Red', region: 'Test', vintage: 2018, price: 20, rating: 4.6 },
    ]);

    const ingredientsRequestBody = {
      userId: 'test-user-456',
      preferences: {},
      message: 'pair wine with chicken and pasta' // Message with ingredients
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(ingredientsRequestBody)
      .expect(200);

    // Assert on the response structure and content
    expect(response.body).toHaveProperty('recommendation');
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Based on your ingredients, we recommend:'); // Check for expected prefix
    expect(response.body.recommendation).toContain('Ingredient Wine 1'); // Check for expected wine name
    expect(response.body.recommendation).toContain('Ingredient Wine 2'); // Check for expected wine name
  });

  it('should return a recommendation for a preference-based request (price range)', async () => {
    // Mock the executeQuery call in MockNeo4jService to return sample data for price range
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w7', name: 'Price Range Wine 1', type: 'White', region: 'Test', vintage: 2022, price: 30, rating: 4.0 },
      { id: 'w8', name: 'Price Range Wine 2', type: 'Red', region: 'Test', vintage: 2015, price: 45, rating: 4.8 },
    ]);

    const priceRangeRequestBody = {
      userId: 'test-user-789',
      preferences: {
        priceRange: [25, 50] // Preference for price range
      },
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(priceRangeRequestBody)
      .expect(200);

    // Assert on the response structure and content
    expect(response.body).toHaveProperty('recommendation');
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Based on your preferences, we recommend:'); // Check for expected prefix
    expect(response.body.recommendation).toContain('Price Range Wine 1'); // Check for expected wine name
    expect(response.body.recommendation).toContain('Price Range Wine 2'); // Check for expected wine name
  });

  it('should return a recommendation for a preference-based request (food pairing in preferences)', async () => {
    // Mock the executeQuery call in MockNeo4jService to return sample data for food pairing
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w9', name: 'Food Pairing Wine 1', type: 'White', region: 'Test', vintage: 2019, price: 35, rating: 4.5 },
    ]);

    const foodPairingRequestBody = {
      userId: 'test-user-012',
      preferences: {
        foodPairing: 'salmon' // Preference for food pairing
      },
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(foodPairingRequestBody)
      .expect(200);

    // Assert on the response structure and content
    expect(response.body).toHaveProperty('recommendation');
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Based on your preferences, we recommend:'); // Check for expected prefix
    expect(response.body.recommendation).toContain('Food Pairing Wine 1'); // Check for expected wine name
  });

  // Add more tests as needed for different scenarios
});