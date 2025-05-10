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
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from '../../BasicDeadLetterProcessor';
import { InMemoryDeadLetterQueue } from '../../InMemoryDeadLetterQueue';
import { BasicRetryManager } from '../../BasicRetryManager';

describe('SommelierCoordinator', () => {
  let sommelierCoordinator: SommelierCoordinator;
  let mockInputValidationAgent: jest.Mocked<InputValidationAgent>;
  let mockRecommendationAgent: jest.Mocked<RecommendationAgent>;
  let mockValueAnalysisAgent: jest.Mocked<ValueAnalysisAgent>;
  let mockUserPreferenceAgent: jest.Mocked<UserPreferenceAgent>;
  let mockExplanationAgent: jest.Mocked<ExplanationAgent>;
  let mockMCPAdapterAgent: jest.Mocked<MCPAdapterAgent>;
  let mockFallbackAgent: jest.Mocked<FallbackAgent>;
  let mockDeadLetterProcessor: jest.Mocked<BasicDeadLetterProcessor>;
  let dlq: InMemoryDeadLetterQueue;

  beforeAll(() => {
    // Clear and reset container for isolated testing
    container.clearInstances();
    container.reset();

    // Mock dependencies
    mockInputValidationAgent = { handleMessage: jest.fn(), getName: () => 'MockInputValidationAgent' } as any;
    mockRecommendationAgent = { handleMessage: jest.fn(), getName: () => 'MockRecommendationAgent', knowledgeGraphService: {} } as any; // Mock required property
    mockValueAnalysisAgent = { handleMessage: jest.fn(), getName: () => 'MockValueAnalysisAgent' } as any;
    mockUserPreferenceAgent = { handleMessage: jest.fn(), getName: () => 'MockUserPreferenceAgent' } as any;
    mockExplanationAgent = { handleMessage: jest.fn(), getName: () => 'MockExplanationAgent' } as any;
    mockMCPAdapterAgent = { handleMessage: jest.fn(), getName: () => 'MockMCPAdapterAgent' } as any;
    mockFallbackAgent = { handleMessage: jest.fn(), getName: () => 'MockFallbackAgent' } as any;
    mockDeadLetterProcessor = { process: jest.fn() } as any;

    // Register mocks and actual implementations
    container.registerInstance(InputValidationAgent, mockInputValidationAgent);
    container.registerInstance(RecommendationAgent, mockRecommendationAgent);
    container.registerInstance(ValueAnalysisAgent, mockValueAnalysisAgent);
    container.registerInstance(UserPreferenceAgent, mockUserPreferenceAgent);
    container.registerInstance(ExplanationAgent, mockExplanationAgent);
    container.registerInstance(MCPAdapterAgent, mockMCPAdapterAgent);
    container.registerInstance(FallbackAgent, mockFallbackAgent);
    container.registerInstance(BasicDeadLetterProcessor, mockDeadLetterProcessor);

    // Register actual DLQ components for inspection
    container.registerSingleton('InMemoryDeadLetterQueue', InMemoryDeadLetterQueue);
    container.registerSingleton('LoggingDeadLetterHandler', LoggingDeadLetterHandler);
    container.registerSingleton('BasicRetryManager', BasicRetryManager);

    // Resolve the SommelierCoordinator and DLQ
    sommelierCoordinator = container.resolve(SommelierCoordinator);
    dlq = container.resolve('InMemoryDeadLetterQueue');
  });

  beforeEach(() => {
    // Clear DLQ and reset mocks before each test
    dlq.clear();
    jest.clearAllMocks();
  });

  it('should send a message to the dead letter queue when InputValidationAgent fails', async () => {
    const invalidMessage = { message: 'invalid input' };
    const validationError = new Error('Validation failed');
    mockInputValidationAgent.handleMessage.mockResolvedValue({ isValid: false, error: validationError.message });
    mockFallbackAgent.handleMessage.mockResolvedValue('Fallback response');

    await sommelierCoordinator.handleMessage(invalidMessage as any);

    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
      invalidMessage,
      expect.any(Error),
      { source: 'SommelierCoordinator', stage: 'InputValidation' }
    );
    expect(mockFallbackAgent.handleMessage).toHaveBeenCalledWith({ error: validationError.message, preferences: { wineType: 'Unknown' } });
  });

  it('should send a message to the dead letter queue when RecommendationAgent fails', async () => {
    const validMessage = { userId: 'test-user', preferences: { wineType: 'red' } };
    const recommendationError = new Error('Recommendation failed');
    mockInputValidationAgent.handleMessage.mockResolvedValue({ isValid: true, processedInput: { ingredients: [] } }); // Mock successful validation
    mockRecommendationAgent.handleMessage.mockRejectedValue(recommendationError);
    mockFallbackAgent.handleMessage.mockResolvedValue('Fallback response');

    // Expect the SommelierCoordinator.handleMessage to throw an error
    await expect(sommelierCoordinator.handleMessage(validMessage as any)).rejects.toThrow('Recommendation failed.');

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

    // The DLQ assertion here is no longer relevant because we are mocking the processor.
    // The mock processor doesn't interact with the real DLQ instance.
    // expect(dlq.getAll().length).toBe(0); // DLQ is handled by the processor, not directly in this flow
  });

  // Add more test cases for other agent failures and successful flow
});