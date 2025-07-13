import "reflect-metadata";
import cors from 'cors';
import express, { Express } from 'express';
import { DependencyContainer, container } from 'tsyringe';
import { WebSocket, WebSocketServer } from 'ws';
import { AgentCommunicationBus } from './core/AgentCommunicationBus';
import { AgentMessage } from './core/agents/communication/AgentMessage';
import { TYPES, IHealthChecks, IShutdownHandlers, ILogger } from './di/Types'; // Import IHealthChecks, IShutdownHandlers, ILogger
import { setupContainer } from './di/container';
import { AdminCommandController } from './api/controllers/AdminCommandController';

import apiRateLimiter from './api/middleware/rateLimiter';
import createMainRouter from './api/routes';
import createUserPreferenceRouter from './api/userPreferenceRoutes';
import createWineRecommendationRouter from './api/wineRecommendationRoutes';

const PORT = process.env.PORT || 3001;

export function createServer(dependencyContainer?: DependencyContainer): Express {
  const app = express();
  const currentContainer = dependencyContainer || container;
  const logger = currentContainer.resolve<ILogger>(TYPES.Logger); // Resolve logger from container

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (req, res) => {
    const healthChecks = currentContainer.resolve<IHealthChecks>(TYPES.HealthChecks);
    const results: { [key: string]: { status: string } } = {};

    // Run all health checks concurrently
    const checkPromises = Object.keys(healthChecks).map(async (key) => {
      try {
        results[key] = await healthChecks[key]();
      } catch (error) {
        logger.error(`Health check for ${key} failed with exception:`, error);
        results[key] = { status: `unhealthy: ${error instanceof Error ? error.message : String(error)}` };
      }
    });

    await Promise.all(checkPromises);

    const overallStatus = Object.values(results).every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
    res.status(overallStatus === 'healthy' ? 200 : 503).json({ status: overallStatus, checks: results });
  });

  // Use the routers
  const adminCommandController = currentContainer.resolve(AdminCommandController);
  app.use('/api', apiRateLimiter, createMainRouter(currentContainer, adminCommandController));
  app.use('/api', createUserPreferenceRouter(currentContainer));
  app.use('/api', createWineRecommendationRouter(currentContainer));

  return app;
}

if (require.main === module) {
  (async () => { // Use an async IIFE
    const appContainer = await setupContainer(); // Use async setupContainer
    const logger = appContainer.resolve<ILogger>(TYPES.Logger); // Resolve logger from the initialized container

    const app = createServer(appContainer); // Pass the initialized container to createServer
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

      const agentBus = appContainer.resolve<AgentCommunicationBus>(TYPES.AgentCommunicationBus);
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
    const shutdownHandlers = appContainer.resolve<IShutdownHandlers>(TYPES.ShutdownHandlers); // Resolve shutdown handlers

    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      wss?.close();
      server?.close();

      // Execute all registered shutdown handlers
      for (const handler of shutdownHandlers) {
        try {
          await handler();
        } catch (error) {
          logger.error('Error during shutdown handler execution:', error);
        }
      }
      logger.info('All shutdown handlers executed. Exiting.');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })();
}
