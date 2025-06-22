import 'reflect-metadata';
import { container } from 'tsyringe';
import { mockDeep } from 'jest-mock-extended';

// Core types and interfaces
import { TYPES } from '../../../../di/Types';
import { ILogger } from '../../../../services/LLMService';
import { AgentMessage } from '../../communication/AgentMessage';

interface AgentResponse {
    recommendation: string;
    source: string;
    conversationHistory: any[];
}

// Services
import { UserProfileService } from '../../../../services/UserProfileService';
import { KnowledgeGraphService } from '../../../../services/KnowledgeGraphService';
import { PreferenceExtractionService } from '../../../../services/PreferenceExtractionService';
import { PreferenceNormalizationService } from '../../../../services/PreferenceNormalizationService';
import { LLMService } from '../../../../services/LLMService';
import { ConversationHistoryService } from '../../../ConversationHistoryService';
import { BasicDeadLetterProcessor } from '../../../BasicDeadLetterProcessor';

// Communication
import { EnhancedAgentCommunicationBus } from '../../communication/EnhancedAgentCommunicationBus';

// Agents
import { SommelierCoordinator } from '../../SommelierCoordinator.new';
import { InputValidationAgent } from '../../InputValidationAgent.new';
import { RecommendationAgent } from '../../RecommendationAgent.new';
import { LLMRecommendationAgent } from '../../LLMRecommendationAgent.new';
import { UserPreferenceAgent } from '../../UserPreferenceAgent.new';
import { ValueAnalysisAgent } from '../../ValueAnalysisAgent.new';
import { ExplanationAgent } from '../../ExplanationAgent.new';
import { FallbackAgent } from '../../FallbackAgent.new';
import { MCPAdapterAgent } from '../../MCPAdapterAgent.new';

// Neo4j related imports (assuming these are needed for mocking Neo4jService)
import { Driver } from 'neo4j-driver';
import { CircuitOptions } from '../../../CircuitBreaker';
import { Neo4jCircuitWrapper } from '../../../../services/Neo4jCircuitWrapper';
import { Neo4jService } from '../../../../services/Neo4jService';

interface SommelierCoordinatorTestContext {
    sommelierCoordinator: SommelierCoordinator;
    communicationBus: jest.Mocked<EnhancedAgentCommunicationBus>;
    mockUserProfileService: jest.Mocked<UserProfileService>;
    mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>;
    mockPreferenceExtractionService: jest.Mocked<PreferenceExtractionService>;
    mockPreferenceNormalizationService: jest.Mocked<PreferenceNormalizationService>;
    mockDeadLetterProcessor: jest.Mocked<BasicDeadLetterProcessor>;
    mockConversationHistoryService: jest.Mocked<ConversationHistoryService>;
    mockLLMService: jest.Mocked<LLMService>;
    mockNeo4jDriver: jest.Mocked<Driver>;
    mockCircuitOptions: jest.Mocked<CircuitOptions>;
    mockNeo4jCircuitWrapper: jest.Mocked<Neo4jCircuitWrapper>;
    mockNeo4jService: jest.Mocked<Neo4jService>;
    mockLogger: jest.Mocked<ILogger>;
    mockInputValidationAgent: jest.Mocked<InputValidationAgent>;
    recommendationAgent: jest.Mocked<RecommendationAgent>;
    llmRecommendationAgent: jest.Mocked<LLMRecommendationAgent>;
    userPreferenceAgent: jest.Mocked<UserPreferenceAgent>;
    valueAnalysisAgent: jest.Mocked<ValueAnalysisAgent>;
    explanationAgent: jest.Mocked<ExplanationAgent>;
    fallbackAgent: jest.Mocked<FallbackAgent>;
    mcpAdapterAgent: jest.Mocked<MCPAdapterAgent>;
    orchestrationMonitorAgent: jest.Mocked<{ handleMessage: (message: AgentMessage) => Promise<void> }>; // Dummy agent for orchestration monitor
}

