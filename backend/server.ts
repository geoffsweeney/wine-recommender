import cors from 'cors';
import express, { Express } from 'express';
import "reflect-metadata";
import { DependencyContainer, container } from 'tsyringe'; // Added DependencyContainer
import { WebSocket, WebSocketServer } from 'ws';
import { AgentCommunicationBus } from './core/AgentCommunicationBus';
import { AgentMessage } from './core/agents/communication/AgentMessage';
import { logger } from './utils/logger';

import { PromptManager } from './services/PromptManager'; // Import PromptManager

import { TYPES } from './di/Types'; // Import TYPES from the new location
import { setupContainer } from './di/container'; // Import setupContainer

export const registerDependencies = setupContainer;

import apiRateLimiter from './api/middleware/rateLimiter';
import createMainRouter from './api/routes'; // Main API routes
import createUserPreferenceRouter from './api/userPreferenceRoutes'; // User preference routes
import createWineRecommendationRouter from './api/wineRecommendationRoutes'; // Wine recommendation routes

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
  
  // Ensure PromptManager reloads prompts after setup
  const promptManager = container.resolve<PromptManager>(TYPES.PromptManager);
  promptManager.reloadPrompts().then(() => {
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
  });
}
