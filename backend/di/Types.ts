import winston from 'winston';
import { DependencyContainer } from 'tsyringe';
import { FeatureFlags } from '../config/featureFlags';
export { FeatureFlags };
import { AgentError } from '../core/agents/AgentError';
import { AgentMessage } from '../core/agents/communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus'; // Import EnhancedAgentCommunicationBus
import { Result } from '../core/types/Result';
import { LogContext } from '../types/LogContext';
import { PromptTemplate, PromptTask, PromptVariables } from '../services/PromptManager';

// Import Agent Classes for use in TYPES
import { AdminConversationalAgent } from '../core/agents/AdminConversationalAgent';
import { ExplanationAgent } from '../core/agents/ExplanationAgent';
import { FallbackAgent } from '../core/agents/FallbackAgent';
import { InputValidationAgent } from '../core/agents/InputValidationAgent';
import { LLMPreferenceExtractorAgent } from '../core/agents/LLMPreferenceExtractorAgent';
import { LLMRecommendationAgent } from '../core/agents/LLMRecommendationAgent';
import { MCPAdapterAgent } from '../core/agents/MCPAdapterAgent';
import { RecommendationAgent } from '../core/agents/RecommendationAgent';
import { ShopperAgent } from '../core/agents/ShopperAgent';
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator';
import { UserPreferenceAgent } from '../core/agents/UserPreferenceAgent';
import { ValueAnalysisAgent } from '../core/agents/ValueAnalysisAgent';

/**
 * Creates a typed injection token for better type safety
 */
export function createSymbol<T>(name: string): symbol {
  return Symbol.for(name);
}

// ----------------------------
// Core Infrastructure Interfaces
// ----------------------------
export interface ILogger extends winston.Logger {}
export interface IFileSystem {}
export interface IPath {}
export interface IHttpClient {}
export interface ICircuitOptions {}
export interface ICircuitBreaker {}
export interface IDeadLetterProcessor {}
export interface IAgentCommunicationBus {
  publish<T>(message: AgentMessage<T>): void;
  subscribe(subscriberId: string, handler: (message: AgentMessage<any>) => void, messageType?: string): void;
}
export interface IConfig {}
export interface IPerformanceTracker {}

export interface IContainerManager {} // Add interface for ContainerManager

// Infrastructure Utilities
export interface IHealthChecks {
  [key: string]: () => Promise<{ status: string }>;
}

export interface IShutdownHandlers extends Array<() => Promise<void>> {}

// ----------------------------
// Database Interfaces
// ----------------------------
export interface INeo4jDriver {}
export interface INeo4jService {
  executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]>;
  verifyConnection(): Promise<Result<boolean, AgentError>>;
  close(): Promise<void>;
  getCircuitState(): string;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; circuitState: string; connectionVerified: boolean }>;
}
export interface INeo4jCircuitWrapper {}

// ----------------------------
// LLM Services
// ----------------------------
export interface ILLMService {
  sendPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<string, AgentError>>;

  sendStructuredPrompt<T extends keyof PromptTemplate, U>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<U, AgentError>>;
}

// ----------------------------
// Recommendation Strategies
// ----------------------------
export interface IRecommendationStrategy {}
export interface ISearchStrategy {}
export interface ICollaborativeFilteringStrategy {}
export interface IPopularWinesStrategy {}
export interface IUserPreferencesStrategy {}

// ----------------------------
// Service Interfaces
// ----------------------------
export interface IKnowledgeGraphService {}
export interface IPreferenceExtractionService {}
export interface IPreferenceNormalizationService {}
export interface IRecommendationService {}
export interface IAdminPreferenceService {}
export interface IPromptManager {
  getPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables
  ): Promise<Result<string, Error>>;
  // Add other methods as needed for PromptManager
}
export interface IPromptManagerConfig {}
export interface IWineRepository {}
export interface IWineService {}

// ----------------------------
// Supporting Interfaces
// ----------------------------
export interface IMessageQueue {}
export interface IStateManager {}
export interface IAgentConfig {}
export interface ICache {}
export interface IMetrics {}
export interface IUserProfileService {}
export interface IConversationHistoryService {}

// ----------------------------
// Agent Interfaces
// ----------------------------
export interface IAgentDependencies {
  readonly logger: ILogger;
  readonly messageQueue: IMessageQueue;
  readonly stateManager: IStateManager;
  readonly config: IAgentConfig;
  readonly cache?: ICache;
  readonly metrics?: IMetrics;
}

