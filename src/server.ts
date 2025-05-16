import "reflect-metadata";
import express from 'express'; // Import express
import { LLMService } from './services/LLMService'; // Adjust the import path to the actual location of LLMService
import { container } from 'tsyringe'; // Ensure tsyringe is imported for dependency injection
import { AgentCommunicationBus } from './core/AgentCommunicationBus'; // Adjust the import path as necessary
import { Neo4jService } from './services/Neo4jService'; // Import Neo4jService
import { KnowledgeGraphService } from './services/KnowledgeGraphService'; // Import KnowledgeGraphService

import { createRouter } from './api/routes'; // Import the API router
import apiRateLimiter from './api/middleware/rateLimiter'; // Import rate limiter middleware

// Instantiate LLMService with actual values
const llmService = new LLMService('http://localhost:11434', 'llama3.1:latest', 'your-api-key');

// Register LLMService
container.registerInstance('LLMService', llmService);

// Instantiate and register AgentCommunicationBus
// Resolve LLMService from the container to ensure mock is used in tests
const agentCommunicationBus = new AgentCommunicationBus(container.resolve('LLMService'));
container.registerInstance(AgentCommunicationBus, agentCommunicationBus);

// Instantiate and register Neo4jService
const neo4jService = new Neo4jService(); // Assuming Neo4jService has no dependencies
container.registerInstance(Neo4jService, neo4jService); // Register with the class token

// Instantiate and register KnowledgeGraphService
const knowledgeGraphService = new KnowledgeGraphService(neo4jService); // Pass Neo4jService instance
container.registerInstance('KnowledgeGraphService', knowledgeGraphService);

import { InMemoryDeadLetterQueue } from './core/InMemoryDeadLetterQueue'; // Import InMemoryDeadLetterQueue
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from './core/BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor and LoggingDeadLetterHandler
import { BasicRetryManager } from './core/BasicRetryManager'; // Import BasicRetryManager

// Instantiate and register InMemoryDeadLetterQueue
const deadLetterQueue = new InMemoryDeadLetterQueue();
container.registerInstance('DeadLetterQueue', deadLetterQueue); // Assuming it's registered with a string token

// Instantiate and register LoggingDeadLetterHandler
const loggingDeadLetterHandler = new LoggingDeadLetterHandler();
container.registerInstance(LoggingDeadLetterHandler, loggingDeadLetterHandler); // Register with the class token

// Instantiate and register BasicRetryManager
const retryManager = new BasicRetryManager();
container.registerInstance(BasicRetryManager, retryManager); // Register with the class token

// Instantiate and register DeadLetterProcessor (using BasicDeadLetterProcessor implementation)
const deadLetterProcessor = new BasicDeadLetterProcessor(deadLetterQueue, loggingDeadLetterHandler, retryManager); // Pass all three dependencies
container.registerInstance('DeadLetterProcessor', deadLetterProcessor); // Register with the string token

import { logger } from './utils/logger'; // Import the logger

// Register the logger
container.registerInstance('logger', logger);

// Create and configure the Express application
const app = express();
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
  app.use(express.json());

  app.use('/api', apiRateLimiter, createRouter());

  return app;
};