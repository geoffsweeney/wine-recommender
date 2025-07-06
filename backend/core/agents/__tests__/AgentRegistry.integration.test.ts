import { mock } from 'jest-mock-extended';
import winston from 'winston';
import { TYPES } from '../../../di/Types'; // Import TYPES
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { LLMService } from '../../../services/LLMService';
import { Neo4jCircuitWrapper } from '../../../services/Neo4jCircuitWrapper';
import { Neo4jService } from '../../../services/Neo4jService';
import { PreferenceExtractionService } from '../../../services/PreferenceExtractionService';
import { PreferenceNormalizationService } from '../../../services/PreferenceNormalizationService';
import { PromptManager } from '../../../services/PromptManager';
import { RecommendationService } from '../../../services/RecommendationService';
import { UserProfileService } from '../../../services/UserProfileService'; // Import UserProfileService
import { testContainer } from '../../../test-setup'; // Import the testContainer
import { CircuitBreaker } from '../../CircuitBreaker';
import { ConversationHistoryService } from '../../ConversationHistoryService'; // Import ConversationHistoryService
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { AgentRegistry } from '../AgentRegistry';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus'; // Import EnhancedAgentCommunicationBus
import { ExplanationAgent } from '../ExplanationAgent';
import { FallbackAgent } from '../FallbackAgent';
import { InputValidationAgent } from '../InputValidationAgent';
import { LLMRecommendationAgent } from '../LLMRecommendationAgent';
import { MCPAdapterAgent } from '../MCPAdapterAgent';
import { RecommendationAgent } from '../RecommendationAgent';
import { ShopperAgent } from '../ShopperAgent'; // Import ShopperAgent and its config
import { SommelierCoordinator } from '../SommelierCoordinator';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';


beforeEach(() => {
  // Clear and reset the container for each test
  testContainer.clearInstances();
  testContainer.reset();

  // Mock basic dependencies
  const mockLogger = mock<winston.Logger>();
  const mockDeadLetterProcessor = mock<BasicDeadLetterProcessor>();
  const mockBus = mock<EnhancedAgentCommunicationBus>();

  // Register basic dependencies
  testContainer.registerInstance(TYPES.Logger, mockLogger);
  testContainer.registerInstance(TYPES.DeadLetterProcessor, mockDeadLetterProcessor);
  testContainer.registerInstance(TYPES.AgentCommunicationBus, mockBus); // Register the mock bus

  // Mock LLMService and its dependencies
  const mockPromptManager = mock<PromptManager>();
  const mockLlmApiUrl = 'http://mock-llm-api.com';
  const mockLlmModel = 'mock-model';
  const mockLlmApiKey = 'mock-api-key';
  const mockLLMService = mock<LLMService>();

  testContainer.registerInstance(TYPES.PromptManager, mockPromptManager);
  testContainer.registerInstance(TYPES.LlmApiUrl, mockLlmApiUrl);
  testContainer.registerInstance(TYPES.LlmModel, mockLlmModel);
  testContainer.registerInstance(TYPES.LlmApiKey, mockLlmApiKey);
  testContainer.registerInstance(TYPES.LLMService, mockLLMService);

  // Mock Neo4j and related services
  const mockNeo4jUri = 'bolt://localhost:7687'; // Mock Neo4j URI
  const mockNeo4jUser = 'neo4j'; // Mock Neo4j User
  const mockNeo4jPassword = 'password'; // Mock Neo4j Password
  const mockNeo4jService = mock<Neo4jService>();
  const mockCircuitBreaker = mock<CircuitBreaker>();
  const mockNeo4jCircuitWrapper = mock<Neo4jCircuitWrapper>();
  testContainer.registerInstance(TYPES.Neo4jUri, mockNeo4jUri); // Register mock Neo4j URI
  testContainer.registerInstance(TYPES.Neo4jUser, mockNeo4jUser); // Register mock Neo4j User
  testContainer.registerInstance(TYPES.Neo4jPassword, mockNeo4jPassword); // Register mock Neo4j Password
  testContainer.registerInstance(TYPES.Neo4jService, mockNeo4jService);
  testContainer.registerInstance(TYPES.CircuitBreaker, mockCircuitBreaker);
  testContainer.registerInstance(TYPES.Neo4jCircuitWrapper, mockNeo4jCircuitWrapper);

  // Mock other services
  const mockKnowledgeGraphService = mock<KnowledgeGraphService>();
  const mockPreferenceExtractionService = mock<PreferenceExtractionService>();
  const mockPreferenceNormalizationService = mock<PreferenceNormalizationService>();
  const mockRecommendationService = mock<RecommendationService>();
  testContainer.registerInstance(TYPES.KnowledgeGraphService, mockKnowledgeGraphService);
  testContainer.registerInstance(TYPES.PreferenceExtractionService, mockPreferenceExtractionService);
  testContainer.registerInstance(TYPES.PreferenceNormalizationService, mockPreferenceNormalizationService);
  testContainer.registerInstance(TYPES.RecommendationService, mockRecommendationService);

  // Register agent configs
  testContainer.registerInstance(TYPES.InputValidationAgentConfig, {
    ingredientDatabasePath: 'test',
    dietaryRestrictions: [],
    standardIngredients: {},
    maxIngredients: 5
  });
  testContainer.registerInstance(TYPES.ShopperAgentConfig, {
    shoppingCartServiceUrl: 'http://mock-shopping-cart.com'
  });
  testContainer.registerInstance(TYPES.UserPreferenceAgentConfig, {
    defaultConfidenceThreshold: 0.7
  });
  testContainer.registerInstance(TYPES.RecommendationAgentConfig, {
    maxRecommendations: 3
  });
  testContainer.registerInstance(TYPES.ExplanationAgentConfig, {
    explanationServiceUrl: 'http://mock-explanation.com'
  });
  testContainer.registerInstance(TYPES.FallbackAgentConfig, {
    fallbackMessage: 'I apologize, but I cannot fulfill this request at the moment.'
  });
  testContainer.registerInstance(TYPES.LLMRecommendationAgentConfig, {
    recommendationPrompt: 'mock prompt'
  });
  testContainer.registerInstance(TYPES.ValueAnalysisAgentConfig, {
    valueAnalysisServiceUrl: 'http://mock-value-analysis.com'
  });
  testContainer.registerInstance(TYPES.MCPAdapterAgentConfig, {
    mcpServerUrl: 'http://mock-mcp-server.com'
  });
  testContainer.registerInstance(TYPES.SommelierCoordinatorId, 'sommelier-coordinator-id'); // Register mock SommelierCoordinatorId
  testContainer.registerInstance(TYPES.SommelierCoordinatorDependencies, { // Register mock SommelierCoordinatorDependencies
    communicationBus: mockBus,
    deadLetterProcessor: mockDeadLetterProcessor,
    logger: mockLogger,
    userProfileService: mock<UserProfileService>(), // Mock UserProfileService
    conversationHistoryService: mock<ConversationHistoryService>(), // Mock ConversationHistoryService
    messageQueue: {} as any, // Placeholder
    stateManager: {} as any, // Placeholder
    config: {} as any // Placeholder
  });
  testContainer.registerInstance(TYPES.SommelierCoordinatorConfig, {
    maxRetries: 3,
    retryDelayMs: 100
  });

  // Register agent classes with the testContainer
  testContainer.register('InputValidationAgent', { useClass: InputValidationAgent });
  testContainer.register('LLMRecommendationAgent', { useClass: LLMRecommendationAgent });
  testContainer.register('MCPAdapterAgent', { useClass: MCPAdapterAgent });
  testContainer.register('ValueAnalysisAgent', { useClass: ValueAnalysisAgent });
  testContainer.register('ShopperAgent', { useClass: ShopperAgent }); // Register ShopperAgent
  testContainer.register('UserPreferenceAgent', { useClass: UserPreferenceAgent });
  testContainer.register('RecommendationAgent', { useClass: RecommendationAgent });
  testContainer.register('ExplanationAgent', { useClass: ExplanationAgent });
  testContainer.register('FallbackAgent', { useClass: FallbackAgent });
  testContainer.register('SommelierCoordinator', { useClass: SommelierCoordinator });
});

