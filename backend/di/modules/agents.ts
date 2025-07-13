import { injectable, inject, DependencyContainer } from 'tsyringe';
import { TYPES, createSymbol } from '../Types'; // Import createSymbol
import { AgentCommunicationBus } from '../../core/AgentCommunicationBus';
import { BasicDeadLetterProcessor } from '../../core/DeadLetterProcessor';
import { AgentRegistry } from '../../core/agents/AgentRegistry';
import { AdminConversationalAgent } from '../../core/agents/AdminConversationalAgent';
import { ExplanationAgent } from '../../core/agents/ExplanationAgent';
import { FallbackAgent } from '../../core/agents/FallbackAgent';
import { InputValidationAgent } from '../../core/agents/InputValidationAgent';
import { LLMPreferenceExtractorAgent } from '../../core/agents/LLMPreferenceExtractorAgent';
import { LLMRecommendationAgent } from '../../core/agents/LLMRecommendationAgent';
import { MCPAdapterAgent } from '../../core/agents/MCPAdapterAgent';
import { RecommendationAgent } from '../../core/agents/RecommendationAgent';
import { ShopperAgent } from '../../core/agents/ShopperAgent';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator';
import { UserPreferenceAgent } from '../../core/agents/UserPreferenceAgent';
import { ValueAnalysisAgent } from '../../core/agents/ValueAnalysisAgent';
import { ConfigurationRegistry } from '../ConfigurationRegistry';
import {
  IAgentCommunicationBus,
  IDeadLetterProcessor,
  IAgentRegistry,
  ILogger,
  ILLMService,
  IPromptManager,
  IKnowledgeGraphService,
  IUserProfileService,
  IPreferenceExtractionService,
  IPreferenceNormalizationService,
  IRecommendationService,
  IAdminPreferenceService,
  IConversationHistoryService,
  IAgentDependencies,
  ISommelierCoordinatorDependencies,
  AdminConversationalAgentConfig,
  ExplanationAgentConfig,
  FallbackAgentConfig,
  InputValidationAgentConfig,
  LLMRecommendationAgentConfig,
  MCPAdapterAgentConfig,
  RecommendationAgentConfig,
  ShopperAgentConfig,
  SommelierCoordinatorConfig,
  UserPreferenceAgentConfig,
  ValueAnalysisAgentConfig,
} from '../Types';

