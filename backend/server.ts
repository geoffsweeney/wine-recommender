import "reflect-metadata";
import express, { Express } from 'express';
import cors from 'cors';
import { LLMService } from './services/LLMService';
import { PreferenceExtractionService } from './services/PreferenceExtractionService';
import { PreferenceNormalizationService } from './services/PreferenceNormalizationService'; // Import PreferenceNormalizationService
import { container } from 'tsyringe';
import { AgentCommunicationBus } from './core/AgentCommunicationBus';
import { Neo4jService } from './services/Neo4jService';
import { KnowledgeGraphService } from './services/KnowledgeGraphService';
import { InMemoryDeadLetterQueue } from './core/InMemoryDeadLetterQueue';
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from './core/BasicDeadLetterProcessor';
import { BasicRetryManager } from './core/BasicRetryManager';
import { ConversationHistoryService } from './core/ConversationHistoryService'; // Import ConversationHistoryService
import { logger } from './utils/logger';


const registerDependencies = () => {
  container.registerInstance('llmApiUrl', 'http://localhost:11434');
  container.registerInstance('llmModel', 'llama3.1:latest');
  container.registerInstance('llmApiKey', '');
  container.registerSingleton('LLMService', LLMService);
  container.registerSingleton('PreferenceExtractionService', PreferenceExtractionService);
  container.registerSingleton('PreferenceNormalizationService', PreferenceNormalizationService); // Register PreferenceNormalizationService
  container.registerSingleton("AgentCommunicationBus", AgentCommunicationBus);

  const neo4jService = new Neo4jService();
  container.registerInstance(Neo4jService, neo4jService);

  const knowledgeGraphService = new KnowledgeGraphService(neo4jService);
  container.registerInstance('KnowledgeGraphService', knowledgeGraphService);

  const deadLetterQueue = new InMemoryDeadLetterQueue();
  container.registerInstance('DeadLetterQueue', deadLetterQueue);

  const loggingDeadLetterHandler = new LoggingDeadLetterHandler();
  container.registerInstance(LoggingDeadLetterHandler, loggingDeadLetterHandler);

  const retryManager = new BasicRetryManager();
  container.registerInstance(BasicRetryManager, retryManager);

  const deadLetterProcessor = new BasicDeadLetterProcessor(deadLetterQueue, loggingDeadLetterHandler, retryManager);
  container.registerInstance('DeadLetterProcessor', deadLetterProcessor);

  const conversationHistoryService = new ConversationHistoryService(); // Instantiate ConversationHistoryService
  container.registerInstance(ConversationHistoryService, conversationHistoryService); // Register ConversationHistoryService


  container.registerInstance('logger', logger);
};

registerDependencies();

import { createRouter } from './api/routes';
import apiRateLimiter from './api/middleware/rateLimiter';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRateLimiter, createRouter());
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export const createServer = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  // Dependencies are registered globally, so no need to call registerDependencies here again
  // registerDependencies(); // Removed duplicate registration call
  app.use('/api', apiRateLimiter, createRouter());
  return app;
};

export function closeServer(app: Express): void {
  const testServer = app.listen(0, () => {
    testServer.close();
  });
}
