import "reflect-metadata";
import express from 'express';
import { createRouter } from './api/routes';
import { container } from 'tsyringe';
import { Neo4jService } from './services/Neo4jService';

// Register services
container.register('Neo4jService', { useClass: Neo4jService });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api', createRouter());

// Start server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  
  // Verify database connection
  const neo4j = container.resolve(Neo4jService);
  const isConnected = await neo4j.verifyConnection();
  console.log(`Neo4j connection: ${isConnected ? 'OK' : 'FAILED'}`);
});