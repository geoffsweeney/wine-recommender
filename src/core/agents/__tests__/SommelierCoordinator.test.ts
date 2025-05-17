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
import { AgentCommunicationBus } from '../../AgentCommunicationBus'; // Import AgentCommunicationBus
import { ConversationHistoryService } from '../../ConversationHistoryService'; // Import ConversationHistoryService
import winston from 'winston'; // Import winston for mocking

// Create a proper mock of the logger
const mockLogger: winston.Logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console(),
    ],
});

// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

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
    let mockCommunicationBus: jest.Mocked<AgentCommunicationBus>; // Mock instance type
    let mockConversationHistoryService: jest.Mocked<ConversationHistoryService>; // Mock ConversationHistoryService
    let dlq: InMemoryDeadLetterQueue;

    beforeAll(() => {
        // Clear and reset container for isolated testing
        container.clearInstances();
        container.reset();

        // Clear all instances and calls to constructor and all methods for the mock bus:
        MockAgentCommunicationBus.mockClear();

        // Register the mock logger with the container
        container.register('logger', { useValue: mockLogger }); // Corrected token to 'logger'

        // Mock dependencies (ensure return types match the agents' updated signatures)
        mockInputValidationAgent = { handleMessage: jest.fn(), getName: () => 'MockInputValidationAgent' } as any;
        mockRecommendationAgent = { handleMessage: jest.fn(), getName: () => 'MockRecommendationAgent' } as any;
        mockValueAnalysisAgent = { handleMessage: jest.fn(), getName: () => 'MockValueAnalysisAgent' } as any;
        mockUserPreferenceAgent = { handleMessage: jest.fn(), getName: () => 'MockUserPreferenceAgent' } as any;
        mockExplanationAgent = { handleMessage: jest.fn(), getName: () => 'MockExplanationAgent' } as any;
        mockMCPAdapterAgent = { handleMessage: jest.fn(), getName: () => 'MockMCPAdapterAgent' } as any;
        mockFallbackAgent = { handleMessage: jest.fn(), getName: () => 'MockFallbackAgent' } as any;
        mockDeadLetterProcessor = { process: jest.fn() } as any;
        mockCommunicationBus = new MockAgentCommunicationBus() as any; // Use the mocked communication bus
        mockConversationHistoryService = { // Create mock ConversationHistoryService here
            addConversationTurn: jest.fn(),
            getConversationHistory: jest.fn().mockReturnValue([]), // Default to returning empty history
            clearConversationHistory: jest.fn(),
        } as any; // Use 'any' to avoid strict type checking for the mock

        // Register all mocked dependencies in the container
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
        container.registerInstance(AgentCommunicationBus, mockCommunicationBus);
        container.registerInstance(ConversationHistoryService, mockConversationHistoryService); // Register mock ConversationHistoryService

        // Resolve the SommelierCoordinator
        sommelierCoordinator = container.resolve(SommelierCoordinator);
    });

    afterEach(() => {
        // Clear mock calls after each test
        jest.clearAllMocks();
    });

    test('should create an instance of SommelierCoordinator', () => {
        expect(sommelierCoordinator).toBeDefined(); // Check if the instance is defined
    });

    // Add other tests for SommelierCoordinator functionality here, using the resolved instance
    // For example, you can add tests similar to the unit tests but using the resolved coordinator
});
