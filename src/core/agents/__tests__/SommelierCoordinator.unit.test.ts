import 'reflect-metadata';
import { container } from 'tsyringe';
import { SommelierCoordinator } from '../SommelierCoordinator';
import { InputValidationAgent } from '../InputValidationAgent';
import { RecommendationAgent } from '../RecommendationAgent';
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { ExplanationAgent } from '../ExplanationAgent';
import { MCPAdapterAgent } from '../MCPAdapterAgent';
import { FallbackAgent } from '../FallbackAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService'; // Import KnowledgeGraphService
import { AgentCommunicationBus } from '../../AgentCommunicationBus'; // Import AgentCommunicationBus

// Mock the dependencies of SommelierCoordinator
jest.mock('../InputValidationAgent');
jest.mock('../RecommendationAgent');
jest.mock('../ValueAnalysisAgent');
jest.mock('../UserPreferenceAgent');
jest.mock('../ExplanationAgent');
jest.mock('../MCPAdapterAgent');
jest.mock('../FallbackAgent');
jest.mock('../../BasicDeadLetterProcessor');
jest.mock('@src/services/KnowledgeGraphService'); // Mock KnowledgeGraphService
// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockInputValidationAgent = InputValidationAgent as jest.Mock<InputValidationAgent>;
const MockRecommendationAgent = RecommendationAgent as jest.Mock<RecommendationAgent>;
const MockValueAnalysisAgent = ValueAnalysisAgent as jest.Mock<ValueAnalysisAgent>;
const MockUserPreferenceAgent = UserPreferenceAgent as jest.Mock<UserPreferenceAgent>;
const MockExplanationAgent = ExplanationAgent as jest.Mock<ExplanationAgent>;
const MockMCPAdapterAgent = MCPAdapterAgent as jest.Mock<MCPAdapterAgent>;
const MockFallbackAgent = FallbackAgent as jest.Mock<FallbackAgent>;
const MockBasicDeadLetterProcessor = BasicDeadLetterProcessor as jest.Mock<BasicDeadLetterProcessor>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.Mock<KnowledgeGraphService>; // Mock KnowledgeGraphService
const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>; // Mocked class type

