import { injectable, DependencyContainer } from 'tsyringe';
import { TYPES } from '../Types';
import { LLMService } from '../../services/LLMService';
import { Neo4jService } from '../../services/Neo4jService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PromptManager } from '../../services/PromptManager';
import { Neo4jCircuitWrapper } from '../../services/Neo4jCircuitWrapper';
import { Neo4jWineRepository } from '../../services/Neo4jWineRepository';
import { ConfigurationRegistry } from '../ConfigurationRegistry'; // Import ConfigurationRegistry
import {
  ILLMService,
  INeo4jService,
  IKnowledgeGraphService,
  IPromptManager,
  INeo4jCircuitWrapper,
  IWineRepository,
  ILogger,
  ICircuitOptions,
  IFileSystem,
  IPath,
  IPromptManagerConfig,
} from '../Types';
import neo4j from 'neo4j-driver';

export function registerServices(container: DependencyContainer, configRegistry: ConfigurationRegistry) {
  // Placeholder for Neo4j Driver - will be properly configured later
  container.registerInstance(TYPES.Neo4jDriver, neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password')));
  configRegistry.registerService(TYPES.Neo4jDriver, []);

  // Register Neo4jCircuitWrapper
  container.registerSingleton<INeo4jCircuitWrapper>(TYPES.Neo4jCircuitWrapper, Neo4jCircuitWrapper);
  configRegistry.registerService(TYPES.Neo4jCircuitWrapper, [TYPES.Neo4jDriver, TYPES.CircuitOptions, TYPES.Logger]);

  // Register Neo4jService
  container.registerSingleton<INeo4jService>(TYPES.Neo4jService, Neo4jService);
  configRegistry.registerService(TYPES.Neo4jService, [TYPES.Neo4jUri, TYPES.Neo4jUser, TYPES.Neo4jPassword, TYPES.Neo4jCircuitWrapper, TYPES.Logger]);

  // Register KnowledgeGraphService
  container.registerSingleton<IKnowledgeGraphService>(TYPES.KnowledgeGraphService, KnowledgeGraphService);
  configRegistry.registerService(TYPES.KnowledgeGraphService, [TYPES.Neo4jService, TYPES.Logger]);

  // Register PromptManagerConfig placeholder
  container.registerInstance<IPromptManagerConfig>(TYPES.PromptManagerConfig, {
    baseDir: './backend/prompts',
    defaultVersion: 'v2',
    enableCaching: true,
    enableValidation: true,
    watchForChanges: false,
  });
  configRegistry.registerService(TYPES.PromptManagerConfig, []);

  // Register PromptManager
  container.registerSingleton<IPromptManager>(TYPES.PromptManager, PromptManager);
  configRegistry.registerService(TYPES.PromptManager, [TYPES.Logger, TYPES.FileSystem, TYPES.Path, TYPES.PromptManagerConfig]);

  // Register LLMService configuration placeholders
  container.registerInstance<string>(TYPES.LlmApiUrl, 'http://localhost:11434');
  configRegistry.registerService(TYPES.LlmApiUrl, []);
  container.registerInstance<string>(TYPES.LlmModel, 'llama3');
  configRegistry.registerService(TYPES.LlmModel, []);
  container.registerInstance<string>(TYPES.LlmApiKey, 'ollama-api-key-placeholder');
  configRegistry.registerService(TYPES.LlmApiKey, []);

  // Register LLMService
  container.registerSingleton<ILLMService>(TYPES.LLMService, LLMService);
  configRegistry.registerService(TYPES.LLMService, [TYPES.PromptManager, TYPES.Logger, TYPES.LlmApiUrl, TYPES.LlmModel, TYPES.LlmApiKey]);

  // Register Wine Repository
  container.registerSingleton<IWineRepository>(TYPES.WineRepository, Neo4jWineRepository);
  configRegistry.registerService(TYPES.WineRepository, [TYPES.Neo4jService, TYPES.Logger]);
}