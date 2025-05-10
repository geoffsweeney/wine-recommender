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

const MockInputValidationAgent = InputValidationAgent as jest.Mock<InputValidationAgent>;
const MockRecommendationAgent = RecommendationAgent as jest.Mock<RecommendationAgent>;
const MockValueAnalysisAgent = ValueAnalysisAgent as jest.Mock<ValueAnalysisAgent>;
const MockUserPreferenceAgent = UserPreferenceAgent as jest.Mock<UserPreferenceAgent>;
const MockExplanationAgent = ExplanationAgent as jest.Mock<ExplanationAgent>;
const MockMCPAdapterAgent = MCPAdapterAgent as jest.Mock<MCPAdapterAgent>;
const MockFallbackAgent = FallbackAgent as jest.Mock<FallbackAgent>;
const MockBasicDeadLetterProcessor = BasicDeadLetterProcessor as jest.Mock<BasicDeadLetterProcessor>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.Mock<KnowledgeGraphService>; // Mock KnowledgeGraphService

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

  beforeEach(() => {
    // Clear and reset container for isolated testing
    container.clearInstances();
    container.reset();

    // Instantiate mocks
    mockInputValidationAgent = new MockInputValidationAgent() as jest.Mocked<InputValidationAgent>;
    mockRecommendationAgent = new MockRecommendationAgent() as jest.Mocked<RecommendationAgent>;
    mockValueAnalysisAgent = new MockValueAnalysisAgent() as jest.Mocked<ValueAnalysisAgent>;
    mockUserPreferenceAgent = new MockUserPreferenceAgent() as jest.Mocked<UserPreferenceAgent>;
    mockExplanationAgent = new MockExplanationAgent() as jest.Mocked<ExplanationAgent>;
    mockMCPAdapterAgent = new MockMCPAdapterAgent() as jest.Mocked<MCPAdapterAgent>;
    mockFallbackAgent = new MockFallbackAgent() as jest.Mocked<FallbackAgent>;
    mockDeadLetterProcessor = new MockBasicDeadLetterProcessor() as jest.Mocked<BasicDeadLetterProcessor>;
    mockKnowledgeGraphService = new MockKnowledgeGraphService() as jest.Mocked<KnowledgeGraphService>; // Instantiate mock

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

    // Resolve the SommelierCoordinator
    sommelierCoordinator = container.resolve(SommelierCoordinator);

    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  it('should process a preference-based message and call RecommendationAgent with preferences', async () => {
    const message = { userId: 'test-user', preferences: { wineType: "red", priceRange: [20, 50] } };
    const mockRecommendationResult = [{ id: 'wine-1', name: 'Test Red', type: 'red', price: 30, region: 'Test Region', rating: 4 }];

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

  // Add more unit test cases for SommelierCoordinator here...
});