describe('SommelierCoordinator Unit Tests', () => {
  let sommelierCoordinator: SommelierCoordinator;
  let mockInputValidationAgent: jest.Mocked<InputValidationAgent>;
  let mockRecommendationAgent: jest.Mocked<RecommendationAgent>;
  let mockValueAnalysisAgent: jest.Mocked<ValueAnalysisAgent>;
  let mockUserPreferenceAgent: jest.Mocked<UserPreferenceAgent>;
  let mockExplanationAgent: jest.Mocked<ExplanationAgent>;
  let mockMCPAdapterAgent: jest.Mocked<MCPAdapterAgent>;
  let mockFallbackAgent: jest.Mocked<FallbackAgent>;
  let mockDeadLetterProcessor: jest.Mocked<BasicDeadLetterProcessor>;
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>; // Mock KnowledgeGraphService
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>; // Mock instance type

  beforeEach(() => {
    // Clear and reset container for isolated testing
    container.clearInstances();
    container.reset();

    // Clear all instances and calls to constructor and all methods for the mock bus:
    MockAgentCommunicationBus.mockClear();

    // Instantiate mocks (ensure return types match the agents' updated signatures)
    mockInputValidationAgent = { handleMessage: jest.fn().mockResolvedValue({ isValid: true, processedInput: { ingredients: [], preferences: {} } }), getName: () => 'MockInputValidationAgent' } as any;
    mockRecommendationAgent = { handleMessage: jest.fn().mockResolvedValue({ recommendedWines: [] }), getName: () => 'MockRecommendationAgent', knowledgeGraphService: {} } as any; // Mock required property
    mockValueAnalysisAgent = { handleMessage: jest.fn().mockResolvedValue({ analysis: 'basic analysis' }), getName: () => 'MockValueAnalysisAgent' } as any;
    mockUserPreferenceAgent = { handleMessage: jest.fn().mockResolvedValue({ preferences: {} }), getName: () => 'MockUserPreferenceAgent' } as any;
    mockExplanationAgent = { handleMessage: jest.fn().mockResolvedValue({ explanation: 'basic explanation' }), getName: () => 'MockExplanationAgent' } as any;
    mockMCPAdapterAgent = { handleMessage: jest.fn(), getName: () => 'MockMCPAdapterAgent' } as any;
    mockFallbackAgent = { handleMessage: jest.fn().mockResolvedValue({ recommendation: 'fallback recommendation' }), getName: () => 'MockFallbackAgent' } as any;
    mockDeadLetterProcessor = { process: jest.fn() } as any;
    mockKnowledgeGraphService = { findWinesByIngredients: jest.fn(), findWinesByPreferences: jest.fn() } as any; // Instantiate mock

    // Create a mock instance of the communication bus using jest.mock
    mockCommunicationBusInstance = new MockAgentCommunicationBus() as jest.Mocked<AgentCommunicationBus>;

    // Register mocks in the container
    container.registerInstance(InputValidationAgent, mockInputValidationAgent);
    container.registerInstance(RecommendationAgent, mockRecommendationAgent);
    container.registerInstance(ValueAnalysisAgent, mockValueAnalysisAgent);
    container.registerInstance(UserPreferenceAgent, mockUserPreferenceAgent);
    container.registerInstance(ExplanationAgent, mockExplanationAgent);
    container.registerInstance(MCPAdapterAgent, mockMCPAdapterAgent);
    container.registerInstance(FallbackAgent, mockFallbackAgent);
    container.registerInstance(BasicDeadLetterProcessor, mockDeadLetterProcessor);
    container.registerInstance(KnowledgeGraphService, mockKnowledgeGraphService); // Register mock
    container.registerInstance(AgentCommunicationBus, mockCommunicationBusInstance);

    // Create and register a mock logger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
    container.registerInstance('logger', mockLogger);

    // Resolve the SommelierCoordinator
    sommelierCoordinator = container.resolve(SommelierCoordinator);

    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  it('should process a preference-based message and call RecommendationAgent with preferences', async () => {
    const message = { userId: 'test-user', preferences: { wineType: "red", priceRange: [20, 50] } };
    const mockRecommendationResult = { recommendedWines: [{ id: 'wine-1', name: 'Test Red', type: 'red', price: 30, region: 'Test Region', rating: 4 }] }; // Updated mock result structure

    // Mock the RecommendationAgent's handleMessage to return a specific result
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    // Call the SommelierCoordinator's handleMessage
    const result = await sommelierCoordinator.handleMessage(message as any);

    // Verify that the RecommendationAgent's handleMessage was called with the correct input (only preferences)
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ preferences: message.preferences });

    // Verify that the SommelierCoordinator returned the result from the RecommendationAgent
    expect(result).toEqual(mockRecommendationResult);

    // Verify that other agents were called (basic check)
    expect(mockInputValidationAgent.handleMessage).not.toHaveBeenCalled(); // InputValidationAgent is skipped if message.message is undefined
    expect(mockValueAnalysisAgent.handleMessage).toHaveBeenCalledWith({ preferences: message.preferences });
    expect(mockUserPreferenceAgent.handleMessage).toHaveBeenCalledWith({ preferences: message.preferences });
    expect(mockMCPAdapterAgent.handleMessage).toHaveBeenCalledWith({ preferences: message.preferences });
    expect(mockExplanationAgent.handleMessage).toHaveBeenCalledWith(mockRecommendationResult); // ExplanationAgent is called with the result from RecommendationAgent

    // Verify that the dead letter processor was NOT called on success
    expect(mockDeadLetterProcessor.process).not.toHaveBeenCalled();
  });

  it('should send a message to the dead letter queue when InputValidationAgent fails', async () => {
    const invalidMessage = { message: 'invalid input' };
    const validationError = new Error('Validation failed');
    // Mock InputValidationAgent to return an object matching its new signature
    mockInputValidationAgent.handleMessage.mockResolvedValue({ isValid: false, error: validationError.message });
    // Mock FallbackAgent to return an object matching its new signature
    mockFallbackAgent.handleMessage.mockResolvedValue({ recommendation: 'Fallback response' });

    await sommelierCoordinator.handleMessage(invalidMessage as any);

    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      invalidMessage,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'InputValidation' }
    );
    // The FallbackAgent is now called with an object containing error and preferences
    expect(mockFallbackAgent.handleMessage).toHaveBeenCalledWith({ error: validationError.message, preferences: { wineType: 'Unknown' } });
  });

  it('should send a message to the dead letter queue when RecommendationAgent fails', async () => {
    const validMessage = { userId: 'test-user', preferences: { wineType: 'red' } };
    const recommendationError = new Error('Recommendation failed');
    // Mock InputValidationAgent to return an object matching its new signature
    mockInputValidationAgent.handleMessage.mockResolvedValue({ isValid: true, processedInput: { ingredients: [] } }); // Mock successful validation
    mockRecommendationAgent.handleMessage.mockRejectedValue(recommendationError);
    // Mock FallbackAgent is not called in this scenario anymore, but mocking its return type for safety
    mockFallbackAgent.handleMessage.mockResolvedValue({ recommendation: 'Fallback response' });

    // Expect the SommelierCoordinator.handleMessage to throw an error
    await expect(sommelierCoordinator.handleMessage(validMessage as any)).rejects.toThrow(recommendationError.message);

    // Verify that the RecommendationAgent was called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ preferences: { wineType: 'red' } });

    // Verify that the dead letter processor was called
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      validMessage,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'RecommendationAgent' }
    );

    // The FallbackAgent should NOT be called in this scenario anymore
    expect(mockFallbackAgent.handleMessage).not.toHaveBeenCalled();
  });

  // Add more unit test cases for SommelierCoordinator here...
});