import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
import { Driver } from 'neo4j-driver';
import neo4j from 'neo4j-driver';
import winston from 'winston';
import axios from 'axios'; // Import axios
import { TYPES } from './Types';
import { Neo4jCircuitWrapper } from '../services/Neo4jCircuitWrapper';
import { Neo4jService } from '../services/Neo4jService';
import { CircuitOptions } from '../core/CircuitBreaker';
import { LLMService } from '../services/LLMService';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService';
import { PreferenceExtractionService } from '../services/PreferenceExtractionService';
import { PreferenceNormalizationService } from '../services/PreferenceNormalizationService';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator';
import { InputValidationAgent } from '../core/agents/InputValidationAgent';
import { ValueAnalysisAgent } from '../core/agents/ValueAnalysisAgent';
import { LLMRecommendationAgent } from '../core/agents/LLMRecommendationAgent';
import { UserPreferenceAgent } from '../core/agents/UserPreferenceAgent';
import { RecommendationAgent } from '../core/agents/RecommendationAgent';
import { ExplanationAgent } from '../core/agents/ExplanationAgent';
import { FallbackAgent } from '../core/agents/FallbackAgent';
import { LLMPreferenceExtractorAgent } from '../core/agents/LLMPreferenceExtractorAgent';
import { MCPAdapterAgent } from '../core/agents/MCPAdapterAgent';
import { UserProfileService } from '../services/UserProfileService';
import { ConversationHistoryService } from '../core/ConversationHistoryService';
import { BasicDeadLetterProcessor } from '../core/BasicDeadLetterProcessor';

export function setupContainer() {
  // Environment configuration
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';
  const llmApiUrl = process.env.LLM_API_URL || 'http://localhost:5000';
  const llmApiKey = process.env.LLM_API_KEY || '';
  const llmModel = process.env.LLM_MODEL || 'gpt-3.5-turbo';

  // Logger setup
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
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

  // Register UserProfileService and ConversationHistoryService as singletons
  container.registerSingleton(UserProfileService);
  container.registerSingleton(ConversationHistoryService);

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

  // Register communication bus and agents
  container.registerSingleton(TYPES.AgentCommunicationBus, EnhancedAgentCommunicationBus);
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
    agentTimeoutMs: parseInt(process.env.SOMMELIER_AGENT_TIMEOUT_MS || '5000'),
    circuitBreakerFailureThreshold: parseInt(process.env.SOMMELIER_CIRCUIT_FAILURE_THRESHOLD || '5'),
    circuitBreakerSuccessThreshold: parseInt(process.env.SOMMELIER_CIRCUIT_SUCCESS_THRESHOLD || '3'),
  };
  container.registerInstance(TYPES.SommelierCoordinatorConfig, sommelierCoordinatorConfig);
  container.registerInstance(TYPES.SommelierCoordinatorId, 'sommelier-coordinator');

  // Register SommelierCoordinatorDependencies
  container.register(TYPES.SommelierCoordinatorDependencies, {
    useFactory: (c: DependencyContainer) => ({
      communicationBus: c.resolve(TYPES.AgentCommunicationBus),
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

  return container;
}

export { container };