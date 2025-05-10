import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import { SommelierCoordinator } from '@src/core/agents/SommelierCoordinator'; // Use @src alias
// Import agents (InputValidationAgent and RecommendationAgent are dependencies of SommelierCoordinator)
// import { InputValidationAgent } from '@src/core/agents/InputValidationAgent';
// import { RecommendationAgent } from '@src/core/agents/RecommendationAgent';
// Import services (Neo4jService is a dependency of KnowledgeGraphService)
// import { Neo4jService } from '@src/services/Neo4jService';

// Import validation middleware and schemas using @src alias
import { validateRequest } from '@src/api/middleware/validation';
import { RecommendationRequest } from '@src/api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '@src/api/dtos/SearchRequest.dto';
import { BasicDeadLetterProcessor } from '../core/BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor

const router = express.Router();

// Recommendations endpoint
router.post(
  '/recommendations',
  validateRequest(RecommendationRequest, 'body'), // Apply body validation middleware
  async (req, res) => { // Type annotation removed as validation middleware handles it
    try {
      // Resolve the SommelierCoordinator from the container
      const sommelierCoordinator = container.resolve(SommelierCoordinator);

      // Pass the validated request body to the coordinator
      const result = await sommelierCoordinator.handleMessage(req.body);

      // The SommelierCoordinator now re-throws errors, so this catch block will be reached on agent errors
      if (result && result.recommendation) {
        res.status(200).json(result);
      } else {
        console.error('Invalid response from SommelierCoordinator:', result);
        res.status(500).json({ error: 'Invalid response from recommendation service' });
      }
    } catch (error: any) {
      console.error('Error processing recommendations:', error);
      // Catch errors thrown by the coordinator and return a 500
      // The validation errors are handled by the middleware, so we don't expect ValidationError here
      res.status(500).json({ error: 'Failed to process recommendation request' });
    }
  }
);

// Search endpoint
router.get(
  '/search',
  validateRequest(SearchRequest, 'query'), // Apply query validation middleware
  async (req, res) => { // Type annotation removed as validation middleware handles it
    try {
      // Access validated query parameters from req.query
      const { query, limit } = req.query;

      // TODO: Implement actual search logic using a SearchService or Agent

      // Placeholder success response for now
      res.status(200).json({ results: [] }); // Remove return keyword

    } catch (error: any) {
      console.error('Error processing search:', error);
      // Catch errors during search processing and return a 500
      // The validation errors are handled by the middleware, so we don't expect ValidationError here
      res.status(500).json({ error: 'Failed to process search request' });
    }
  }
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

export const createRouter = () => router;