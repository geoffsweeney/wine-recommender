import axios from 'axios'; // Import axios
import * as fs from 'fs/promises'; // Import fs/promises
import neo4j from 'neo4j-driver';
import * as path from 'path'; // Import path
import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
import winston from 'winston';
import { AdminCommandController } from '../api/controllers/AdminCommandController'; // Import AdminCommandController
import { featureFlags } from '../config/featureFlags'; // Import featureFlags
import { AdminConversationalAgent, AdminConversationalAgentConfig } from '../core/agents/AdminConversationalAgent'; // Import AdminConversationalAgent
import { AgentRegistry } from '../core/agents/AgentRegistry';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import { ExplanationAgent } from '../core/agents/ExplanationAgent';
import { FallbackAgent } from '../core/agents/FallbackAgent';
import { InputValidationAgent } from '../core/agents/InputValidationAgent';
import { LLMPreferenceExtractorAgent } from '../core/agents/LLMPreferenceExtractorAgent';
import { LLMRecommendationAgent } from '../core/agents/LLMRecommendationAgent';
import { MCPAdapterAgent } from '../core/agents/MCPAdapterAgent';
import { RecommendationAgent } from '../core/agents/RecommendationAgent';
import { ShopperAgent } from '../core/agents/ShopperAgent'; // Import ShopperAgent
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator';
import { UserPreferenceAgent } from '../core/agents/UserPreferenceAgent';
import { ValueAnalysisAgent } from '../core/agents/ValueAnalysisAgent';
import { CircuitOptions } from '../core/CircuitBreaker';
import { ConversationHistoryService } from '../core/ConversationHistoryService';
import { BasicDeadLetterProcessor } from '../core/DeadLetterProcessor';
import { AdminPreferenceService } from '../services/AdminPreferenceService'; // Import AdminPreferenceService
import { KnowledgeGraphService } from '../services/KnowledgeGraphService';
import { LLMService } from '../services/LLMService';
import { Neo4jCircuitWrapper } from '../services/Neo4jCircuitWrapper';
import { Neo4jService } from '../services/Neo4jService';
import { Neo4jWineRepository } from '../services/Neo4jWineRepository'; // Import Neo4jWineRepository
import { PreferenceExtractionService } from '../services/PreferenceExtractionService';
import { PreferenceNormalizationService } from '../services/PreferenceNormalizationService';
import { PromptManager, PromptManagerConfig } from '../services/PromptManager'; // Import PromptManager and PromptManagerConfig
import { SimpleSearchStrategy } from '../services/SimpleSearchStrategy'; // Import SimpleSearchStrategy
import { CollaborativeFilteringStrategy } from '../services/strategies/CollaborativeFilteringStrategy'; // Import CollaborativeFilteringStrategy
import { PopularWinesStrategy } from '../services/strategies/PopularWinesStrategy'; // Import PopularWinesStrategy
import { RecommendationStrategyProvider } from '../services/strategies/RecommendationStrategyProvider'; // Import RecommendationStrategyProvider
import { UserPreferencesStrategy } from '../services/strategies/UserPreferencesStrategy'; // Import UserPreferencesStrategy
import { UserProfileService } from '../services/UserProfileService';
import { TYPES } from './Types';

