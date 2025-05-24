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
import { ValueAnalysisAgent } from '../../core/agents/ValueAnalysisAgent'; // Import original class
import { UserPreferenceAgent } from '../../core/agents/UserPreferenceAgent'; // Import original class
import { ExplanationAgent } from '../../core/agents/ExplanationAgent'; // Import original class
import { MCPAdapterAgent } from '../../core/agents/MCPAdapterAgent'; // Import original class
import { FallbackAgent } from '../../core/agents/FallbackAgent'; // Import original class
import { AgentCommunicationBus } from '../../core/AgentCommunicationBus'; // Import original class

jest.mock('../../services/Neo4jService');
jest.mock('../../core/agents/RecommendationAgent');
jest.mock('../../core/BasicDeadLetterProcessor'); // Mock BasicDeadLetterProcessor
jest.mock('../../core/agents/ValueAnalysisAgent');
jest.mock('../../core/agents/UserPreferenceAgent');
jest.mock('../../core/agents/ExplanationAgent');
jest.mock('../../core/agents/MCPAdapterAgent');
jest.mock('../../core/agents/FallbackAgent');
jest.mock('../../core/AgentCommunicationBus');

// Import the mocked modules
const MockNeo4jService = require('../../services/Neo4jService').Neo4jService;
const MockRecommendationAgent = require('../../core/agents/RecommendationAgent').RecommendationAgent;
const MockBasicDeadLetterProcessor = require('../../core/BasicDeadLetterProcessor').BasicDeadLetterProcessor; // Import mocked processor
const MockValueAnalysisAgent = require('../../core/agents/ValueAnalysisAgent').ValueAnalysisAgent;
const MockUserPreferenceAgent = require('../../core/agents/UserPreferenceAgent').UserPreferenceAgent;
const MockExplanationAgent = require('../../core/agents/ExplanationAgent').ExplanationAgent;
const MockMCPAdapterAgent = require('../../core/agents/MCPAdapterAgent').MCPAdapterAgent;
const MockFallbackAgent = require('../../core/agents/FallbackAgent').FallbackAgent;
const MockAgentCommunicationBus = require('../../core/AgentCommunicationBus').AgentCommunicationBus;

