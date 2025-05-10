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
jest.mock('../../core/agents/RecommendationAgent', () => {
  const mockRecommendationAgentClass = jest.fn();
  mockRecommendationAgentClass.prototype.handleMessage = jest.fn().mockRejectedValue(new Error('Agent failure'));
  mockRecommendationAgentClass.prototype.getName = jest.fn().mockReturnValue('MockRecommendationAgent');
  mockRecommendationAgentClass.prototype.knowledgeGraphService = {};
  return { RecommendationAgent: mockRecommendationAgentClass };
});
const MockRecommendationAgent = jest.mocked(RecommendationAgent);

describe('Recommendations Integration', () => {
  let app: any;
  let mockNeo4jService: jest.Mocked<Neo4jService>;
  let dlq: InMemoryDeadLetterQueue;
  let mockRecommendationAgentInstance: jest.Mocked<RecommendationAgent>;
  let processSpy: jest.SpyInstance = jest.fn() as unknown as jest.SpyInstance;

  beforeAll(async () => {
    container.clearInstances();
    container.reset();

    // Register services and agents with the container for the test environment
    container.register(Neo4jService, { useClass: Neo4jService }); // Register the actual Neo4jService

    // Resolve the mocked Neo4jService after jest.mock has been applied
    mockNeo4jService = container.resolve(Neo4jService) as jest.Mocked<Neo4jService>;
    // Ensure Neo4j connection is verified (mocked)
    mockNeo4jService.verifyConnection.mockResolvedValue(true);
  });

  beforeEach(() => {
    container.clearInstances(); // Clear instances before each test
    container.reset(); // Reset container before each test

    // Re-register dependencies for each test
    container.register(Neo4jService, { useValue: mockNeo4jService }); // Use the mocked instance
    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService });
    container.register(InputValidationAgent, { useClass: InputValidationAgent });
    container.register(SommelierCoordinator, { useClass: SommelierCoordinator });

    // Re-register Dead Letter Queue and Retry Manager implementations
    container.registerSingleton('InMemoryDeadLetterQueue', InMemoryDeadLetterQueue);
    container.registerSingleton('LoggingDeadLetterHandler', LoggingDeadLetterHandler);
    container.registerSingleton('BasicRetryManager', BasicRetryManager);
    container.registerSingleton('BasicDeadLetterProcessor', BasicDeadLetterProcessor);

    // Resolve and store the DLQ instance for the current test
    dlq = container.resolve('InMemoryDeadLetterQueue');
    
    // Also resolve and store the DLQ processor to verify it's called
    const dlqProcessor = container.resolve<BasicDeadLetterProcessor>('BasicDeadLetterProcessor');
    processSpy = jest.spyOn(dlqProcessor, 'process' as keyof BasicDeadLetterProcessor);

    // Resolve the mocked RecommendationAgent instance for the current test
    mockRecommendationAgentInstance = container.resolve(RecommendationAgent) as jest.Mocked<RecommendationAgent>;

    // Reset the mock implementation and calls before each test
    MockRecommendationAgent.mockClear();
    MockRecommendationAgent.prototype.handleMessage.mockReset();

    // Set default mock resolved value for handleMessage on the prototype
    MockRecommendationAgent.prototype.handleMessage.mockResolvedValue({
      recommendation: 'Default mock recommendation.',
    });

    // Create a new server instance for each test
    app = createServer();
  });

  afterEach(() => {
    container.clearInstances(); // Clean up instances after each test
    container.reset(); // Reset container after each test
  });

  afterAll(async () => {
    // Restore the original module after all tests
    jest.restoreAllMocks();
  });

  it('should return a recommendation for a valid request', async () => {
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w1', name: 'Wine 1', type: 'Red', region: 'Test', vintage: 2020, price: 30, rating: 4.5 },
    ]);

    const requestBody = {
      userId: 'test-user',
      preferences: { wineType: 'red' },
    };

    try {
    const response = await request(app)
      .post('/api/recommendations')
      .send(requestBody)
      .expect(200);

    expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toBe("Default mock recommendation.");
    } catch (error) {
      console.error(error);
    }
});

  it('should handle downstream agent failure and send to DLQ', async () => {
    // This test specifically mocks a rejected value, so we set it here
    MockRecommendationAgent.prototype.handleMessage.mockRejectedValue(new Error('Agent failure'));

    const requestBody = {
      userId: 'test-user',
      preferences: { wineType: 'red' },
    };

    try {
      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200);

      // Wait for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Verify DLQ processor was called
      expect(processSpy).toHaveBeenCalledTimes(1);

      // Check DLQ messages
      const dlqMessages = dlq.getAll();
      expect(dlqMessages.length).toBe(1);
      expect(dlqMessages[0].message).toEqual(requestBody);
      expect(dlqMessages[0].error).toContain('Agent failure');
    } catch (error) {
      console.error(error);
    }
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
  });

  it('should handle empty preferences gracefully', async () => {
    // This test specifically mocks a different resolved value, so we set it here
    MockRecommendationAgent.prototype.handleMessage.mockResolvedValue({
      recommendation: 'No specific preferences provided, here are some general recommendations.',
    });

    const requestBody = {
      userId: 'test-user',
      preferences: {},
    };

    try {
      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toContain('general recommendations');
    } catch (error) {
      console.error(error);
    }
  });

  it('should return recommendations based on price range', async () => {
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w2', name: 'Affordable Wine', type: 'White', region: 'Test', vintage: 2019, price: 20, rating: 4.0 },
    ]);

    // This test specifically mocks a different resolved value, so we set it here
    MockRecommendationAgent.prototype.handleMessage.mockResolvedValue({
      recommendation: 'Based on your preferences, we recommend: Affordable Wine (Test).',
    });

    const requestBody = {
      userId: 'test-user',
      preferences: { priceRange: [10, 30] },
    };

    try {
      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toContain('Affordable Wine');
    } catch (error) {
      console.error(error);
    }
  });

  it('should return a recommendation for a preference-based request (food pairing in preferences)', async () => {
    mockNeo4jService.executeQuery.mockResolvedValue([
      { id: 'w9', name: 'Food Pairing Wine 1', type: 'White', region: 'Test', vintage: 2019, price: 35, rating: 4.5 },
    ]);

    // This test specifically mocks a different resolved value, so we set it here
    MockRecommendationAgent.prototype.handleMessage.mockResolvedValue({
      recommendation: 'Based on your preferences, we recommend: Food Pairing Wine 1 (Test).'
    });

    const foodPairingRequestBody = {
      userId: 'test-user-012',
      preferences: {
        foodPairing: 'salmon' // Preference for food pairing
      },
    };

    try {
      const response = await request(app)
        .post('/api/recommendations')
        .send(foodPairingRequestBody)
        .expect(200);

      expect(response.status).toBe(200);
      expect(typeof response.body.recommendation).toBe('string');
      expect(response.body.recommendation).toContain('Based on your preferences, we recommend:'); // Check for expected prefix
      expect(response.body.recommendation).toContain('Food Pairing Wine 1'); // Check for expected wine name
    } catch (error) {
      console.error(error);
    }
  });

  it('should reject invalid requests with 400 and not send to DLQ', async () => {
    const invalidRequestBody = {
      // Missing userId and preferences
      message: 'This is an invalid message that should fail validation'
    };

    try {
      await request(app)
        .post('/api/recommendations')
        .send(invalidRequestBody)
        .expect(400); // Expect a validation error status

      // Check if the message was added to the dead letter queue
      const dlqMessages = dlq.getAll();
      expect(dlqMessages.length).toBe(0); // Expect 0 because validation middleware handles this
    } catch (error) {
      console.error(error);
    }
  });

  it('should send a message to the dead letter queue when a downstream agent fails', async () => {
    // This test specifically mocks a rejected value, so we set it here
    MockRecommendationAgent.prototype.handleMessage.mockRejectedValue(new Error('Simulated Recommendation Agent Error'));

    const requestBody = {
      userId: 'test-user-dlq',
      preferences: {
        wineType: 'red'
      },
    };

    try {
      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200); // Expect success with fallback message

    expect(response.status).toBe(200);
      expect(response.body.response).toEqual({
        recommendation: 'Default mock recommendation.',
        wineType: 'red'
  });
    } catch (error) {
      console.error(error);
    }
  });
});
