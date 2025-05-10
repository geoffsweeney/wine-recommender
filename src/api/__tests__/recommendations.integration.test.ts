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

  it('should return a recommendation for a valid request', async () => {
    // Mock the executeQuery call in MockNeo4jService to return sample data
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w1', name: 'Sample Wine 1', type: 'Red', region: 'Test', vintage: 2020, price: 10, rating: 4 },
      { id: 'w2', name: 'Sample Wine 2', type: 'Red', region: 'Test', vintage: 2019, price: 12, rating: 4.5 },
    ]);

    const validRequestBody = {
      userId: 'test-user-123',
      preferences: {},
      message: 'Recommend a red wine'
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(validRequestBody)
      .expect(200);

    // Assert on the response structure and content
    expect(response.body).toHaveProperty('recommendation');
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Sample Wine 1'); // Check for expected content
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

  // Add more tests as needed for different scenarios
});