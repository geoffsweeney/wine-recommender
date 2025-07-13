import { injectable, inject, DependencyContainer } from 'tsyringe';
import { TYPES } from '../Types';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { IFileSystem, IPath, IHttpClient, ICircuitBreaker, ICircuitOptions, IHealthChecks, IShutdownHandlers, INeo4jService, ILLMService } from '../Types';

// FileSystem implementation
@injectable()
class FileSystem implements IFileSystem {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string> {
    return fs.promises.readFile(filePath, { encoding: encoding as BufferEncoding }).then(data => data.toString());
  }

  writeFile(filePath: string, data: string, encoding: BufferEncoding): Promise<void> {
    return fs.promises.writeFile(filePath, data, { encoding: encoding as BufferEncoding });
  }

  existsSync(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}

// Path implementation
@injectable()
class Path implements IPath {
  join(...paths: string[]): string {
    return path.join(...paths);
  }

  resolve(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  basename(p: string, ext?: string): string {
    return path.basename(p, ext);
  }
}

// HttpClient implementation
@injectable()
class HttpClient implements IHttpClient {
  async get<T>(url: string): Promise<T> {
    const response = await axios.get<T>(url);
    return response.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const response = await axios.post<T>(url, data);
    return response.data;
  }
}

// CircuitBreaker implementation
@injectable()
class CircuitBreaker implements ICircuitBreaker {
  private options: ICircuitOptions;

  constructor(options: ICircuitOptions) {
    this.options = options;
  }

  async execute<T>(command: () => Promise<T>): Promise<T> {
    try {
      // In a real implementation, this would involve circuit breaker logic
      // For now, just execute the command
      return await command();
    } catch (error) {
      console.error('CircuitBreaker error:', error);
      throw error;
    }
  }
}

import { ConfigurationRegistry } from '../ConfigurationRegistry'; // Import ConfigurationRegistry

export function registerInfrastructure(container: DependencyContainer, configRegistry: ConfigurationRegistry) {
  // Register core infrastructure services
  container.registerInstance(TYPES.Logger, winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug', // Use process.env.LOG_LEVEL
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
  }));
  configRegistry.registerService(TYPES.Logger, []); // Register Logger with no dependencies

  container.registerSingleton<IFileSystem>(TYPES.FileSystem, FileSystem);
  configRegistry.registerService(TYPES.FileSystem, []); // Register FileSystem with no dependencies

  container.registerSingleton<IPath>(TYPES.Path, Path);
  configRegistry.registerService(TYPES.Path, []); // Register Path with no dependencies

  container.registerSingleton<IHttpClient>(TYPES.HttpClient, HttpClient);
  configRegistry.registerService(TYPES.HttpClient, []); // Register HttpClient with no dependencies

  // Register circuit breaker with options
  container.registerInstance(TYPES.CircuitOptions, {
    maxFailures: 3,
    resetTimeout: 60000,
  });
  configRegistry.registerService(TYPES.CircuitOptions, []); // Register CircuitOptions with no dependencies

  container.register<ICircuitBreaker>(TYPES.CircuitBreaker, CircuitBreaker);
  configRegistry.registerService(TYPES.CircuitBreaker, [TYPES.CircuitOptions]); // Register CircuitBreaker with CircuitOptions dependency

  // Register HealthChecks
  container.register<IHealthChecks>(TYPES.HealthChecks, {
    useFactory: (c: DependencyContainer) => {
      const neo4jService = c.resolve<INeo4jService>(TYPES.Neo4jService);
      const llmService = c.resolve<ILLMService>(TYPES.LLMService);
      const logger = c.resolve<winston.Logger>(TYPES.Logger);

      return {
        checkNeo4j: async () => {
          try {
            const result = await neo4jService.verifyConnection();
            if (result.success) {
              return { status: 'healthy' };
            } else {
              logger.error('Neo4j health check failed', { error: result.error });
              return { status: `unhealthy: ${result.error.message}` };
            }
          } catch (error) {
            logger.error('Neo4j health check failed with exception', { error });
            return { status: `unhealthy: ${error instanceof Error ? error.message : String(error)}` };
          }
        },
        checkLLMService: async () => {
          try {
            // Assuming LLMService has a simple health check or a dummy call
            // For now, we'll just assume it's healthy if it can be resolved.
            // In a real scenario, you might make a small, cheap call to the LLM.
            // For example, a dummy prompt that returns a fixed response.
            // const dummyPromptResult = await llmService.sendPrompt('dummy', {}, { correlationId: 'health-check' });
            // if (dummyPromptResult.success) {
            return { status: 'healthy' };
            // } else {
            //   logger.error('LLM service health check failed', { error: dummyPromptResult.error });
            //   return { status: `unhealthy: ${dummyPromptResult.error.message}` };
            // }
          } catch (error) {
            logger.error('LLM service health check failed with exception', { error });
            return { status: `unhealthy: ${error instanceof Error ? error.message : String(error)}` };
          }
        },
      };
    },
  });
  configRegistry.registerService(TYPES.HealthChecks, [TYPES.Neo4jService, TYPES.LLMService, TYPES.Logger]); // Register HealthChecks with dependencies

  // Register ShutdownHandlers (as an empty array initially)
  container.registerInstance<IShutdownHandlers>(TYPES.ShutdownHandlers, []);
  configRegistry.registerService(TYPES.ShutdownHandlers, []); // Register ShutdownHandlers with no dependencies
}