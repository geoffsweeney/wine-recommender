import 'reflect-metadata';
import { container } from 'tsyringe';
import { mockDeep } from 'jest-mock-extended';

// Core types and interfaces
import { TYPES } from '../../../../di/Types';
import { ILogger } from '../../../../services/LLMService';
import { AgentMessage } from '../../communication/AgentMessage';
import { Result } from '../../../types/Result'; // Import Result
import { AgentError } from '../../AgentError'; // Import AgentError
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4

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
import { SommelierCoordinator } from '../../SommelierCoordinator';
import { InputValidationAgent } from '../../InputValidationAgent';
import { RecommendationAgent } from '../../RecommendationAgent';
import { LLMRecommendationAgent } from '../../LLMRecommendationAgent';
import { UserPreferenceAgent } from '../../UserPreferenceAgent';
import { ValueAnalysisAgent } from '../../ValueAnalysisAgent';
import { ExplanationAgent } from '../../ExplanationAgent';
import { FallbackAgent } from '../../FallbackAgent';
import { MCPAdapterAgent } from '../../MCPAdapterAgent';

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
    orchestrationMonitorAgent: jest.Mocked<{ handleMessage: (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>> }>; // Dummy agent for orchestration monitor
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

    // mockKnowledgeGraphService.getPreferences.mockResolvedValue([]); // Removed as KnowledgeGraphService no longer handles preferences
    mockKnowledgeGraphService.findWinesByPreferences.mockResolvedValue([]);

    mockPreferenceExtractionService.attemptFastExtraction.mockResolvedValue({ success: true, data: {} }); // Return Result type

    (mockPreferenceNormalizationService.normalizePreferences as jest.Mock).mockReturnValue([]); // It's a synchronous method

    mockDeadLetterProcessor.process.mockResolvedValue(undefined); // Corrected to return void

    (mockConversationHistoryService.getConversationHistory as jest.Mock).mockReturnValue([]);
    mockConversationHistoryService.addConversationTurn.mockImplementation(() => {}); // Assuming this method exists and is void

    mockLLMService.sendPrompt.mockResolvedValue({ success: true, data: 'Mock LLM response' }); // Return Result type

    // Internal map to store registered handlers for the mocked bus
    const registeredHandlers = new Map<string, Map<string, (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>>>(); // Updated handler type
    (communicationBus as any).registeredHandlers = registeredHandlers;
// Dummy agent for orchestration monitor
    // Mock communicationBus methods
    communicationBus.registerMessageHandler.mockImplementation((agentId, messageType, handler) => {
        if (!registeredHandlers.has(agentId)) {
            registeredHandlers.set(agentId, new Map());
        }
        registeredHandlers.get(agentId)!.set(messageType, handler); // No cast needed if handler is correctly typed
        console.log(`Mocked bus: Registered handler for ${agentId}, type ${messageType}. Current handlers:`, registeredHandlers);
    });

    // Dummy agent for orchestration monitor
    const orchestrationMonitorAgent = mockDeep<{ handleMessage: (message: AgentMessage) => Promise<void> }>(); // Reverted to Promise<void>
    communicationBus.registerMessageHandler('orchestration-monitor', 'orchestration-status', orchestrationMonitorAgent.handleMessage);

    communicationBus.sendMessageAndWaitForResponse.mockImplementation(async <T>(targetAgentId: string, message: AgentMessage, timeoutMs?: number): Promise<Result<AgentMessage<T> | null, AgentError>> => { // Updated return type
        console.log(`Mocked bus (sendMessageAndWaitForResponse): Attempting to route message to ${targetAgentId}, type ${message.type}. Current handlers:`, registeredHandlers);
        console.log(`Mocked bus (publishToAgent): Attempting to route message to ${targetAgentId}, type ${message.type}. Current handlers:`, registeredHandlers);
        const agentHandlers = registeredHandlers.get(targetAgentId);
        if (agentHandlers) {
            const handler = agentHandlers.get(message.type);
            if (handler) {
                // Execute the handler for the target agent
                // Note: In a real scenario, the agent would send a response back to the bus.
                // Here, we directly simulate the response for the test.
                const handlerResult = await handler(message); // Execute the agent's handler and get its Result

                if (handlerResult.success) {
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

                    // Ensure all required AgentMessage properties are present
                    const responseMessage: AgentMessage<T> = {
                        id: uuidv4(), // Generate a new ID
                        timestamp: new Date(),
                        correlationId: message.correlationId, // Use original correlationId
                        sourceAgent: targetAgentId, // The agent sending the response
                        targetAgent: message.sourceAgent, // The original sender
                        type: responseType,
                        payload: responsePayload,
                        userId: message.userId,
                        priority: 'NORMAL',
                        conversationId: message.conversationId, // Added conversationId
                        metadata: {
                            traceId: `${message.metadata?.traceId || message.correlationId}-response`, // Use traceId from metadata or correlationId
                            sender: targetAgentId
                        }
                    };
                    return { success: true, data: responseMessage };
                } else {
                    return { success: false, error: handlerResult.error };
                }
            } else {
                console.warn(`Mocked bus (sendMessageAndWaitForResponse): No handler for message type ${message.type} in agent ${targetAgentId}`);
                return { success: false, error: new AgentError(`No handler for message type ${message.type} in agent ${targetAgentId}`, 'MOCK_HANDLER_NOT_FOUND', 'mock-bus', message.correlationId) };
            }
        } else {
            console.warn(`Mocked bus (sendMessageAndWaitForResponse): No handlers registered for agent: ${targetAgentId}`);
            return { success: false, error: new AgentError(`No handlers registered for agent: ${targetAgentId}`, 'MOCK_AGENT_NOT_REGISTERED', 'mock-bus', message.correlationId) };
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

    communicationBus.sendLLMPrompt.mockImplementation(async (prompt, correlationId): Promise<Result<string, AgentError>> => { // Added correlationId parameter
        if (prompt.includes('Analyze the following user input')) {
            return { success: true, data: '{"isValid": true, "preferences": {"wineType": "red"}}' };
        }
        if (prompt.includes('Based on the following error')) {
            return { success: true, data: '{"recommendation": "Sorry, I cannot provide a recommendation at this time."}' };
        }
        return { success: false, error: new AgentError('Mock LLM response not configured for this prompt.', 'MOCK_LLM_ERROR', 'mock-llm', correlationId || 'unknown') };
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
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(recommendationAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(llmRecommendationAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(userPreferenceAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(valueAnalysisAgent, 'handleMessage').mockImplementation(async (message) => {
        // ValueAnalysisAgent's handleMessage returns ValueAnalysisResponse
        return { success: true, data: { success: true, wineId: 'mock-wine-id', valueScore: 10, priceQualityRatio: 'Good', tastingNotes: [], agingPotential: 'Medium' } }; // Wrap in Result
    });
    jest.spyOn(explanationAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(fallbackAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
    });
    jest.spyOn(mcpAdapterAgent, 'handleMessage').mockImplementation(async (message) => {
        return { success: true, data: null }; // Assuming handleMessage returns Result
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