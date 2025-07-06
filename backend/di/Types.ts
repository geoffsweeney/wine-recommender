import winston from 'winston';

export const TYPES = {
    // Core infrastructure
    Logger: Symbol.for('Logger'),
    FileSystem: Symbol.for('FileSystem'),
    Path: Symbol.for('Path'),
    HttpClient: Symbol.for('HttpClient'),
    CircuitOptions: Symbol.for('CircuitOptions'),
    CircuitBreaker: Symbol.for('CircuitBreaker'),
    DeadLetterProcessor: Symbol.for('DeadLetterProcessor'),
    AgentCommunicationBus: Symbol.for('AgentCommunicationBus'),
    Config: Symbol.for('Config'),
    PerformanceTracker: Symbol.for('PerformanceTracker'),
    
    // Neo4j related
    Neo4jDriver: Symbol.for('Neo4jDriver'),
    Neo4jUri: Symbol.for('Neo4jUri'),
    Neo4jUser: Symbol.for('Neo4jUser'),
    Neo4jPassword: Symbol.for('Neo4jPassword'),
    Neo4jCircuitWrapper: Symbol.for('Neo4jCircuitWrapper'),
    Neo4jService: Symbol.for('Neo4jService'),
    
    // LLM related
    LlmApiUrl: Symbol.for('LlmApiUrl'),
    LlmModel: Symbol.for('LlmModel'),
    LlmApiKey: Symbol.for('LlmApiKey'),
    LlmMaxRetries: Symbol.for('LlmMaxRetries'), // New symbol for max retries
    LlmRetryDelayMs: Symbol.for('LlmRetryDelayMs'), // New symbol for retry delay
    DucklingUrl: Symbol.for('DucklingUrl'),
    LLMService: Symbol.for('LLMService'),
    
    // Recommendation strategies
    CollaborativeFilteringStrategy: Symbol.for('CollaborativeFilteringStrategy'),
    ISearchStrategy: Symbol.for('ISearchStrategy'),
    IRecommendationStrategy: Symbol.for('IRecommendationStrategy'),
    PopularWinesStrategy: Symbol.for('PopularWinesStrategy'),
    SimpleSearchStrategy: Symbol.for('SimpleSearchStrategy'),
    UserPreferencesStrategy: Symbol.for('UserPreferencesStrategy'),
    
    // Services
    KnowledgeGraphService: Symbol.for('KnowledgeGraphService'),
    PreferenceExtractionService: Symbol.for('PreferenceExtractionService'),
    PreferenceNormalizationService: Symbol.for('PreferenceNormalizationService'),
    RecommendationService: Symbol.for('RecommendationService'), // Added RecommendationService
    PromptManager: Symbol.for('PromptManager'),
    PromptManagerConfig: Symbol.for('PromptManagerConfig'), // Added
    WineRepository: Symbol.for('WineRepository'),
    WineService: Symbol.for('WineService'),
    
    // Controllers
    WineController: Symbol.for('WineController'),

    // Agents
    SommelierCoordinator: Symbol.for('SommelierCoordinator'),
    SommelierCoordinatorConfig: Symbol.for('SommelierCoordinatorConfig'), // Added
    SommelierCoordinatorDependencies: Symbol.for('SommelierCoordinatorDependencies'), // Added
    SommelierCoordinatorId: Symbol.for('SommelierCoordinatorId'), // Added
    AgentId: Symbol.for('AgentId'), // Added
    AgentConfig: Symbol.for('AgentConfig'), // Added
    InputValidationAgent: Symbol.for('InputValidationAgent'),
    InputValidationAgentConfig: Symbol.for('InputValidationAgentConfig'), // New symbol for InputValidationAgentConfig
    ValueAnalysisAgent: Symbol.for('ValueAnalysisAgent'),
    ValueAnalysisAgentConfig: Symbol.for('ValueAnalysisAgentConfig'), // New symbol for ValueAnalysisAgentConfig
    LLMRecommendationAgent: Symbol.for('LLMRecommendationAgent'),
    LLMRecommendationAgentConfig: Symbol.for('LLMRecommendationAgentConfig'), // New symbol for LLMRecommendationAgentConfig
    UserPreferenceAgent: Symbol.for('UserPreferenceAgent'),
    UserPreferenceAgentConfig: Symbol.for('UserPreferenceAgentConfig'), // New symbol for UserPreferenceAgentConfig
    RecommendationAgent: Symbol.for('RecommendationAgent'),
    RecommendationAgentConfig: Symbol.for('RecommendationAgentConfig'), // New symbol for RecommendationAgentConfig
    ExplanationAgent: Symbol.for('ExplanationAgent'),
    ExplanationAgentConfig: Symbol.for('ExplanationAgentConfig'), // New symbol for ExplanationAgentConfig
    FallbackAgent: Symbol.for('FallbackAgent'),
    FallbackAgentConfig: Symbol.for('FallbackAgentConfig'), // New symbol for FallbackAgentConfig
    LLMPreferenceExtractorAgent: Symbol.for('LLMPreferenceExtractorAgent'),
    LLMPreferenceExtractorAgentConfig: Symbol.for('LLMPreferenceExtractorAgentConfig'), // New symbol for LLMPreferenceExtractorAgentConfig
    MCPAdapterAgent: Symbol.for('MCPAdapterAgent'),
    MCPAdapterAgentConfig: Symbol.for('MCPAdapterAgentConfig'), // New symbol for MCPAdapterAgentConfig
    ShopperAgent: Symbol.for('ShopperAgent'), // Added
    ShopperAgentConfig: Symbol.for('ShopperAgentConfig'), // Added
    AgentDependencies: Symbol.for('AgentDependencies'), // New symbol for AgentDependencies
    CommunicatingAgentDependencies: Symbol.for('CommunicatingAgentDependencies'), // Added
    UserProfileService: Symbol.for('UserProfileService'), // Added
    ConversationHistoryService: Symbol.for('ConversationHistoryService'), // Added
    AgentRegistry: Symbol.for('AgentRegistry'), // Added for AgentRegistry
} as const;

export type TypeKeys = keyof typeof TYPES;

// Placeholder interfaces for AgentDependencies
// These should be replaced with actual interfaces as they are defined
export interface ILogger extends winston.Logger {} // Assuming winston is the logger
export interface IMessageQueue {}
export interface IStateManager {}
export interface IAgentConfig {}
export interface ICache {}
export interface IMetrics {}

// AgentDependencies interface as defined in .ai-guidelines/coding-standards.md
export interface AgentDependencies {
  readonly logger: ILogger;
  readonly messageQueue: IMessageQueue;
  readonly stateManager: IStateManager;
  readonly config: IAgentConfig;
  readonly cache?: ICache;
  readonly metrics?: IMetrics;
}

import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import { ConversationHistoryService } from '../core/ConversationHistoryService';
import { DeadLetterProcessor } from '../core/DeadLetterProcessor';
import { UserProfileService } from '../services/UserProfileService';

export interface SommelierCoordinatorDependencies extends AgentDependencies {
  communicationBus: EnhancedAgentCommunicationBus;
  deadLetterProcessor: DeadLetterProcessor;
  userProfileService: UserProfileService;
  conversationHistoryService: ConversationHistoryService;
}