export interface ICommunicatingAgentDependencies extends IAgentDependencies {
  communicationBus: EnhancedAgentCommunicationBus;
}

export interface ISommelierCoordinatorDependencies extends IAgentDependencies {
  communicationBus: EnhancedAgentCommunicationBus; // Changed to EnhancedAgentCommunicationBus
  deadLetterProcessor: IDeadLetterProcessor;
  userProfileService: IUserProfileService;
  conversationHistoryService: IConversationHistoryService;
}

// ----------------------------
// Agent Specific Interfaces
// ----------------------------
export interface IAgentRegistry {} // Interface for AgentRegistry

// Agent Configuration Interfaces
export interface AdminConversationalAgentConfig {}
export interface ExplanationAgentConfig {}
export interface FallbackAgentConfig {}
export interface InputValidationAgentConfig {}
export interface LLMPreferenceExtractorAgentConfig {} // Added
export interface LLMRecommendationAgentConfig {}
export interface MCPAdapterAgentConfig {}
export interface RecommendationAgentConfig {}
export interface ShopperAgentConfig {}
export interface SommelierCoordinatorConfig {}
export interface UserPreferenceAgentConfig {}
export interface ValueAnalysisAgentConfig {}

// ----------------------------
// Type Registry
// ----------------------------
export const TYPES = {
  // Core infrastructure
  Logger: createSymbol<ILogger>('Logger'),
  FileSystem: createSymbol<IFileSystem>('FileSystem'),
  Path: createSymbol<IPath>('Path'),
  HttpClient: createSymbol<IHttpClient>('HttpClient'),
  CircuitOptions: createSymbol<ICircuitOptions>('CircuitOptions'),
  CircuitBreaker: createSymbol<ICircuitBreaker>('CircuitBreaker'),
  DeadLetterProcessor: createSymbol<IDeadLetterProcessor>('DeadLetterProcessor'),
  AgentCommunicationBus: createSymbol<IAgentCommunicationBus>('AgentCommunicationBus'),
  Config: createSymbol<IConfig>('Config'),
  PerformanceTracker: createSymbol<IPerformanceTracker>('PerformanceTracker'),
  HealthChecks: createSymbol<IHealthChecks>('HealthChecks'),
  ShutdownHandlers: createSymbol<IShutdownHandlers>('ShutdownHandlers'),
  UserProfileService: createSymbol<IUserProfileService>('UserProfileService'),
  ConversationHistoryService: createSymbol<IConversationHistoryService>('ConversationHistoryService'),
  FeatureFlags: createSymbol<FeatureFlags>('FeatureFlags'),
  
  // Database
  Neo4jDriver: createSymbol<INeo4jDriver>('Neo4jDriver'),
  Neo4jUri: createSymbol<string>('Neo4jUri'),
  Neo4jUser: createSymbol<string>('Neo4jUser'),
  Neo4jPassword: createSymbol<string>('Neo4jPassword'),
  Neo4jCircuitWrapper: createSymbol<INeo4jCircuitWrapper>('Neo4jCircuitWrapper'),
  Neo4jService: createSymbol<INeo4jService>('Neo4jService'),
  
  // LLM
  LlmApiUrl: createSymbol<string>('LlmApiUrl'),
  LlmModel: createSymbol<string>('LlmModel'),
  LlmApiKey: createSymbol<string>('LlmApiKey'),
  LlmMaxRetries: createSymbol<number>('LlmMaxRetries'),
  LlmRetryDelayMs: createSymbol<number>('LlmRetryDelayMs'),
  DucklingUrl: createSymbol<string>('DucklingUrl'),
  LLMService: createSymbol<ILLMService>('LLMService'),
  
  // Recommendation
  CollaborativeFilteringStrategy: createSymbol<ICollaborativeFilteringStrategy>('CollaborativeFilteringStrategy'),
  ISearchStrategy: createSymbol<ISearchStrategy>('ISearchStrategy'),
  IRecommendationStrategy: createSymbol<IRecommendationStrategy>('IRecommendationStrategy'),
  PopularWinesStrategy: createSymbol<IPopularWinesStrategy>('PopularWinesStrategy'),
  UserPreferencesStrategy: createSymbol<IUserPreferencesStrategy>('UserPreferencesStrategy'),
  
  // Services
  KnowledgeGraphService: createSymbol<IKnowledgeGraphService>('KnowledgeGraphService'),
  PreferenceExtractionService: createSymbol<IPreferenceExtractionService>('PreferenceExtractionService'),
  PreferenceNormalizationService: createSymbol<IPreferenceNormalizationService>('PreferenceNormalizationService'),
  RecommendationService: createSymbol<IRecommendationService>('RecommendationService'),
  AdminPreferenceService: createSymbol<IAdminPreferenceService>('AdminPreferenceService'),
  PromptManager: createSymbol<IPromptManager>('PromptManager'),
  PromptManagerConfig: createSymbol<IPromptManagerConfig>('PromptManagerConfig'),
  WineRepository: createSymbol<IWineRepository>('WineRepository'),
  WineService: createSymbol<IWineService>('WineService'),
  
  // Agents
  AgentDependencies: createSymbol<IAgentDependencies>('AgentDependencies'),
  CommunicatingAgentDependencies: createSymbol<ICommunicatingAgentDependencies>('CommunicatingAgentDependencies'), // Added
  SommelierCoordinatorDependencies: createSymbol<ISommelierCoordinatorDependencies>('SommelierCoordinatorDependencies'),

  // Agent Specific
  AgentRegistry: createSymbol<IAgentRegistry>('AgentRegistry'),
  ContainerManager: createSymbol<IContainerManager>('ContainerManager'),
  AdminConversationalAgent: createSymbol<AdminConversationalAgent>('AdminConversationalAgent'),
  ExplanationAgent: createSymbol<ExplanationAgent>('ExplanationAgent'),
  FallbackAgent: createSymbol<FallbackAgent>('FallbackAgent'),
  InputValidationAgent: createSymbol<InputValidationAgent>('InputValidationAgent'),
  LLMPreferenceExtractorAgent: createSymbol<LLMPreferenceExtractorAgent>('LLMPreferenceExtractorAgent'),
  LLMRecommendationAgent: createSymbol<LLMRecommendationAgent>('LLMRecommendationAgent'),
  MCPAdapterAgent: createSymbol<MCPAdapterAgent>('MCPAdapterAgent'),
  RecommendationAgent: createSymbol<RecommendationAgent>('RecommendationAgent'),
  ShopperAgent: createSymbol<ShopperAgent>('ShopperAgent'),
  SommelierCoordinator: createSymbol<SommelierCoordinator>('SommelierCoordinator'),
  UserPreferenceAgent: createSymbol<UserPreferenceAgent>('UserPreferenceAgent'),
  ValueAnalysisAgent: createSymbol<ValueAnalysisAgent>('ValueAnalysisAgent'),

  // Agent Configurations
  AdminConversationalAgentConfig: createSymbol<AdminConversationalAgentConfig>('AdminConversationalAgentConfig'),
  ExplanationAgentConfig: createSymbol<ExplanationAgentConfig>('ExplanationAgentConfig'),
  FallbackAgentConfig: createSymbol<FallbackAgentConfig>('FallbackAgentConfig'),
  InputValidationAgentConfig: createSymbol<InputValidationAgentConfig>('InputValidationAgentConfig'),
  LLMPreferenceExtractorAgentConfig: createSymbol<LLMPreferenceExtractorAgentConfig>('LLMPreferenceExtractorAgentConfig'), // Added
  LLMRecommendationAgentConfig: createSymbol<LLMRecommendationAgentConfig>('LLMRecommendationAgentConfig'),
  MCPAdapterAgentConfig: createSymbol<MCPAdapterAgentConfig>('MCPAdapterAgentConfig'),
  RecommendationAgentConfig: createSymbol<RecommendationAgentConfig>('RecommendationAgentConfig'),
  ShopperAgentConfig: createSymbol<ShopperAgentConfig>('ShopperAgentConfig'),
  SommelierCoordinatorConfig: createSymbol<SommelierCoordinatorConfig>('SommelierCoordinatorConfig'),
  UserPreferenceAgentConfig: createSymbol<UserPreferenceAgentConfig>('UserPreferenceAgentConfig'),
  ValueAnalysisAgentConfig: createSymbol<ValueAnalysisAgentConfig>('ValueAnalysisAgentConfig'),
} as const;

export type TypeKeys = keyof typeof TYPES;

