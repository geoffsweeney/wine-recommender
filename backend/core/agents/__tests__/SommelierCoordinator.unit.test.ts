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
    // Register LLMRecommendationAgent mock
    const MockLLMRecommendationAgent = require('../LLMRecommendationAgent').LLMRecommendationAgent as jest.Mock<any>;
    const mockLLMRecommendationAgent = { handleMessage: jest.fn().mockResolvedValue({ recommendation: 'LLM recommendation' }), getName: () => 'MockLLMRecommendationAgent' } as any;
    container.registerInstance(MockLLMRecommendationAgent, mockLLMRecommendationAgent);

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
    const message = { userId: 'test-user', input: { preferences: { wineType: "red", priceRange: [20, 50] }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const mockRecommendationResult = { recommendedWines: [{ id: 'wine-1', name: 'Test Red', type: 'red', price: 30, region: 'Test Region', rating: 4 }] }; // Updated mock result structure

    // Mock the RecommendationAgent's handleMessage to return a specific result
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    // Call the SommelierCoordinator's handleMessage
    const result = await sommelierCoordinator.handleMessage(message as any);

    // Verify that the RecommendationAgent's handleMessage was called with the correct input (only preferences)
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });

    // Verify that the SommelierCoordinator returned the result from the RecommendationAgent
    expect(result).toEqual(mockRecommendationResult);

    // Verify that other agents were called (basic check)
    expect(mockInputValidationAgent.handleMessage).not.toHaveBeenCalled(); // InputValidationAgent is skipped if message.message is undefined
    expect(mockValueAnalysisAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    // Expect UserPreferenceAgent to be called with an empty string input and initial preferences
    expect(mockUserPreferenceAgent.handleMessage).toHaveBeenCalledWith({ input: '', conversationHistory: message.conversationHistory, initialPreferences: expect.any(Array) }); // Expect empty string input and initial preferences
    expect(mockMCPAdapterAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    expect(mockExplanationAgent.handleMessage).toHaveBeenCalledWith(mockRecommendationResult); // ExplanationAgent is called with the result from RecommendationAgent

    // Verify that the dead letter processor was NOT called on success
    expect(mockDeadLetterProcessor.process).not.toHaveBeenCalled();
  });

  it('should send a message to the dead letter queue when InputValidationAgent fails', async () => {
    const invalidMessage = { userId: 'test-user', input: { message: 'invalid input', recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
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
    const validMessage = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const recommendationError = new Error('Recommendation failed');
    // Mock InputValidationAgent to return an object matching its new signature
    mockInputValidationAgent.handleMessage.mockResolvedValue({ isValid: true, processedInput: { ingredients: [] } }); // Mock successful validation
    mockRecommendationAgent.handleMessage.mockRejectedValue(recommendationError);
    // Mock FallbackAgent is not called in this scenario anymore, but mocking its return type for safety
    mockFallbackAgent.handleMessage.mockResolvedValue({ recommendation: 'Fallback response' });

    // Expect the SommelierCoordinator.handleMessage to throw an error
    await expect(sommelierCoordinator.handleMessage(validMessage as any)).rejects.toThrow(recommendationError.message);

    // Verify that the RecommendationAgent was called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: validMessage.input.preferences }, conversationHistory: validMessage.conversationHistory });

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
  it('should process a message with both message and preferences, prioritizing message for ingredient extraction', async () => {
    const message = { userId: 'test-user', input: { message: 'wine with cheese', preferences: { wineType: "red" }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const mockValidationResult = { isValid: true, processedInput: { ingredients: ['cheese'], preferences: {} } }; // Validation extracts ingredients
    const mockRecommendationResult = { recommendedWines: [{ id: 'wine-2', name: 'Test White', type: 'white', price: 25, region: 'Test Region', rating: 4.5 }] };

    mockInputValidationAgent.handleMessage.mockResolvedValue(mockValidationResult);
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    const result = await sommelierCoordinator.handleMessage(message as any);

    // Expect InputValidationAgent to be called with the message content
    expect(mockInputValidationAgent.handleMessage).toHaveBeenCalledWith({ input: message.input.message, conversationHistory: message.conversationHistory });
    // Expect RecommendationAgent to be called with extracted ingredients and preferences from the validation result
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { ingredients: mockValidationResult.processedInput.ingredients, preferences: mockValidationResult.processedInput.preferences }, conversationHistory: message.conversationHistory });
    expect(result).toEqual(mockRecommendationResult);
  });

  it('should process a message with message but no extractable info, falling back to preferences', async () => {
    const message = { userId: 'test-user', input: { message: 'general query', preferences: { wineType: "white" }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const mockValidationResult = { isValid: true, processedInput: { ingredients: [], preferences: {} } }; // Validation finds no ingredients/preferences
    const mockRecommendationResult = { recommendedWines: [{ id: 'wine-3', name: 'Test Rose', type: 'rose', price: 15, region: 'Test Region', rating: 3.5 }] };

    mockInputValidationAgent.handleMessage.mockResolvedValue(mockValidationResult);
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    const result = await sommelierCoordinator.handleMessage(message as any);

    // Expect InputValidationAgent to be called with the message content
    expect(mockInputValidationAgent.handleMessage).toHaveBeenCalledWith({ input: message.input.message, conversationHistory: message.conversationHistory });
    // Expect RecommendationAgent to be called with preferences from the original message
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    expect(result).toEqual(mockRecommendationResult);
  });

  it('should use FallbackAgent when neither message nor preferences are provided', async () => {
    const message = { userId: 'test-user', input: { recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const mockFallbackResult = { recommendation: 'Fallback recommendation for no input' };

    mockFallbackAgent.handleMessage.mockResolvedValue(mockFallbackResult);

    const result = await sommelierCoordinator.handleMessage(message as any);

    // Expect FallbackAgent to be called
    expect(mockFallbackAgent.handleMessage).toHaveBeenCalledWith({ error: 'Could not determine request type from input (no message with ingredients or preferences provided.)', preferences: { wineType: 'Unknown' } });
    expect(result).toEqual(mockFallbackResult);
    // Expect dead letter processor to be called
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'RequestTypeDetermination' }
    );
  });

  it('should catch and log errors from ValueAnalysisAgent and continue orchestration', async () => {
    const message = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const vaError = new Error('Value analysis failed');
    const mockRecommendationResult = { recommendedWines: [] };

    mockValueAnalysisAgent.handleMessage.mockRejectedValue(vaError);
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    await sommelierCoordinator.handleMessage(message as any);

    // Expect ValueAnalysisAgent to have been called and rejected
    expect(mockValueAnalysisAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    // Expect dead letter processor to be called for ValueAnalysisAgent error
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'ValueAnalysisAgent' }
    );
    // Expect RecommendationAgent to still be called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
  });

  it('should catch and log errors from UserPreferenceAgent and continue orchestration', async () => {
    const message = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const upError = new Error('User preference failed');
    const mockRecommendationResult = { recommendedWines: [] };

    mockUserPreferenceAgent.handleMessage.mockRejectedValue(upError);
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    await sommelierCoordinator.handleMessage(message as any);

    // Expect UserPreferenceAgent to have been called and rejected
    // Expect UserPreferenceAgent to be called with the original message input string (or empty string if undefined) and initial preferences
    expect(mockUserPreferenceAgent.handleMessage).toHaveBeenCalledWith({ input: '', conversationHistory: message.conversationHistory, initialPreferences: expect.any(Array) }); // Expect empty string input and initial preferences
    // Expect dead letter processor to be called for UserPreferenceAgent error
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'UserPreferenceAgent' }
    );
    // Expect RecommendationAgent to still be called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
  });

  it('should catch and log errors from MCPAdapterAgent and continue orchestration', async () => {
    const message = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const mcpError = new Error('MCP adapter failed');
    const mockRecommendationResult = { recommendedWines: [] };

    mockMCPAdapterAgent.handleMessage.mockRejectedValue(mcpError);
    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);

    await sommelierCoordinator.handleMessage(message as any);

    // Expect MCPAdapterAgent to have been called and rejected
    expect(mockMCPAdapterAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    // Expect dead letter processor to be called for MCPAdapterAgent error
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'MCPAdapterAgent' }
    );
    // Expect RecommendationAgent to still be called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
  });

  it('should catch and log errors from ExplanationAgent and continue orchestration', async () => {
    const message = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const expError = new Error('Explanation failed');
    const mockRecommendationResult = { recommendedWines: [] };

    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);
    mockExplanationAgent.handleMessage.mockRejectedValue(expError);

    await sommelierCoordinator.handleMessage(message as any);

    // Expect RecommendationAgent to have been called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });
    // Expect ExplanationAgent to have been called and rejected
    expect(mockExplanationAgent.handleMessage).toHaveBeenCalledWith(mockRecommendationResult);
    // Expect dead letter processor to be called for ExplanationAgent error
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'ExplanationAgent' }
    );
  });

  it('should catch RecommendationAgent error returned within result and send to dead letter queue', async () => {
    const message = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] }; // Added recommendationSource
    const recommendationErrorResult = { error: 'No wines found for preferences' }; // Error within result

    mockRecommendationAgent.handleMessage.mockResolvedValue(recommendationErrorResult);

    // Expect the SommelierCoordinator.handleMessage to throw an error
    await expect(sommelierCoordinator.handleMessage(message as any)).rejects.toThrow('Recommendation Agent Error: No wines found for preferences');

    // Verify that the RecommendationAgent was called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: message.input.preferences }, conversationHistory: message.conversationHistory });

    // Verify that the dead letter processor was called
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      message,
      expect.any(Error), // Expecting an Error object
      { source: 'SommelierCoordinator', stage: 'RecommendationAgent' }
    );
  });

  it('should route recommendation requests based on recommendationSource', async () => {
    const knowledgeGraphMessage = { userId: 'test-user', input: { preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }, conversationHistory: [] };
    const llmMessage = { userId: 'test-user', input: { message: 'recommend a wine', preferences: { wineType: 'red' }, recommendationSource: 'llm' }, conversationHistory: [] };

    // Mock handleMessage for both agents
    mockRecommendationAgent.handleMessage.mockResolvedValue({ recommendedWines: [] });

    // Need to mock LLMRecommendationAgent as well
    const MockLLMRecommendationAgent = require('../LLMRecommendationAgent').LLMRecommendationAgent as jest.Mock<any>;
    const mockLLMRecommendationAgent = { handleMessage: jest.fn().mockResolvedValue({ recommendation: 'LLM recommendation' }), getName: () => 'MockLLMRecommendationAgent' } as any;

    // Test with knowledgeGraph source
    // Register LLMRecommendationAgent mock before resolving the coordinator for this test
    container.registerInstance(MockLLMRecommendationAgent, mockLLMRecommendationAgent);
    // Re-resolve the coordinator to pick up the new mock
    sommelierCoordinator = container.resolve(SommelierCoordinator);

    await sommelierCoordinator.handleMessage(knowledgeGraphMessage as any);
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalled();
    expect(mockLLMRecommendationAgent.handleMessage).not.toHaveBeenCalled();

    // Clear mocks and test with llm source
    jest.clearAllMocks();

    // Re-mock handleMessage for LLMRecommendationAgent after clearing mocks
    mockLLMRecommendationAgent.handleMessage.mockResolvedValue({ recommendation: 'LLM recommendation' });

    // Reset and re-register all mocks to ensure container state is correct
    container.clearInstances();
    container.reset();
    container.registerInstance(InputValidationAgent, mockInputValidationAgent);
    container.registerInstance(RecommendationAgent, mockRecommendationAgent);
    container.registerInstance(ValueAnalysisAgent, mockValueAnalysisAgent);
    container.registerInstance(UserPreferenceAgent, mockUserPreferenceAgent);
    container.registerInstance(ExplanationAgent, mockExplanationAgent);
    container.registerInstance(MCPAdapterAgent, mockMCPAdapterAgent);
    container.registerInstance(FallbackAgent, mockFallbackAgent);
    container.registerInstance(BasicDeadLetterProcessor, mockDeadLetterProcessor);
    container.registerInstance(KnowledgeGraphService, mockKnowledgeGraphService);
    container.registerInstance(AgentCommunicationBus, mockCommunicationBusInstance);
    container.registerInstance(MockLLMRecommendationAgent, mockLLMRecommendationAgent);
    // Register mock logger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
    container.registerInstance('logger', mockLogger);

    sommelierCoordinator = container.resolve(SommelierCoordinator);

    await sommelierCoordinator.handleMessage(llmMessage as any);
    expect(mockRecommendationAgent.handleMessage).not.toHaveBeenCalled();
    expect(mockLLMRecommendationAgent.handleMessage).toHaveBeenCalled();
  });

  it('should default to RecommendationAgent when recommendationSource is not provided', async () => {
    const defaultMessage = { userId: 'test-user', input: { preferences: { wineType: 'red' } }, conversationHistory: [] }; // Omitted recommendationSource
    const mockRecommendationResult = { recommendedWines: [{ id: 'wine-default', name: 'Default Red', type: 'red', price: 40, region: 'Default Region', rating: 4.2 }] };

    mockRecommendationAgent.handleMessage.mockResolvedValue(mockRecommendationResult);
    // Ensure LLMRecommendationAgent is not called
    const MockLLMRecommendationAgent = require('../LLMRecommendationAgent').LLMRecommendationAgent as jest.Mock<any>;
    const mockLLMRecommendationAgent = { handleMessage: jest.fn().mockResolvedValue({ recommendation: 'LLM recommendation' }), getName: () => 'MockLLMRecommendationAgent' } as any;
    container.registerInstance(MockLLMRecommendationAgent, mockLLMRecommendationAgent);
    // Re-resolve the coordinator to pick up the new mock
    sommelierCoordinator = container.resolve(SommelierCoordinator);


    await sommelierCoordinator.handleMessage(defaultMessage as any);

    // Expect RecommendationAgent to have been called
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalledWith({ input: { preferences: defaultMessage.input.preferences }, conversationHistory: defaultMessage.conversationHistory });
    // Expect LLMRecommendationAgent NOT to have been called
    expect(mockLLMRecommendationAgent.handleMessage).not.toHaveBeenCalled();
  });
});