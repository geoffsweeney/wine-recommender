import { DependencyContainer, container } from 'tsyringe';
import winston from 'winston';
import neo4j from 'neo4j-driver';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

import { TYPES, ILogger, ICircuitOptions, IPromptManagerConfig, INeo4jService, ILLMService, IPromptManager, IAgentCommunicationBus, IAgentRegistry } from './Types';
import { registerInfrastructure } from './modules/infrastructure';
import { registerServices } from './modules/services';
import { registerAgents } from './modules/agents';
import { CircuitOptions } from '../core/CircuitBreaker';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ContainerManager } from './ContainerManager'; // Import ContainerManager

export class DependencySetup {
  private container: DependencyContainer;

  constructor(container: DependencyContainer) {
    this.container = container;
  }

  public async setup(): Promise<void> {
    this.loadEnvironmentVariables();
    this.registerCoreDependencies();
    
    // Register ConfigurationRegistry and pass it to modules
    this.container.registerInstance(TYPES.ContainerManager, await ContainerManager.getInstance()); // Register the singleton instance
    const containerManager = await ContainerManager.getInstance(); // Get the instance

    const configRegistry = new ConfigurationRegistry(containerManager); // Pass the ContainerManager instance
    this.container.registerInstance(ConfigurationRegistry, configRegistry); // Register the instance
    
    this.registerModules(configRegistry); // Pass configRegistry to modules
    
    await this.initializeDependencies();
    configRegistry.validateConfiguration(); // Validate after all registrations
    this.validateDependencies(); // Basic validation
  }

  private loadEnvironmentVariables(): void {
    // Environment configuration
    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUser = process.env.NEO4J_USER || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';
    const llmApiUrl = process.env.LLM_API_URL || 'http://localhost:11434';
    const llmApiKey = process.env.LLM_API_KEY || '';
    const llmModel = process.env.LLM_MODEL || 'llama3.1:latest';
    const llmMaxRetries = parseInt(process.env.LLM_MAX_RETRIES || '3');
    const llmRetryDelayMs = parseInt(process.env.LLM_RETRY_DELAY_MS || '1000');
    const ducklingUrl = process.env.DUCKLING_URL || 'http://localhost:8000';
    const circuitFailureThreshold = parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '5');
    const circuitSuccessThreshold = parseInt(process.env.CIRCUIT_SUCCESS_THRESHOLD || '3');
    const circuitTimeoutMs = parseInt(process.env.CIRCUIT_TIMEOUT_MS || '60000');

    // Register environment variables as instances
    this.container.registerInstance(TYPES.Neo4jUri, neo4jUri);
    this.container.registerInstance(TYPES.Neo4jUser, neo4jUser);
    this.container.registerInstance(TYPES.Neo4jPassword, neo4jPassword);
    this.container.registerInstance(TYPES.LlmApiUrl, llmApiUrl);
    this.container.registerInstance(TYPES.LlmApiKey, llmApiKey);
    this.container.registerInstance(TYPES.LlmModel, llmModel);
    this.container.registerInstance(TYPES.LlmMaxRetries, llmMaxRetries);
    this.container.registerInstance(TYPES.LlmRetryDelayMs, llmRetryDelayMs);
    this.container.registerInstance(TYPES.DucklingUrl, ducklingUrl);

    // Register CircuitOptions
    const circuitOptions: CircuitOptions = {
      failureThreshold: circuitFailureThreshold,
      successThreshold: circuitSuccessThreshold,
      timeoutMs: circuitTimeoutMs,
      fallback: (error: Error) => {
        const logger = this.container.resolve<ILogger>(TYPES.Logger);
        logger.warn('Circuit breaker fallback triggered', { error: error.message });
        throw new Error(`Service temporarily unavailable: ${error.message}`);
      }
    };
    this.container.registerInstance(TYPES.CircuitOptions, circuitOptions);

    // Register PromptManagerConfig
    const promptManagerConfig: IPromptManagerConfig = {
      baseDir: path.join(__dirname, '../prompts'),
      defaultVersion: 'v1',
      enableCaching: true,
      enableValidation: true,
      watchForChanges: false,
    };
    this.container.registerInstance(TYPES.PromptManagerConfig, promptManagerConfig);
  }

  private registerCoreDependencies(): void {
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
    this.container.registerInstance(TYPES.Logger, logger);

    // Register fs and path
    this.container.registerInstance(TYPES.FileSystem, fs);
    this.container.registerInstance(TYPES.Path, path);

    // Register HttpClient (axios)
    this.container.registerInstance(TYPES.HttpClient, axios);

    // Register Neo4j Driver (initial instance, will be managed by Neo4jCircuitWrapper)
    const neo4jUri = this.container.resolve<string>(TYPES.Neo4jUri);
    const neo4jUser = this.container.resolve<string>(TYPES.Neo4jUser);
    const neo4jPassword = this.container.resolve<string>(TYPES.Neo4jPassword);
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
    this.container.registerInstance(TYPES.Neo4jDriver, driver);
  }

  private registerModules(configRegistry: ConfigurationRegistry): void {
    registerInfrastructure(this.container, configRegistry);
    registerServices(this.container, configRegistry);
    registerAgents(this.container, configRegistry);
  }

  private async initializeDependencies(): Promise<void> {
    // Initialize services that require async setup, e.g., database connections
    // Example: await this.container.resolve<INeo4jService>(TYPES.Neo4jService).init();
    // Note: Neo4jService's init() method was removed during refactoring,
    // so this step might not be necessary for Neo4jService anymore.
    // However, other services might require async initialization.
  }

  private validateDependencies(): void {
    const configRegistry = this.container.resolve(ConfigurationRegistry); // Resolve ConfigurationRegistry

    // Validate all registered services
    for (const serviceToken of configRegistry.getAllServiceTokens()) {
      try {
        const instance = this.container.resolve(serviceToken);
        // Basic runtime check: ensure the resolved instance is not null/undefined
        if (instance === undefined || instance === null) {
          throw new Error(`Resolved instance for ${serviceToken.toString()} is null or undefined.`);
        }

        // Further validation: check if the instance has expected properties/methods
        // This is a basic check and can be expanded based on specific interface contracts.
        // For example, if ILogger has a 'log' method, you could check:
        // if (serviceToken === TYPES.Logger && typeof (instance as ILogger).log !== 'function') {
        //   throw new Error(`Logger instance does not have a 'log' method.`);
        // }

      } catch (error) {
        console.error(`Dependency validation failed for ${serviceToken.toString()}:`, error);
        throw new Error(`Dependency validation failed for ${serviceToken.toString()}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log('All registered dependencies validated successfully.');
  }
}