export function registerAgents(container: DependencyContainer, configRegistry: ConfigurationRegistry) {
  // Core Agent Infrastructure
  container.registerSingleton<IAgentCommunicationBus>(TYPES.AgentCommunicationBus, AgentCommunicationBus);
  configRegistry.registerService(TYPES.AgentCommunicationBus, []);

  container.registerSingleton<IDeadLetterProcessor>(TYPES.DeadLetterProcessor, BasicDeadLetterProcessor);
  configRegistry.registerService(TYPES.DeadLetterProcessor, []);

  // Agent Configurations (placeholders)
  container.registerInstance(TYPES.AdminConversationalAgentConfig, {});
  configRegistry.registerService(createSymbol<AdminConversationalAgentConfig>('AdminConversationalAgentConfig'), []);
  container.registerInstance(TYPES.ExplanationAgentConfig, {});
  configRegistry.registerService(createSymbol<ExplanationAgentConfig>('ExplanationAgentConfig'), []);
  container.registerInstance(TYPES.FallbackAgentConfig, {});
  configRegistry.registerService(createSymbol<FallbackAgentConfig>('FallbackAgentConfig'), []);
  container.registerInstance(TYPES.InputValidationAgentConfig, {});
  configRegistry.registerService(createSymbol<InputValidationAgentConfig>('InputValidationAgentConfig'), []);
  container.registerInstance(TYPES.LLMRecommendationAgentConfig, {});
  configRegistry.registerService(createSymbol<LLMRecommendationAgentConfig>('LLMRecommendationAgentConfig'), []);
  container.registerInstance(TYPES.MCPAdapterAgentConfig, {});
  configRegistry.registerService(createSymbol<MCPAdapterAgentConfig>('MCPAdapterAgentConfig'), []);
  container.registerInstance(TYPES.RecommendationAgentConfig, {});
  configRegistry.registerService(createSymbol<RecommendationAgentConfig>('RecommendationAgentConfig'), []);
  container.registerInstance(TYPES.ShopperAgentConfig, {});
  configRegistry.registerService(createSymbol<ShopperAgentConfig>('ShopperAgentConfig'), []);
  container.registerInstance(TYPES.SommelierCoordinatorConfig, {});
  configRegistry.registerService(createSymbol<SommelierCoordinatorConfig>('SommelierCoordinatorConfig'), []);
  container.registerInstance(TYPES.UserPreferenceAgentConfig, {});
  configRegistry.registerService(createSymbol<UserPreferenceAgentConfig>('UserPreferenceAgentConfig'), []);
  container.registerInstance(TYPES.ValueAnalysisAgentConfig, {});
  configRegistry.registerService(createSymbol<ValueAnalysisAgentConfig>('ValueAnalysisAgentConfig'), []);

  // Register individual agents
  container.registerSingleton(AdminConversationalAgent);
  configRegistry.registerService(TYPES.AdminConversationalAgent, [TYPES.AdminConversationalAgentConfig, TYPES.LLMService, TYPES.PromptManager, TYPES.AdminPreferenceService, TYPES.KnowledgeGraphService, TYPES.UserProfileService, TYPES.FeatureFlags]);

  container.registerSingleton(ExplanationAgent);
  configRegistry.registerService(TYPES.ExplanationAgent, [TYPES.ExplanationAgentConfig, TYPES.LLMService, TYPES.PromptManager]);

  container.registerSingleton(FallbackAgent);
  configRegistry.registerService(TYPES.FallbackAgent, [TYPES.FallbackAgentConfig, TYPES.LLMService]);

  container.registerSingleton(InputValidationAgent);
  configRegistry.registerService(TYPES.InputValidationAgent, [TYPES.InputValidationAgentConfig, TYPES.LLMService, TYPES.PromptManager, TYPES.UserProfileService, TYPES.PreferenceNormalizationService]);

  container.registerSingleton(LLMPreferenceExtractorAgent);
  configRegistry.registerService(TYPES.LLMPreferenceExtractorAgent, [TYPES.LLMPreferenceExtractorAgentConfig, TYPES.LLMService, TYPES.PromptManager, TYPES.KnowledgeGraphService, TYPES.PreferenceNormalizationService, TYPES.UserProfileService]);

  container.registerSingleton(LLMRecommendationAgent);
  configRegistry.registerService(TYPES.LLMRecommendationAgent, [TYPES.LLMRecommendationAgentConfig, TYPES.LLMService, TYPES.PromptManager]);

  container.registerSingleton(MCPAdapterAgent);
  configRegistry.registerService(TYPES.MCPAdapterAgent, [TYPES.MCPAdapterAgentConfig]);

  container.registerSingleton(RecommendationAgent);
  configRegistry.registerService(TYPES.RecommendationAgent, [TYPES.RecommendationAgentConfig, TYPES.LLMService, TYPES.PromptManager, TYPES.KnowledgeGraphService]);

  container.registerSingleton(ShopperAgent);
  configRegistry.registerService(TYPES.ShopperAgent, [TYPES.ShopperAgentConfig, TYPES.KnowledgeGraphService]);

  container.registerSingleton(UserPreferenceAgent);
  configRegistry.registerService(TYPES.UserPreferenceAgent, [TYPES.UserPreferenceAgentConfig, TYPES.LLMService, TYPES.PromptManager, TYPES.UserProfileService, TYPES.PreferenceExtractionService, TYPES.PreferenceNormalizationService]);

  container.registerSingleton(ValueAnalysisAgent);
  configRegistry.registerService(TYPES.ValueAnalysisAgent, [TYPES.ValueAnalysisAgentConfig, TYPES.LLMService, TYPES.PromptManager]);

  // Register AgentRegistry (depends on other agents)
  container.registerSingleton<IAgentRegistry>(TYPES.AgentRegistry, AgentRegistry);
  configRegistry.registerService(TYPES.AgentRegistry, [
    TYPES.Logger,
    TYPES.SommelierCoordinator,
    TYPES.UserPreferenceAgent,
    TYPES.LLMPreferenceExtractorAgent,
    TYPES.RecommendationAgent,
    TYPES.ExplanationAgent,
    TYPES.InputValidationAgent,
    TYPES.FallbackAgent,
    TYPES.MCPAdapterAgent,
    TYPES.ValueAnalysisAgent,
    TYPES.AdminConversationalAgent,
    TYPES.ShopperAgent,
  ]);

  // Register SommelierCoordinator (depends on many agents and services)
  container.registerSingleton(SommelierCoordinator);
  configRegistry.registerService(TYPES.SommelierCoordinator, [
    TYPES.SommelierCoordinatorConfig,
    TYPES.Logger,
    TYPES.AgentCommunicationBus,
    TYPES.DeadLetterProcessor,
    TYPES.UserProfileService,
    TYPES.ConversationHistoryService,
    TYPES.LLMService,
    TYPES.PromptManager,
    TYPES.RecommendationService,
    TYPES.AdminPreferenceService,
    TYPES.PreferenceExtractionService,
    TYPES.PreferenceNormalizationService,
    TYPES.InputValidationAgent,
    TYPES.ExplanationAgent,
    TYPES.FallbackAgent,
    TYPES.MCPAdapterAgent,
    TYPES.ValueAnalysisAgent,
    TYPES.ShopperAgent,
    TYPES.LLMPreferenceExtractorAgent,
  ]);
}
