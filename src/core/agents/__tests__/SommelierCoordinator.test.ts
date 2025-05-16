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
    let dlq: InMemoryDeadLetterQueue;

    beforeAll(() => {
        // Clear and reset container for isolated testing
        container.clearInstances();
        container.reset();

        // Clear all instances and calls to constructor and all methods for the mock bus:
        MockAgentCommunicationBus.mockClear();

        // Register the mock logger with the container
        container.register('Logger', { useValue: mockLogger });

        // Mock dependencies (ensure return types match the agents' updated signatures)
        mockInputValidationAgent = { handleMessage: jest.fn(), getName: () => 'MockInputValidationAgent' } as any;
        // ... rest of the code remains the same ...
    });

    test('should create an instance of SommelierCoordinator', () => {
        const mockInputValidationAgent = { handleMessage: jest.fn(), getName: () => 'MockInputValidationAgent' } as any;
        const mockRecommendationAgent = { handleMessage: jest.fn(), getName: () => 'MockRecommendationAgent' } as any;
        const mockValueAnalysisAgent = { handleMessage: jest.fn(), getName: () => 'MockValueAnalysisAgent' } as any;
        const mockUserPreferenceAgent = { handleMessage: jest.fn(), getName: () => 'MockUserPreferenceAgent' } as any;
        const mockExplanationAgent = { handleMessage: jest.fn(), getName: () => 'MockExplanationAgent' } as any;
        const mockMCPAdapterAgent = { handleMessage: jest.fn(), getName: () => 'MockMCPAdapterAgent' } as any;
        const mockFallbackAgent = { handleMessage: jest.fn(), getName: () => 'MockFallbackAgent' } as any;
        const mockDeadLetterProcessor = { process: jest.fn() } as any;
        const mockCommunicationBus = new MockAgentCommunicationBus() as any; // Use the mocked communication bus

        sommelierCoordinator = new SommelierCoordinator(
            mockInputValidationAgent,
            mockRecommendationAgent,
            mockValueAnalysisAgent,
            mockUserPreferenceAgent,
            mockExplanationAgent,
            mockMCPAdapterAgent,
            mockFallbackAgent,
            mockDeadLetterProcessor,
            mockCommunicationBus,
            mockLogger
        ); // Create an instance with mocked dependencies

        expect(sommelierCoordinator).toBeDefined(); // Check if the instance is defined
    });
}); // Close the describe block