describe('AgentRegistry Integration', () => {
  let registry: AgentRegistry;
  let mockBus: jest.Mocked<EnhancedAgentCommunicationBus>;

  beforeEach(() => {
    mockBus = mock<EnhancedAgentCommunicationBus>(); // Use jest-mock-extended to create a comprehensive mock

    // Log the mockLogger to ensure it's not undefined
    const loggerInstance = testContainer.resolve(TYPES.Logger);
    console.log('Logger instance in beforeEach:', loggerInstance);

    // Try to resolve ExplanationAgent directly to see if it throws an error
    try {
      const explanationAgentInstance = testContainer.resolve(ExplanationAgent);
      console.log('ExplanationAgent resolved successfully:', explanationAgentInstance);
    } catch (e) {
      console.error('Error resolving ExplanationAgent directly:', e);
    }

    registry = testContainer.resolve(AgentRegistry);
  });

  it('should register all agents with their capabilities', () => {
    registry.registerAgents(mockBus);

    expect(mockBus.registerAgent).toHaveBeenCalledTimes(10); // Corrected to 10
    
    // Verify capability registration for key agents
    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'InputValidationAgent',
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'input-validation',
          'llm-integration'
        ])
      })
    );

    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'llm-recommendation-agent', // Corrected agent name
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'llm-recommendation',
          'conversational-recommendation'
        ])
      })
    );

    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'MCPAdapterAgent',
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'mcp-tool-integration',
          'external-service-adapter'
        ])
      })
    );
  });

  it('should retrieve agents by name with correct capabilities', () => {
    const agent = registry.getAgent<InputValidationAgent>('InputValidationAgent');
    expect(agent.getCapabilities()).toEqual(
      expect.arrayContaining(['input-validation', 'llm-integration'])
    );
  });
});
