import "reflect-metadata";
import express from 'express'; // Import express
import cors from 'cors'; // Import cors middleware
import { LLMService } from './services/LLMService'; // Adjust the import path to the actual location of LLMService
import { container } from 'tsyringe'; // Ensure tsyringe is imported for dependency injection
import { AgentCommunicationBus } from './core/AgentCommunicationBus'; // Adjust the import path as necessary
import { Neo4jService } from './services/Neo4jService'; // Import Neo4jService
import { KnowledgeGraphService } from './services/KnowledgeGraphService'; // Import KnowledgeGraphService

import { InMemoryDeadLetterQueue } from './core/InMemoryDeadLetterQueue'; // Import InMemoryDeadLetterQueue
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from './core/BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor and LoggingDeadLetterHandler
import { BasicRetryManager } from './core/BasicRetryManager'; // Import BasicRetryManager
import { logger } from './utils/logger'; // Import the logger

// Function to register dependencies with the tsyringe container
const registerDependencies = () => {
  // Register LLM API URL and Model as injectable values
  container.registerInstance('llmApiUrl', 'http://localhost:11434');
  container.registerInstance('llmModel', 'llama3.1:latest');
  container.registerInstance('llmApiKey', '');
  container.registerSingleton('LLMService', LLMService);
  // Note: apiKey is not registered here as it's an optional parameter in LLMService constructor

  // Instantiate and register AgentCommunicationBus
  // Resolve LLMService by its type, which will now be constructed by tsyringe
  const agentCommunicationBus = new AgentCommunicationBus(container.resolve(LLMService));
  container.registerInstance(AgentCommunicationBus, agentCommunicationBus);

  // Instantiate and register Neo4jService
  const neo4jService = new Neo4jService(); // Assuming Neo4jService has no dependencies
  container.registerInstance(Neo4jService, neo4jService); // Register with the class token

  // Instantiate and register KnowledgeGraphService
  const knowledgeGraphService = new KnowledgeGraphService(neo4jService); // Pass Neo4jService instance
  container.registerInstance('KnowledgeGraphService', knowledgeGraphService);

  const deadLetterQueue = new InMemoryDeadLetterQueue();
  container.registerInstance('DeadLetterQueue', deadLetterQueue); // Assuming it's registered with a string token

  const loggingDeadLetterHandler = new LoggingDeadLetterHandler();
  container.registerInstance(LoggingDeadLetterHandler, loggingDeadLetterHandler); // Register with the class token

  const retryManager = new BasicRetryManager();
  container.registerInstance(BasicRetryManager, retryManager); // Register with the class token

  // Instantiate and register DeadLetterProcessor (using BasicDeadLetterProcessor implementation)
  const deadLetterProcessor = new BasicDeadLetterProcessor(deadLetterQueue, loggingDeadLetterHandler, retryManager); // Pass all three dependencies
  container.registerInstance('DeadLetterProcessor', deadLetterProcessor); // Register with the string token

  // Register the logger
  container.registerInstance('logger', logger);
};

// Register dependencies before importing the router
registerDependencies();

import { createRouter } from './api/routes'; // Import the API router
import apiRateLimiter from './api/middleware/rateLimiter'; // Import rate limiter middleware


// Create and configure the Express application
const app = express();
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON bodies

// Define routes here
// Example: app.use('/api/recommendations', recommendationsRouter);

// Function to create and return the server
import { Request, Response, NextFunction } from 'express'; // Import types

app.use('/api', apiRateLimiter, createRouter()); // Apply rate limiter middleware to /api routes
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
export const createServer = () => {
  const app = express();
  app.use(cors()); // Enable CORS for all origins
  app.use(express.json());

  // Register dependencies for the test environment
  registerDependencies();

  app.use('/api', apiRateLimiter, createRouter());

  return app;
};