export function setupContainer() {
  // Environment configuration
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';
  const llmApiUrl = process.env.LLM_API_URL || 'http://localhost:11434';
  const llmApiKey = process.env.LLM_API_KEY || '';
  const llmModel = process.env.LLM_MODEL || 'llama3.1:latest';

  // Logger setup
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });

  // Neo4j Driver setup
  const driver = neo4j.driver(
    neo4jUri,
    neo4j.auth.basic(neo4jUser, neo4jPassword),
    {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
      disableLosslessIntegers: false
    }
  );

  // Circuit Breaker options
  const circuitOptions: CircuitOptions = {
    failureThreshold: parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '5'),
    successThreshold: parseInt(process.env.CIRCUIT_SUCCESS_THRESHOLD || '3'),
    timeoutMs: parseInt(process.env.CIRCUIT_TIMEOUT_MS || '60000'),
    fallback: (error: Error) => {
      logger.warn('Circuit breaker fallback triggered', { error: error.message });
      throw new Error(`Service temporarily unavailable: ${error.message}`);
    }
  };

  // Register core dependencies
  container.registerInstance(TYPES.Logger, logger);
  container.registerInstance(TYPES.Neo4jDriver, driver);
  container.registerInstance(TYPES.Neo4jUri, neo4jUri);
  container.registerInstance(TYPES.Neo4jUser, neo4jUser);
  container.registerInstance(TYPES.Neo4jPassword, neo4jPassword);
  container.registerInstance(TYPES.CircuitOptions, circuitOptions);
  container.registerInstance(TYPES.LlmApiUrl, llmApiUrl);
  container.registerInstance(TYPES.LlmApiKey, llmApiKey);
  container.registerInstance(TYPES.LlmModel, llmModel);
  container.registerInstance(TYPES.LlmMaxRetries, parseInt(process.env.LLM_MAX_RETRIES || '3'));
  container.registerInstance(TYPES.LlmRetryDelayMs, parseInt(process.env.LLM_RETRY_DELAY_MS || '1000'));
  container.registerInstance(TYPES.DucklingUrl, process.env.DUCKLING_URL || 'http://localhost:8000'); // Register DucklingUrl
  container.registerInstance(TYPES.HttpClient, axios); // Register HttpClient

  // Register fs and path
  container.registerInstance(TYPES.FileSystem, fs);
  container.registerInstance(TYPES.Path, path);

  // Register services
  container.registerSingleton(TYPES.Neo4jCircuitWrapper, Neo4jCircuitWrapper);
  // Register Neo4jService as a factory to ensure init() is called
  container.register(TYPES.Neo4jService, {
    useFactory: (c: DependencyContainer) => {
      const service = c.resolve(Neo4jService);
      service.init();
      return service;
    },
  });
  container.registerSingleton(TYPES.LLMService, LLMService);
  container.registerSingleton(TYPES.KnowledgeGraphService, KnowledgeGraphService);
  container.registerSingleton(TYPES.PreferenceExtractionService, PreferenceExtractionService);
  container.registerSingleton(TYPES.PreferenceNormalizationService, PreferenceNormalizationService);
  container.registerSingleton(TYPES.AdminPreferenceService, AdminPreferenceService); // Register AdminPreferenceService
  
  // Define PromptManagerConfig
  const promptManagerConfig: PromptManagerConfig = {
    baseDir: path.join(__dirname, '../prompts'), // Default to a 'prompts' directory outside of services
    defaultVersion: 'v1',
    enableCaching: true,
    enableValidation: true,
    watchForChanges: false,
  };
  // Register PromptManagerConfig as an instance
  container.registerInstance(TYPES.PromptManagerConfig, promptManagerConfig);

  // Register PromptManager as a singleton
  container.registerSingleton(TYPES.PromptManager, PromptManager);

  // Register Wine Repository
  container.registerSingleton(TYPES.WineRepository, Neo4jWineRepository);

  // Register Search Strategy
  container.registerSingleton(TYPES.ISearchStrategy, SimpleSearchStrategy);

  // Register individual Recommendation Strategies
  container.registerSingleton(TYPES.UserPreferencesStrategy, UserPreferencesStrategy);
  container.registerSingleton(TYPES.CollaborativeFilteringStrategy, CollaborativeFilteringStrategy);
  container.registerSingleton(TYPES.PopularWinesStrategy, PopularWinesStrategy);

  // Register Recommendation Strategy Provider
  container.registerSingleton(TYPES.IRecommendationStrategy, RecommendationStrategyProvider);

  // Register UserProfileService and ConversationHistoryService as singletons
  container.registerSingleton(TYPES.UserProfileService, UserProfileService);
  container.registerSingleton(TYPES.ConversationHistoryService, ConversationHistoryService);

  // Register DeadLetterProcessor with its concrete implementation
  container.registerSingleton(TYPES.DeadLetterProcessor, BasicDeadLetterProcessor);

  // Define InputValidationAgentConfig
  const inputValidationAgentConfig = {
    ingredientDatabasePath: './data/ingredients.json',
    dietaryRestrictions: ['vegetarian', 'vegan', 'gluten-free', 'kosher', 'halal'],
    standardIngredients: {
      'salmon': 'fish',
      'beef': 'meat',
      // ... other standard mappings
    },
    maxIngredients: 10
  };

  // Register communication bus as a strict singleton
  const bus = container.resolve(EnhancedAgentCommunicationBus);
  container.registerInstance(TYPES.AgentCommunicationBus, bus);
  container.registerInstance(EnhancedAgentCommunicationBus, bus);
  container.registerInstance(TYPES.InputValidationAgentConfig, inputValidationAgentConfig);
  container.registerSingleton(TYPES.InputValidationAgent, InputValidationAgent);

  // Define ValueAnalysisAgentConfig
  const valueAnalysisAgentConfig = {
    defaultTimeoutMs: 5000
  };
  container.registerInstance(TYPES.ValueAnalysisAgentConfig, valueAnalysisAgentConfig);
  container.registerSingleton(TYPES.ValueAnalysisAgent, ValueAnalysisAgent);

  // Define LLMRecommendationAgentConfig
  const llmRecommendationAgentConfig = {
    defaultConfidenceScore: 0.8
  };
  container.registerInstance(TYPES.LLMRecommendationAgentConfig, llmRecommendationAgentConfig);
  container.registerSingleton(TYPES.LLMRecommendationAgent, LLMRecommendationAgent);

  // Define UserPreferenceAgentConfig
  const userPreferenceAgentConfig = {
    defaultConfidenceThreshold: 0.7
  };
  container.registerInstance(TYPES.UserPreferenceAgentConfig, userPreferenceAgentConfig);
  container.registerSingleton(TYPES.UserPreferenceAgent, UserPreferenceAgent);

  // Define RecommendationAgentConfig
  const recommendationAgentConfig = {
    defaultRecommendationCount: 3
  };
  container.registerInstance(TYPES.RecommendationAgentConfig, recommendationAgentConfig);
  container.registerSingleton(TYPES.RecommendationAgent, RecommendationAgent);

  // Define ExplanationAgentConfig
  const explanationAgentConfig = {
    defaultExplanation: 'Here are some recommended wines that match your preferences.'
  };
  container.registerInstance(TYPES.ExplanationAgentConfig, explanationAgentConfig);
  container.registerSingleton(TYPES.ExplanationAgent, ExplanationAgent);

  // Define FallbackAgentConfig
  const fallbackAgentConfig = {
    defaultFallbackResponse: 'Sorry, we encountered an issue. Please try again later.'
  };
  container.registerInstance(TYPES.FallbackAgentConfig, fallbackAgentConfig);
  container.registerSingleton(TYPES.FallbackAgent, FallbackAgent);

  // Define LLMPreferenceExtractorAgentConfig
  const llmPreferenceExtractorAgentConfig = {
    maxRetries: 3
  };
  container.registerInstance(TYPES.LLMPreferenceExtractorAgentConfig, llmPreferenceExtractorAgentConfig);
  container.registerSingleton(TYPES.LLMPreferenceExtractorAgent, LLMPreferenceExtractorAgent);

  // Define MCPAdapterAgentConfig
  const mcpAdapterAgentConfig = {
    defaultToolTimeoutMs: 10000
  };
  container.registerInstance(TYPES.MCPAdapterAgentConfig, mcpAdapterAgentConfig);
  container.registerSingleton(TYPES.MCPAdapterAgent, MCPAdapterAgent);

  // Define ShopperAgentConfig
  const shopperAgentConfig = {
    // Add any specific configuration for ShopperAgent here
  };
  container.registerInstance(TYPES.ShopperAgentConfig, shopperAgentConfig);
  container.registerSingleton(TYPES.ShopperAgent, ShopperAgent);

  // Define AdminConversationalAgentConfig
  const adminConversationalAgentConfig: AdminConversationalAgentConfig = {
    agentId: 'admin-conversational-agent',
  };
  container.registerInstance(TYPES.AdminConversationalAgentConfig, adminConversationalAgentConfig);
  
  // Register FeatureFlags
  container.registerInstance(TYPES.FeatureFlags, featureFlags);

  container.registerSingleton(TYPES.AdminConversationalAgent, AdminConversationalAgent);
  container.registerSingleton(TYPES.AdminCommandController, AdminCommandController); // Register AdminCommandController
 
  // Register generic AgentId and AgentConfig
  container.registerInstance(TYPES.AgentId, 'default-agent-id');
  container.registerInstance(TYPES.AgentConfig, {}); // Empty object for generic config

  // Register AgentDependencies (base)
  container.register(TYPES.AgentDependencies, {
    useFactory: (c: DependencyContainer) => ({
      logger: c.resolve(TYPES.Logger),
      messageQueue: {} as any, // Placeholder
      stateManager: {} as any, // Placeholder
      config: c.resolve(TYPES.AgentConfig),
    }),
  });

  // Register CommunicatingAgentDependencies
  container.register(TYPES.CommunicatingAgentDependencies, {
    useFactory: (c: DependencyContainer) => ({
      communicationBus: c.resolve(TYPES.AgentCommunicationBus),
      logger: c.resolve(TYPES.Logger),
      messageQueue: {} as any, // Placeholder
      stateManager: {} as any, // Placeholder
      config: c.resolve(TYPES.AgentConfig),
    }),
  });

  // Register SommelierCoordinatorConfig
  const sommelierCoordinatorConfig = {
    maxRecommendationAttempts: parseInt(process.env.SOMMELIER_MAX_RECOMMENDATION_ATTEMPTS || '3'),
    agentTimeoutMs: parseInt(process.env.SOMMELIER_AGENT_TIMEOUT_MS || '30000'),
    circuitBreakerFailureThreshold: parseInt(process.env.SOMMELIER_CIRCUIT_FAILURE_THRESHOLD || '5'),
    circuitBreakerSuccessThreshold: parseInt(process.env.SOMMELIER_CIRCUIT_SUCCESS_THRESHOLD || '3'),
  };
  container.registerInstance(TYPES.SommelierCoordinatorConfig, sommelierCoordinatorConfig);
  container.registerInstance(TYPES.SommelierCoordinatorId, 'sommelier-coordinator');

  // Register SommelierCoordinatorDependencies
  container.register(TYPES.SommelierCoordinatorDependencies, {
    useFactory: (c: DependencyContainer) => ({
      communicationBus: c.resolve(TYPES.AgentCommunicationBus) as EnhancedAgentCommunicationBus,
      logger: c.resolve(TYPES.Logger),
      deadLetterProcessor: c.resolve(TYPES.DeadLetterProcessor),
      userProfileService: c.resolve(UserProfileService),
      conversationHistoryService: c.resolve(ConversationHistoryService),
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: c.resolve(TYPES.SommelierCoordinatorConfig), // Use the registered config
    }),
  });

  // Register SommelierCoordinator
  container.registerSingleton(TYPES.SommelierCoordinator, SommelierCoordinator);

  // Register AgentRegistry
  container.registerSingleton(TYPES.AgentRegistry, AgentRegistry);

  // Resolve all agents first to ensure they're instantiated
  container.resolve(InputValidationAgent);
  container.resolve(RecommendationAgent);
  container.resolve(LLMRecommendationAgent);
  container.resolve(ValueAnalysisAgent);
  container.resolve(LLMPreferenceExtractorAgent); // Resolve LLMPreferenceExtractorAgent first
  container.resolve(UserPreferenceAgent); // Then UserPreferenceAgent
  container.resolve(ExplanationAgent);
  container.resolve(FallbackAgent);
  container.resolve(MCPAdapterAgent);
  container.resolve(ShopperAgent); // Resolve ShopperAgent
  container.resolve(AdminConversationalAgent); // Resolve AdminConversationalAgent
  container.resolve(AdminCommandController); // Resolve AdminCommandController
  container.resolve(SommelierCoordinator);

  // Initialize AgentRegistry after all agents are instantiated
  const registry = container.resolve(AgentRegistry);
  registry.registerAgents(container.resolve(EnhancedAgentCommunicationBus));

  // The AgentRegistry registration and agent constructors will handle handler registration

  return container;
}

export { container };
