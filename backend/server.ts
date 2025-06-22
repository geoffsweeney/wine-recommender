import "reflect-metadata";
import express, { Express } from 'express';
import cors from 'cors';
import { DependencyContainer, container } from 'tsyringe'; // Added DependencyContainer
import { LLMService } from './services/LLMService';
import { PreferenceExtractionService } from './services/PreferenceExtractionService';
import { PreferenceNormalizationService } from './services/PreferenceNormalizationService'; // Import PreferenceNormalizationService
import { AgentCommunicationBus } from './core/AgentCommunicationBus';
import { SommelierCoordinator } from './core/agents/SommelierCoordinator'; // Import SommelierCoordinator
import { AgentMessage } from './core/agents/communication/AgentMessage';
import { Neo4jService } from './services/Neo4jService';
import { KnowledgeGraphService } from './services/KnowledgeGraphService';
import { InMemoryDeadLetterQueue } from './core/InMemoryDeadLetterQueue';
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from './core/BasicDeadLetterProcessor';
import { DeadLetterProcessor } from './core/DeadLetterProcessor'; // Import DeadLetterProcessor interface
import { BasicRetryManager } from './core/BasicRetryManager';
import { ConversationHistoryService } from './core/ConversationHistoryService'; // Import ConversationHistoryService
import { logger } from './utils/logger';
import { WebSocketServer, WebSocket } from 'ws';
import neo4j from 'neo4j-driver'; // Import neo4j driver

import { Neo4jCircuitWrapper } from "./services/Neo4jCircuitWrapper"; // Import Neo4jCircuitWrapper
import axios from 'axios'; // Import axios
import { IRecommendationStrategy } from './services/interfaces/IRecommendationStrategy';
import { UserPreferencesStrategy } from './services/strategies/UserPreferencesStrategy';
import { CollaborativeFilteringStrategy } from './services/strategies/CollaborativeFilteringStrategy';
import { PopularWinesStrategy } from './services/strategies/PopularWinesStrategy';
import { RecommendationStrategyProvider } from './services/strategies/RecommendationStrategyProvider'; // Import RecommendationStrategyProvider

import { TYPES } from './di/Types'; // Import TYPES from the new location
import { setupContainer } from './di/container'; // Import setupContainer

export const registerDependencies = setupContainer;

import createMainRouter from './api/routes'; // Main API routes
import createUserPreferenceRouter from './api/userPreferenceRoutes'; // User preference routes
import createWineRecommendationRouter from './api/wineRecommendationRoutes'; // Wine recommendation routes
import apiRateLimiter from './api/middleware/rateLimiter';

const PORT = process.env.PORT || 3001;

export function createServer(dependencyContainer?: DependencyContainer): Express {
  const app = express();
  const currentContainer = dependencyContainer || container;

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Use the routers
  app.use('/api', apiRateLimiter, createMainRouter(currentContainer));
  app.use('/api', createUserPreferenceRouter(currentContainer));
  app.use('/api', createWineRecommendationRouter(currentContainer));

  return app;
}

if (require.main === module) {
  setupContainer(); // Register dependencies once for the main server
  const app = createServer(); // Create the app instance
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });

  // WebSocket server setup
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');

    ws.on('message', (message) => {
      logger.info(`Received message from client: ${message}`);
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    const agentBus = container.resolve<AgentCommunicationBus>(TYPES.AgentCommunicationBus);
    agentBus.subscribe('websocket-broadcaster', (message) => {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          const msg = message as AgentMessage;
          const frontendMessage = {
            agent: msg.metadata?.sender || 'unknown-agent',
            message: JSON.stringify(msg.payload),
          };
          client.send(JSON.stringify(frontendMessage));
        }
      });
    }, 'agent-orchestration');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    wss?.close();
    server?.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    wss?.close();
    server?.close();
    process.exit(0);
  });
}
