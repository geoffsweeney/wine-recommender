import request from 'supertest';
import { createServer } from '../../server';
import { container } from 'tsyringe';
import { Neo4jService } from '../../services/Neo4jService';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator';
import { InputValidationAgent } from '../../core/agents/InputValidationAgent';
import { RecommendationAgent } from '../../core/agents/RecommendationAgent';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { InMemoryDeadLetterQueue } from '../../core/InMemoryDeadLetterQueue';
import { LoggingDeadLetterHandler, BasicDeadLetterProcessor } from '../../core/BasicDeadLetterProcessor';
import { BasicRetryManager } from '../../core/BasicRetryManager';

jest.mock('../../services/Neo4jService');
jest.mock('../../core/agents/RecommendationAgent');
jest.mock('../../core/BasicDeadLetterProcessor'); // Mock BasicDeadLetterProcessor

// Import the mocked modules
const MockNeo4jService = require('../../services/Neo4jService').Neo4jService;
const MockRecommendationAgent = require('../../core/agents/RecommendationAgent').RecommendationAgent;
const MockBasicDeadLetterProcessor = require('../../core/BasicDeadLetterProcessor').BasicDeadLetterProcessor; // Import mocked processor

describe('Recommendations Integration', () => {
  let app: any;
  let mockNeo4jServiceInstance: jest.Mocked<Neo4jService>;
  let dlq: InMemoryDeadLetterQueue;
  let mockRecommendationAgentInstance: jest.Mocked<RecommendationAgent>;
  let mockDlqProcessorInstance: jest.Mocked<BasicDeadLetterProcessor>; // Mocked processor instance
  let processSpy: jest.SpyInstance; // Spy on process method
  let addToDlqSpy: jest.SpyInstance; // Spy on addToDLQ method
  let mockCoordinator: jest.Mocked<SommelierCoordinator>;

  beforeEach(() => {
    container.clearInstances(); // Clear instances before each test
    container.reset(); // Reset container before each test

    // Create fresh mock instances for each test
    mockNeo4jServiceInstance = new MockNeo4jService() as jest.Mocked<Neo4jService>;
    mockRecommendationAgentInstance = new MockRecommendationAgent() as jest.Mocked<RecommendationAgent>;
    mockDlqProcessorInstance = new MockBasicDeadLetterProcessor() as jest.Mocked<BasicDeadLetterProcessor>; // Create mocked processor instance

    // Ensure Neo4j connection is verified (mocked)
    mockNeo4jServiceInstance.verifyConnection.mockResolvedValue(true);

    // Register dependencies with the mocked instances
    container.register(Neo4jService, { useValue: mockNeo4jServiceInstance });
    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService });
    container.register(InputValidationAgent, { useClass: InputValidationAgent });
    container.register(BasicDeadLetterProcessor, { useValue: mockDlqProcessorInstance }); // Register mocked processor
    container.register(RecommendationAgent, { useValue: mockRecommendationAgentInstance }); // Use the mocked instance
    container.register(SommelierCoordinator, { useClass: SommelierCoordinator });

    // Re-register Dead Letter Queue and Retry Manager implementations
    container.registerSingleton('InMemoryDeadLetterQueue', InMemoryDeadLetterQueue);
    container.registerSingleton('LoggingDeadLetterHandler', LoggingDeadLetterHandler);
    container.registerSingleton('BasicRetryManager', BasicRetryManager);
    // Note: BasicDeadLetterProcessor is now mocked and registered above

    // Resolve and store the DLQ instance for the current test
    dlq = container.resolve('InMemoryDeadLetterQueue');
    // Clear the DLQ before each test
    dlq.clear();

    // Also resolve and store the DLQ processor to verify it's called
    processSpy = jest.spyOn(mockDlqProcessorInstance, 'process'); // Spy on mocked instance
    addToDlqSpy = jest.spyOn(mockDlqProcessorInstance, 'addToDLQ'); // Spy on mocked instance

    // Resolve the Coordinator instance for the current test (it will use the mocked agents)
    mockCoordinator = container.resolve(SommelierCoordinator) as jest.Mocked<SommelierCoordinator>;

    // Create a new server instance for each test
    app = createServer();
  });

  afterEach(() => {
    container.clearInstances(); // Clean up instances after each test
    container.reset(); // Reset container after each test
    jest.clearAllMocks(); // Clear mocks after each test
  });

  const checkDLQTimeout = async () => {
      if (dlq.getAll().length > 0) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    };

  it('should return a recommendation for a valid request', async () => {
    mockNeo4jServiceInstance.executeQuery.mockResolvedValue([
      { id: 'w1', name: 'Wine 1', type: 'Red', region: 'Test', vintage: 2020, price: 30, rating: 4.5 },
    ]);

    // Mock the RecommendationAgent's handleMessage for this specific test
    mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
      recommendation: "Default mock recommendation."
    });

    const requestBody = {
      userId: 'test-user',
      preferences: { wineType: 'red' },
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(requestBody)
      .expect(200);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('recommendation');
    expect(response.body.recommendation).toBe("Default mock recommendation.");
  });

  it('should validate request and return 400 for invalid input', async () => {
    const invalidRequestBody = { message: 'Invalid request' };

    const response = await request(app)
      .post('/api/recommendations')
      .send(invalidRequestBody)
      .expect(400);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 400);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);

    // Verify that addToDLQ was NOT called
    expect(addToDlqSpy).not.toHaveBeenCalled();
  });

  it('should handle empty preferences gracefully', async () => {
    mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
      recommendation: "No specific preferences provided, here are some general recommendations."
    });

    const requestBody = {
      userId: 'test-user',
      preferences: {}
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(requestBody)
      .expect(200);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('recommendation');
    expect(response.body.recommendation).toContain("No specific preferences provided, here are some general recommendations.");
  });

  it('should return recommendations based on price range', async () => {
    mockNeo4jServiceInstance.executeQuery.mockResolvedValue([
      { id: 'w2', name: 'Affordable Wine', type: 'White', region: 'Test', vintage: 2019, price: 20, rating: 4.0 },
    ]);

    // Mock the RecommendationAgent's handleMessage for this specific test
    mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
      recommendation: 'Based on your preferences, we recommend: Affordable Wine (Test).',
    });

    const requestBody = {
      userId: 'test-user',
      preferences: { priceRange: [10, 30] },
    };

    const response = await request(app)
      .post('/api/recommendations')
      .send(requestBody)
      .expect(200);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('recommendation');
    expect(response.body.recommendation).toContain('Affordable Wine');
  });

  it('should return a recommendation for a preference-based request (food pairing in preferences)', async () => {
    mockNeo4jServiceInstance.executeQuery.mockResolvedValue([
      { id: 'w9', name: 'Food Pairing Wine 1', type: 'White', region: 'Test', vintage: 2019, price: 35, rating: 4.5 },
    ]);

    // Mock the RecommendationAgent's handleMessage for this specific test
    mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
      recommendation: 'Based on your preferences, we recommend: Food Pairing Wine 1 (Test).'
    });

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

    expect(response.status).toBe(200);
    expect(typeof response.body.recommendation).toBe('string');
    expect(response.body.recommendation).toContain('Based on your preferences, we recommend:'); // Check for expected prefix
    expect(response.body.recommendation).toContain('Food Pairing Wine 1'); // Check for expected wine name
  });

});
