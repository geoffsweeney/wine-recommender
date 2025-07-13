import { mock } from 'jest-mock-extended';
import "reflect-metadata";
import { container, DependencyContainer } from 'tsyringe';
import { ConversationHistoryService } from './core/ConversationHistoryService';
import { AgentError } from './core/agents/AgentError';
import { SommelierCoordinator } from './core/agents/SommelierCoordinator'; // Added
import { AgentMessage, createAgentMessage, MessageTypes } from './core/agents/communication/AgentMessage'; // Added AgentMessage import
import { EnhancedAgentCommunicationBus } from './core/agents/communication/EnhancedAgentCommunicationBus';
import { Result } from './core/types/Result';
import { TYPES } from './di/Types';
import { MCPClient } from './mcp/mcpClient';
import { KnowledgeGraphService } from './services/KnowledgeGraphService';
import { LLMService } from './services/LLMService';
import { Neo4jService } from './services/Neo4jService';
import { PreferenceExtractionService } from './services/PreferenceExtractionService';
import { PreferenceNormalizationService } from './services/PreferenceNormalizationService';
import { PromptManager } from './services/PromptManager'; // Import PromptManager
import { UserProfileService } from './services/UserProfileService';

jest.unmock('zod'); // Unmock zod globally for tests
jest.unmock('zod-to-json-schema'); // Unmock zod-to-json-schema globally for tests