describe('Recommendations Integration', () => {
  let app: any;
  let mockNeo4jServiceInstance: jest.Mocked<Neo4jService>;
  let dlq: InMemoryDeadLetterQueue;
  let mockRecommendationAgentInstance: jest.Mocked<RecommendationAgent>;
  let mockDlqProcessorInstance: jest.Mocked<BasicDeadLetterProcessor>; // Mocked processor instance
  let processSpy: jest.SpyInstance; // Spy on process method
  let addToDlqSpy: jest.SpyInstance; // Spy on addToDLQ method
  let mockCoordinator: SommelierCoordinator; // Changed type to SommelierCoordinator

  beforeEach(() => {
    container.clearInstances(); // Clear instances before each test
    container.reset(); // Reset container before each test

    // Create fresh mock instances for each test
    mockNeo4jServiceInstance = new MockNeo4jService() as jest.Mocked<Neo4jService>;
    mockRecommendationAgentInstance = new MockRecommendationAgent() as jest.Mocked<RecommendationAgent>;
    mockDlqProcessorInstance = new MockBasicDeadLetterProcessor() as jest.Mocked<BasicDeadLetterProcessor>; // Create mocked processor instance

    // Create mock instances for the newly mocked agents and communication bus
    const mockValueAnalysisAgentInstance = new MockValueAnalysisAgent();
    const mockUserPreferenceAgentInstance = new MockUserPreferenceAgent();
    const mockExplanationAgentInstance = new MockExplanationAgent();
    const mockMCPAdapterAgentInstance = new MockMCPAdapterAgent();
    const mockFallbackAgentInstance = new MockFallbackAgent();
    const mockAgentCommunicationBusInstance = new MockAgentCommunicationBus();

    // Ensure Neo4j connection is verified (mocked)
    mockNeo4jServiceInstance.verifyConnection.mockResolvedValue(true);

    // Register dependencies with the mocked instances
    container.register(Neo4jService, { useValue: mockNeo4jServiceInstance });
    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService });
    container.register(InputValidationAgent, { useClass: InputValidationAgent }); // InputValidationAgent is not mocked, assuming it has no external dependencies or its dependencies are mocked
    container.register('DeadLetterProcessor', { useValue: mockDlqProcessorInstance }); // Register mocked processor with token
    container.register(RecommendationAgent, { useValue: mockRecommendationAgentInstance }); // Use the mocked instance

    // Register the newly mocked agents and communication bus
    const MockLLMRecommendationAgent = require('../../core/agents/LLMRecommendationAgent').LLMRecommendationAgent as jest.Mock<any>;
    const mockLLMRecommendationAgentInstance = new MockLLMRecommendationAgent() as jest.Mocked<any>; // Create mock instance
    container.register(MockLLMRecommendationAgent, { useValue: mockLLMRecommendationAgentInstance }); // Register LLMRecommendationAgent mock

    container.register(ValueAnalysisAgent, { useValue: mockValueAnalysisAgentInstance });
    container.register(UserPreferenceAgent, { useValue: mockUserPreferenceAgentInstance });
    container.register(ExplanationAgent, { useValue: mockExplanationAgentInstance });
    container.register(MCPAdapterAgent, { useValue: mockMCPAdapterAgentInstance });
    container.register(FallbackAgent, { useValue: mockFallbackAgentInstance });
    container.register(AgentCommunicationBus, { useValue: mockAgentCommunicationBusInstance });

    container.register(SommelierCoordinator, { useClass: SommelierCoordinator }); // SommelierCoordinator is resolved as a real class

    // Re-register Dead Letter Queue and Retry Manager implementations
    container.registerSingleton('InMemoryDeadLetterQueue', InMemoryDeadLetterQueue);
    container.registerSingleton('LoggingDeadLetterHandler', LoggingDeadLetterHandler);
    container.registerSingleton('BasicRetryManager', BasicRetryManager);

    // Create and register a mock logger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
    container.registerInstance('logger', mockLogger);

    // Resolve and store the DLQ instance for the current test
    dlq = container.resolve('InMemoryDeadLetterQueue');
    // Clear the DLQ before each test
    dlq.clear();

    // Also resolve and store the DLQ processor to verify it's called
    processSpy = jest.spyOn(mockDlqProcessorInstance, 'process'); // Spy on mocked instance
    addToDlqSpy = jest.spyOn(mockDlqProcessorInstance, 'addToDLQ'); // Spy on mocked instance

    // Resolve the Coordinator instance for the current test (it will use the mocked agents)
    // Spy on the handleMessage method of the SommelierCoordinator prototype
    jest.spyOn(SommelierCoordinator.prototype, 'handleMessage');

    // Resolve the Coordinator instance for the current test (it will use the mocked agents)
    mockCoordinator = container.resolve(SommelierCoordinator);

    // Create a new server instance for each test
    app = createServer();
  });

  afterEach(() => {
    container.clearInstances(); // Clean up instances after each test
    container.reset(); // Reset container after each test
    jest.clearAllMocks(); // Clear mocks after each test
  });

  const checkDLQTimeout = async () => {
      // TODO: This function is currently unused. Consider using it in tests that
      // are expected to add messages to the Dead Letter Queue.
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
      input: { preferences: { wineType: 'red' } }, // Wrap preferences in input
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
    const invalidRequestBody = { userId: '', preferences: null };

    const response = await request(app)
      .post('/api/recommendations')
      .send(invalidRequestBody)
      .expect(400);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Validation failed');
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
      input: { preferences: {} } // Wrap preferences in input
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
      input: { preferences: { priceRange: [10, 30] } }, // Wrap preferences in input
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
      input: { // Wrap preferences in input
        preferences: {
          foodPairing: 'salmon' // Preference for food pairing
        },
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

  describe('Conversation History Handling', () => {
    it('should process a request with conversation history', async () => {
      // Mock the RecommendationAgent's handleMessage for this specific test
      mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
        recommendation: "Recommendation based on history."
      });

      const userId = 'history-user-1';
      const initialRequest = {
        userId: userId,
        input: { preferences: { wineType: 'red' } },
        conversationHistory: []
      };

      // First request
      await request(app)
        .post('/api/recommendations')
        .send(initialRequest)
        .expect(200);

      // Assuming the SommelierCoordinator adds the turn to history,
      // the next request for the same user should include it.
      // We need to manually construct the history for the second request
      // as the frontend would.
      const historyAfterFirstTurn = [
        { role: 'user', content: JSON.stringify(initialRequest.input) }, // Simplified representation
        { role: 'assistant', content: JSON.stringify({ recommendation: "Recommendation based on history." }) } // Simplified representation
      ];

      const subsequentRequest = {
        userId: userId,
        input: { preferences: { foodPairing: 'pasta' } },
        conversationHistory: historyAfterFirstTurn
      };

      // Mock the RecommendationAgent's handleMessage for the second request
      mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
        recommendation: "Recommendation based on history and pasta."
      });

      // Second request with history
      const response = await request(app)
        .post('/api/recommendations')
        .send(subsequentRequest)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toBe("Recommendation based on history and pasta.");

      // Verify that SommelierCoordinator's handleMessage was called with the correct history
      // Note: This checks what the API passes to the coordinator, not necessarily
      // what the coordinator does with the history internally.
      expect(mockCoordinator.handleMessage).toHaveBeenCalledWith(subsequentRequest);
    });

    it('should process a request with an empty conversation history array', async () => {
      // Mock the RecommendationAgent's handleMessage for this specific test
      mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
        recommendation: "Recommendation based on empty history."
      });

      const userId = 'history-user-empty';
      const requestBody = {
        userId: userId,
        input: { preferences: { wineType: 'white' } },
        conversationHistory: [] // Empty history array
      };

      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toBe("Recommendation based on empty history.");

      // Verify that SommelierCoordinator's handleMessage was called with the empty history
      expect(mockCoordinator.handleMessage).toHaveBeenCalledWith(requestBody);
    });

    it('should process a request with multiple turns in conversation history', async () => {
      // Mock the RecommendationAgent's handleMessage for this specific test
      mockRecommendationAgentInstance.handleMessage.mockResolvedValue({
        recommendation: "Recommendation based on multiple history turns."
      });

      const userId = 'history-user-multi';
      const conversationHistory = [
        { role: 'user', content: 'First message.' },
        { role: 'assistant', content: 'First response.' },
        { role: 'user', content: 'Second message.' },
        { role: 'assistant', content: 'Second response.' },
      ];
      const requestBody = {
        userId: userId,
        input: { preferences: { foodPairing: 'beef' } },
        conversationHistory: conversationHistory // Multiple turns in history
      };

      const response = await request(app)
        .post('/api/recommendations')
        .send(requestBody)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body.recommendation).toBe("Recommendation based on multiple history turns.");

      // Verify that SommelierCoordinator's handleMessage was called with the multiple turns history
      expect(mockCoordinator.handleMessage).toHaveBeenCalledWith(requestBody);
    });
  });
});
