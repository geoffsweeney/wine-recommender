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
import { WebSocketServer, WebSocket } from 'ws';


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

let server: any; // Declare server in a broader scope

if (require.main === module) {
  // This block will only run if server.ts is executed directly
  server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });

  // Attach WebSocket server to the main server instance
  const wss = new WebSocketServer({ server: server });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');

    // Handle messages from clients (if needed)
    ws.on('message', (message) => {
      logger.info(`Received message from client: ${message}`);
      // TODO: Handle incoming messages from frontend if necessary
    });

    // Handle client disconnection
    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // TODO: Implement logic to send agent conversation messages to this client
  });

  logger.info('WebSocket server started');

  logger.info('Attempting to get AgentCommunicationBus instance');
  // Get AgentCommunicationBus instance and subscribe to messages
  const agentBus = container.resolve(AgentCommunicationBus);
  logger.info('Successfully got AgentCommunicationBus instance');

  logger.info('Attempting to subscribe to AgentCommunicationBus messages');
  logger.info('Attempting to subscribe to AgentCommunicationBus messages');
  agentBus.subscribe('websocket-broadcaster', (message) => {
    // Broadcast the message to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) { // Use imported WebSocket.OPEN
        // Map the AgentMessage to the frontend's expected format
        const frontendMessage = {
          agent: message.metadata.sender,
          message: JSON.stringify(message.payload), // Stringify payload as it can be complex
        };
        client.send(JSON.stringify(frontendMessage));
      }
    });
  }, 'agent-orchestration'); // Subscribe to the 'agent-orchestration' topic

  logger.info('Subscribed to AgentCommunicationBus messages for WebSocket broadcasting');
}


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
