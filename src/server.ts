import "reflect-metadata";
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createRouter } from './api/routes';
import { container } from 'tsyringe';
import { Neo4jService } from './services/Neo4jService';
import { MockNeo4jService } from './services/MockNeo4jService';

export const createServer = () => {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: true, // Enable both `X-RateLimit-*` and `RateLimit-*` headers
    keyGenerator: (req) => {
      // Differentiate rate limits by path
      return `${req.ip}:${req.path}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        message: 'Rate limit exceeded - please try again later',
        status: 429
      });
    }
  });

  // Register services
  const useMock = process.env.NODE_ENV === 'development';
  container.register('Neo4jService', {
    useClass: useMock ? MockNeo4jService : Neo4jService
  });

  const app = express();
  app.use(limiter);
  app.use(express.json());
  app.use('/api', createRouter());
  
  return app;
};

export const startServer = (app: express.Express, port: number = 3000) => {
  return app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    
    const neo4j = container.resolve(Neo4jService);
    const isConnected = await neo4j.verifyConnection();
    console.log(`Neo4j connection: ${isConnected ? 'OK' : 'FAILED'}`);
  });
};

// Default server startup
if (require.main === module) {
  const app = createServer();
  const port = Number(process.env.PORT) || 3000;
  startServer(app, port);
}