// Define a test container factory function for proper test isolation
export const createTestContainer = (): { container: DependencyContainer; resetMocks: () => void } => {
  container.clearInstances();
  container.reset();

  // Configuration registry with DI pattern
  // Configuration values for LLMService
  container.registerInstance(TYPES.LlmApiUrl, 'http://mock-llm-api.com');
  container.registerInstance(TYPES.LlmModel, 'mock-model');
  container.registerInstance(TYPES.LlmApiKey, 'mock-api-key');
  container.registerInstance(TYPES.LlmMaxRetries, 3);
  container.registerInstance(TYPES.LlmRetryDelayMs, 1000);
  container.registerInstance(TYPES.DucklingUrl, 'http://mock-duckling-url.com');

  // General Config (if still needed for other parts)
  const config = {
    llmApiUrl: 'http://mock-llm-api.com', // Keep for consistency if other parts use TYPES.Config
    llmModel: 'mock-model',
    llmApiKey: 'mock-api-key',
    ducklingUrl: 'http://mock-duckling-url.com'
  };
  container.registerInstance(TYPES.Config, config);

  // Enhanced structured logger mock with context support
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockImplementation(() => mockLogger)
  };
  container.registerInstance(TYPES.Logger, mockLogger);

  // Performance tracking hooks
  const performanceHooks = {
    start: jest.fn(),
    end: jest.fn(),
    metrics: {}
  };
  container.registerInstance(TYPES.PerformanceTracker, performanceHooks);

  // Mock RecommendationAgentConfig
  const recommendationAgentConfig = {
    defaultRecommendationCount: 5
  };
  container.registerInstance(TYPES.RecommendationAgentConfig, recommendationAgentConfig);

  // Mock LLM service
  const mockLlmService = mock<LLMService>();
  mockLlmService.sendPrompt.mockResolvedValue({ success: true, data: 'mock-llm-response' });
  container.registerInstance(TYPES.LLMService, mockLlmService);

  // Register PromptManager
  const mockPromptManager = mock<PromptManager>();
  container.registerInstance(TYPES.PromptManager, mockPromptManager);

  // Mock LLMRecommendationAgentConfig
  const llmRecommendationAgentConfig = {
    defaultConfidenceScore: 0.8
  };
  container.registerInstance(TYPES.LLMRecommendationAgentConfig, llmRecommendationAgentConfig);

  // Mock InputValidationAgentConfig
  const inputValidationAgentConfig = {
    ingredientDatabasePath: 'mock/path/to/ingredients.json',
    dietaryRestrictions: ['vegan', 'gluten-free'],
    standardIngredients: { 'tomato': 'fruit' },
    maxIngredients: 10
  };
  container.registerInstance(TYPES.InputValidationAgentConfig, inputValidationAgentConfig);

  // Mock Agent Communication Bus
  const mockAgentCommunicationBus = mock<EnhancedAgentCommunicationBus>();

  // Use Object.defineProperty to mock the private messageHandlers property
  Object.defineProperty(mockAgentCommunicationBus, 'messageHandlers', {
    value: new Map<string, Map<string, (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>>>(),
    writable: true,
    configurable: true,
  });

  // Mock the registerMessageHandler to actually store handlers in our mock map
  mockAgentCommunicationBus.registerMessageHandler.mockImplementation(
    (agentId: string, messageType: string, handler: (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>) => {
      // Access the mocked private property via the mock object
      const messageHandlers = (mockAgentCommunicationBus as any).messageHandlers;
      if (!messageHandlers.has(agentId)) {
        messageHandlers.set(agentId, new Map());
      }
      messageHandlers.get(agentId)!.set(messageType, handler);
    }
  );

  // Mock sendMessageAndWaitForResponse to avoid recursive routing
  mockAgentCommunicationBus.sendMessageAndWaitForResponse.mockImplementation(
    async <T>(targetAgentId: string, message: AgentMessage, timeoutMs: number = 10000): Promise<Result<AgentMessage<T> | null, AgentError>> => {
      return new Promise((resolve) => {
        if (targetAgentId === 'sommelier-coordinator' && message.type === MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST) {
          resolve({
            success: true,
            data: createAgentMessage(
              MessageTypes.FINAL_RECOMMENDATION,
              {
                primaryRecommendation: {
                  id: 'w1',
                  name: 'Wine 1',
                  type: 'Red',
                  region: 'Bordeaux',
                  year: 2018,
                  price: 45.99,
                  rating: 4.5,
                  description: 'Full-bodied with notes of black cherry'
                },
                alternatives: [],
                explanation: 'Mock explanation',
                confidence: 0.9,
                conversationId: message.conversationId,
                canRefine: false,
              },
              'sommelier-coordinator',
              message.conversationId,
              message.correlationId,
              message.sourceAgent
            ) as AgentMessage<T>
          });
        } else {
          resolve({ success: false, error: new AgentError('Unexpected message', 'UNEXPECTED_MESSAGE', 'test-setup', message.correlationId) });
        }
      });
    }
  );

  // Mock publishToAgent to simulate message routing
  mockAgentCommunicationBus.publishToAgent.mockImplementation(
    async (targetAgentId: string, message: AgentMessage) => {
      const messageHandlers = (mockAgentCommunicationBus as any).messageHandlers;
      const agentHandlers = messageHandlers.get(targetAgentId);
      if (agentHandlers) {
        const handler = agentHandlers.get(message.type);
        if (handler) {
          await handler(message);
        }
      }
    }
  );

  container.registerInstance(TYPES.AgentCommunicationBus, mockAgentCommunicationBus);

  // Mock ValueAnalysisAgentConfig
  const valueAnalysisAgentConfig = {
    defaultTimeoutMs: 5000
  };
  container.registerInstance(TYPES.ValueAnalysisAgentConfig, valueAnalysisAgentConfig);

  // Mock Neo4j Circuit Wrapper
  const mockNeo4jCircuitWrapper = {
    executeQuery: jest.fn().mockImplementation(async (fn) => {
      const mockSession = {
        run: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const mockDriver = {
        session: jest.fn().mockReturnValue(mockSession)
      };
      return fn(mockDriver);
    }),
    close: jest.fn().mockResolvedValue(undefined),
    beginTransaction: jest.fn().mockResolvedValue({
      run: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    }),
    readTransaction: jest.fn().mockResolvedValue({ records: [] }),
    writeTransaction: jest.fn().mockResolvedValue({ records: [] })
  };
  container.registerInstance(TYPES.Neo4jCircuitWrapper, mockNeo4jCircuitWrapper);

  // Mock Neo4jService
  const mockNeo4jService = mock<Neo4jService>();
  container.registerInstance(TYPES.Neo4jService, mockNeo4jService);

  // Mock Neo4j connection details
  container.registerInstance(TYPES.Neo4jUri, 'bolt://localhost:7687');
  container.registerInstance(TYPES.Neo4jUser, 'neo4j');
  container.registerInstance(TYPES.Neo4jPassword, 'password');

  // Mock Search Strategy
  const mockSearchStrategy = {
    execute: jest.fn().mockResolvedValue([]) // Changed 'search' to 'execute'
  };
  container.registerInstance(TYPES.ISearchStrategy, mockSearchStrategy);

  // Recommendation Strategies
  const mockUserPreferencesStrategy = {
    getRecommendations: jest.fn().mockResolvedValue([])
  };
  const mockCollaborativeFilteringStrategy = {
    getRecommendations: jest.fn().mockResolvedValue([])
  };
  const mockPopularWinesStrategy = {
    getRecommendations: jest.fn().mockResolvedValue([])
  };
  
  container.registerInstance(TYPES.UserPreferencesStrategy, mockUserPreferencesStrategy);
  container.registerInstance(TYPES.CollaborativeFilteringStrategy, mockCollaborativeFilteringStrategy);
  container.registerInstance(TYPES.PopularWinesStrategy, mockPopularWinesStrategy);
  
  container.registerInstance(TYPES.IRecommendationStrategy, {
    execute: jest.fn().mockResolvedValue([
      {
        id: 'w1',
        name: 'Wine 1',
        type: 'Red',
        region: 'Bordeaux',
        year: 2018,
        price: 45.99,
        rating: 4.5,
        description: 'Full-bodied with notes of black cherry'
      }
    ])
  });

  // Register Sommelier Coordinator class
  container.register(TYPES.SommelierCoordinator, { useClass: SommelierCoordinator });

  // Mock Knowledge Graph Service
  const mockKnowledgeGraphService = mock<KnowledgeGraphService>();
  container.registerInstance(TYPES.KnowledgeGraphService, mockKnowledgeGraphService);

  // Mock User Profile Service
  const mockUserProfileService = mock<UserProfileService>();
  mockUserProfileService.getPreferences.mockResolvedValue({}); // Mock getPreferences to return an empty object
  container.registerInstance(TYPES.UserProfileService, mockUserProfileService);

  // Mock Conversation History Service
  const mockConversationHistoryService = mock<ConversationHistoryService>();
  container.registerInstance(TYPES.ConversationHistoryService, mockConversationHistoryService);

  // Mock PreferenceExtractionService
  const mockPreferenceExtractionService = mock<PreferenceExtractionService>();
  container.registerInstance(TYPES.PreferenceExtractionService, mockPreferenceExtractionService);

  // Mock PreferenceNormalizationService
  const mockPreferenceNormalizationService = mock<PreferenceNormalizationService>();
  container.registerInstance(TYPES.PreferenceNormalizationService, mockPreferenceNormalizationService);

  // Mock UserPreferenceAgentConfig
  const userPreferenceAgentConfig = {
    defaultConfidenceThreshold: 0.7
  };
  container.registerInstance(TYPES.UserPreferenceAgentConfig, userPreferenceAgentConfig);

  // Mock Dead Letter Processor
  const mockDeadLetterProcessor = {
    process: jest.fn().mockResolvedValue(undefined)
  };
  container.registerInstance(TYPES.DeadLetterProcessor, mockDeadLetterProcessor);

  // Mock MCPClient
  const mockMcpClient = mock<MCPClient>();
  container.registerInstance(MCPClient, mockMcpClient);

  // Mock MCPAdapterAgentConfig
  const mcpAdapterAgentConfig = {
    defaultToolTimeoutMs: 30000
  };
  container.registerInstance(TYPES.MCPAdapterAgentConfig, mcpAdapterAgentConfig);

  // Mock ExplanationAgentConfig
  const explanationAgentConfig = {
    defaultExplanation: 'This is a default explanation.'
  };
  container.registerInstance(TYPES.ExplanationAgentConfig, explanationAgentConfig);

  // Mock FallbackAgentConfig
  const fallbackAgentConfig = {
    defaultFallbackResponse: 'I apologize, but I am unable to assist with that request at the moment. Please try again later.'
  };
  container.registerInstance(TYPES.FallbackAgentConfig, fallbackAgentConfig);

  // Agent Dependencies
  const mockAgentDependencies = {
    logger: mockLogger,
    messageQueue: {},
    stateManager: {},
    config
  };
  container.registerInstance(TYPES.AgentDependencies, mockAgentDependencies);


  // Mock SommelierCoordinatorConfig
  const sommelierCoordinatorConfig = {
    maxRecommendationAttempts: 3,
    agentTimeoutMs: 5000,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerSuccessThreshold: 3
  };
  container.registerInstance(TYPES.SommelierCoordinatorConfig, sommelierCoordinatorConfig);

  // Mock SommelierCoordinatorDependencies
  const mockSommelierCoordinatorDependencies = {
    communicationBus: mockAgentCommunicationBus, // Changed to real instance
    deadLetterProcessor: mockDeadLetterProcessor,
    userProfileService: mockUserProfileService,
    conversationHistoryService: mockConversationHistoryService,
    logger: mockLogger,
    messageQueue: {},
    stateManager: {},
    config: sommelierCoordinatorConfig
  };
  container.registerInstance(TYPES.SommelierCoordinatorDependencies, mockSommelierCoordinatorDependencies);

  // Reset function for all mocks
  const resetMocks = () => {
    Object.values(mockLogger).forEach(fn => fn.mockReset());
    mockLlmService.sendPrompt.mockReset();
    performanceHooks.start.mockReset();
    performanceHooks.end.mockReset();
  };

  return { container, resetMocks };
};

// Export factory function for test usage
export const { container: testContainer, resetMocks } = createTestContainer();