export function setupSommelierCoordinatorTest(): SommelierCoordinatorTestContext {
    // Clear all mocks and create isolated test container
    jest.clearAllMocks();
    const testContainer = container.createChildContainer();

    // Create mock instances for services
    const mockUserProfileService = mockDeep<UserProfileService>();
    const mockKnowledgeGraphService = mockDeep<KnowledgeGraphService>();
    const mockPreferenceExtractionService = mockDeep<PreferenceExtractionService>();
    const mockPreferenceNormalizationService = mockDeep<PreferenceNormalizationService>();
    const mockDeadLetterProcessor = mockDeep<BasicDeadLetterProcessor>();
    const mockConversationHistoryService = mockDeep<ConversationHistoryService>();
    const mockLLMService = mockDeep<LLMService>();
    const mockNeo4jDriver = mockDeep<Driver>();
    const mockCircuitOptions = mockDeep<CircuitOptions>();
    const mockNeo4jCircuitWrapper = mockDeep<Neo4jCircuitWrapper>();
    const mockNeo4jService = mockDeep<Neo4jService>();
    const mockLogger = mockDeep<ILogger>();
    const communicationBus = mockDeep<EnhancedAgentCommunicationBus>();

    // Mock service methods
    mockUserProfileService.loadPreferences.mockResolvedValue([]);
    mockUserProfileService.savePreferences.mockResolvedValue(undefined);

    mockKnowledgeGraphService.getPreferences.mockResolvedValue([]);
    mockKnowledgeGraphService.findWinesByPreferences.mockResolvedValue([]);

    mockPreferenceExtractionService.attemptFastExtraction.mockResolvedValue({});

    (mockPreferenceNormalizationService.normalizePreferences as jest.Mock).mockReturnValue([]); // It's a synchronous method

    mockDeadLetterProcessor.process.mockResolvedValue(undefined);

    (mockConversationHistoryService.getConversationHistory as jest.Mock).mockReturnValue([]);
    mockConversationHistoryService.addConversationTurn.mockImplementation(() => {}); // Assuming this method exists and is void

    mockLLMService.sendPrompt.mockResolvedValue('Mock LLM response');

    // Internal map to store registered handlers for the mocked bus
    const registeredHandlers = new Map<string, Map<string, (message: AgentMessage) => Promise<void>>>();
    (communicationBus as any).registeredHandlers = registeredHandlers;
// Dummy agent for orchestration monitor
    // Mock communicationBus methods
    communicationBus.registerMessageHandler.mockImplementation((agentId, messageType, handler) => {
        if (!registeredHandlers.has(agentId)) {
            registeredHandlers.set(agentId, new Map());
        }
        registeredHandlers.get(agentId)!.set(messageType, handler);
        console.log(`Mocked bus: Registered handler for ${agentId}, type ${messageType}. Current handlers:`, registeredHandlers);
    });

    // Dummy agent for orchestration monitor
    const orchestrationMonitorAgent = mockDeep<{ handleMessage: (message: AgentMessage) => Promise<void> }>();
    communicationBus.registerMessageHandler('orchestration-monitor', 'orchestration-status', orchestrationMonitorAgent.handleMessage);

    communicationBus.sendMessageAndWaitForResponse.mockImplementation(async <T>(targetAgentId: string, message: AgentMessage, timeoutMs?: number): Promise<AgentMessage<T>> => {
        console.log(`Mocked bus (sendMessageAndWaitForResponse): Attempting to route message to ${targetAgentId}, type ${message.type}. Current handlers:`, registeredHandlers);
        console.log(`Mocked bus (publishToAgent): Attempting to route message to ${targetAgentId}, type ${message.type}. Current handlers:`, registeredHandlers);
        const agentHandlers = registeredHandlers.get(targetAgentId);
        if (agentHandlers) {
            const handler = agentHandlers.get(message.type);
            if (handler) {
                // Execute the handler for the target agent
                // Note: In a real scenario, the agent would send a response back to the bus.
                // Here, we directly simulate the response for the test.
                await handler(message); // Execute the agent's handler

                // Simulate the response based on the message type
                let responsePayload: any;
                let responseType: string;

                switch (targetAgentId) {
                    case 'input-validation-agent':
                        responsePayload = { isValid: true, processedInput: { recommendationSource: 'knowledgeGraph', preferences: { wineType: 'red' }, message: 'recommend a red wine' } };
                        responseType = 'validation-result';
                        break;
                    case 'recommendation-agent':
                        responsePayload = { recommendation: 'Mock Red Wine (Red, Mock Region) - Pairs well with...', source: 'Knowledge Graph' };
                        responseType = 'recommendation-response';
                        break;
                    case 'llm-recommendation':
                        responsePayload = { recommendedWines: [{ id: 'mock-wine-id-1', name: 'Mock Enhanced Red Wine', region: 'Mock Enhanced Region', type: 'Red', price: 25 }], llmEnhancement: 'This is an enhanced recommendation based on your preferences.' };
                        responseType = 'llm-recommendation-response';
                        break;
                    case 'user-preference-agent':
                        responsePayload = { preferences: [{ type: 'wineType', value: 'red', source: 'user-input', confidence: 1, timestamp: new Date().toISOString(), active: true }], success: true };
                        responseType = 'preference-update-result';
                        break;
                    case 'value-analysis-agent':
                        responsePayload = { success: true, wineId: 'mock-wine-id', valueScore: 10, priceQualityRatio: 'Good', tastingNotes: [], agingPotential: 'Medium' };
                        responseType = 'value-analysis-result';
                        break;
                    case 'explanation-agent':
                        responsePayload = { explanation: 'Mock explanation.', recommendedWines: [] };
                        responseType = 'explanation-response';
                        break;
                    case 'mcp-adapter-agent':
                        responsePayload = { status: 'success', result: 'Mock MCP result.' };
                        responseType = 'mcp-tool-response';
                        break;
                    case 'fallback-agent':
                        responsePayload = { recommendation: 'Sorry, I encountered an issue and cannot provide a recommendation at this time. Please try again later.' };
                        responseType = 'fallback-response';
                        break;
                    default:
                        throw new Error(`Mocked bus: Unknown agent for response simulation: ${targetAgentId}`);
                }

                return {
                    metadata: {
                        traceId: `${message.metadata.traceId}-response`,
                        priority: 'NORMAL',
                        timestamp: Date.now(),
                        sender: targetAgentId
                    },
                    payload: responsePayload,
                    type: responseType,
                    userId: message.userId
                } as AgentMessage<T>;
            } else {
                console.warn(`Mocked bus (sendMessageAndWaitForResponse): No handler for message type ${message.type} in agent ${targetAgentId}`);
                throw new Error(`No handler for message type ${message.type} in agent ${targetAgentId}`);
            }
        } else {
            console.warn(`Mocked bus (sendMessageAndWaitForResponse): No handlers registered for agent: ${targetAgentId}`);
            throw new Error(`No handlers registered for agent: ${targetAgentId}`);
        }
    });

    communicationBus.publishToAgent.mockImplementation(async (targetAgentId: string, message: AgentMessage) => {
        const agentHandlers = registeredHandlers.get(targetAgentId);
        if (agentHandlers) {
            const handler = agentHandlers.get(message.type);
            if (handler) {
                await handler(message);
            } else {
                console.warn(`Mocked bus (publishToAgent): No handler for message type ${message.type} in agent ${targetAgentId}`);
            }
        } else {
            console.warn(`Mocked bus (publishToAgent): No handlers registered for agent: ${targetAgentId}`);
        }
    });

    communicationBus.sendLLMPrompt.mockImplementation(async (prompt): Promise<string | undefined> => {
        if (prompt.includes('Analyze the following user input')) {
            return '{"isValid": true, "preferences": {"wineType": "red"}}';
        }
        if (prompt.includes('Based on the following error')) {
            return '{"recommendation": "Sorry, I cannot provide a recommendation at this time."}';
        }
        return '{"isValid": false, "error": "Mock LLM response not configured for this prompt."}';
    });

    // Register all services in test container using interface-based DI
    testContainer.register('UserProfileService', { useValue: mockUserProfileService });
    testContainer.register(TYPES.KnowledgeGraphService, { useValue: mockKnowledgeGraphService });
    testContainer.register(TYPES.PreferenceExtractionService, { useValue: mockPreferenceExtractionService });
    testContainer.register(TYPES.PreferenceNormalizationService, { useValue: mockPreferenceNormalizationService });
    testContainer.register(TYPES.DeadLetterProcessor, { useValue: mockDeadLetterProcessor });
    testContainer.register(ConversationHistoryService, { useValue: mockConversationHistoryService });
    testContainer.register(TYPES.LLMService, { useValue: mockLLMService });
    testContainer.register('llmApiUrl', { useValue: "http://mock-llm-api.com" });

    // Register database-related mocks
    testContainer.register(TYPES.Neo4jDriver, { useValue: mockNeo4jDriver });
    testContainer.register(TYPES.CircuitOptions, { useValue: mockCircuitOptions });
    testContainer.register(TYPES.Neo4jCircuitWrapper, { useValue: mockNeo4jCircuitWrapper });
    testContainer.register(TYPES.Neo4jService, { useValue: mockNeo4jService });
    testContainer.register(TYPES.Neo4jUri, { useValue: "bolt://localhost:7687" });
    testContainer.register(TYPES.Neo4jUser, { useValue: "neo4j" });
    testContainer.register(TYPES.Neo4jPassword, { useValue: "password" });

    // Register communication bus and logger
    testContainer.register(TYPES.Logger, { useValue: mockLogger });
    testContainer.register(TYPES.AgentCommunicationBus, { useValue: communicationBus });
    testContainer.register(EnhancedAgentCommunicationBus, { useValue: communicationBus });

    // Resolve SommelierCoordinator from the test container
    const sommelierCoordinator = testContainer.resolve(SommelierCoordinator);

    // Mock the coordinator's handleMessage method with proper typing

    // Resolve and mock agents
    const inputValidationAgent = testContainer.resolve(InputValidationAgent) as jest.Mocked<InputValidationAgent>;
    const recommendationAgent = testContainer.resolve(RecommendationAgent) as jest.Mocked<RecommendationAgent>;
    const llmRecommendationAgent = testContainer.resolve(LLMRecommendationAgent) as jest.Mocked<LLMRecommendationAgent>;
    const userPreferenceAgent = testContainer.resolve(UserPreferenceAgent) as jest.Mocked<UserPreferenceAgent>;
    const valueAnalysisAgent = testContainer.resolve(ValueAnalysisAgent) as jest.Mocked<ValueAnalysisAgent>;
    const explanationAgent = testContainer.resolve(ExplanationAgent) as jest.Mocked<ExplanationAgent>;
    const fallbackAgent = testContainer.resolve(FallbackAgent) as jest.Mocked<FallbackAgent>;
    const mcpAdapterAgent = testContainer.resolve(MCPAdapterAgent) as jest.Mocked<MCPAdapterAgent>;


    // Mock agent methods (simplified for now, can be expanded as needed)
    jest.spyOn(inputValidationAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(recommendationAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(llmRecommendationAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(userPreferenceAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(valueAnalysisAgent, 'handleMessage').mockImplementation(async (message) => {
        // ValueAnalysisAgent's handleMessage returns ValueAnalysisResponse
        return { success: true, wineId: 'mock-wine-id', valueScore: 10, priceQualityRatio: 'Good', tastingNotes: [], agingPotential: 'Medium' };
    });
    jest.spyOn(explanationAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(fallbackAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });
    jest.spyOn(mcpAdapterAgent, 'handleMessage').mockImplementation(async (message) => {
        return Promise.resolve(undefined); // Assuming handleMessage returns void
    });

    return {
        sommelierCoordinator,
        communicationBus,
        mockUserProfileService,
        mockKnowledgeGraphService,
        mockPreferenceExtractionService,
        mockPreferenceNormalizationService,
        mockDeadLetterProcessor,
        mockConversationHistoryService,
        mockLLMService,
        mockNeo4jDriver,
        mockCircuitOptions,
        mockNeo4jCircuitWrapper,
        mockNeo4jService,
        mockLogger,
        mockInputValidationAgent: inputValidationAgent, // Return the resolved and mocked agent
        recommendationAgent,
        llmRecommendationAgent,
        userPreferenceAgent,
        valueAnalysisAgent,
        explanationAgent,
        fallbackAgent,
        mcpAdapterAgent,
        orchestrationMonitorAgent,
    };
}