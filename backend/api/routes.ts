import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator'; // Use @src alias
import { UserPreferenceController } from '..//api/controllers/UserPreferenceController'; // Import UserPreferenceController
import { AgentCommunicationBus } from '..//core/AgentCommunicationBus'; // Import AgentCommunicationBus
import { LLMService } from '..//services/LLMService'; // Import LLMService

// Import validation middleware and schemas using @src alias
import { validateRequest } from '..//api/middleware/validation';
import { RecommendationRequest } from '..//api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '..//api/dtos/SearchRequest.dto';
//import { BasicDeadLetterProcessor } from '../core/BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor

const router = express.Router();

export const createRouter = () => {
  // Explicitly register AgentCommunicationBus and LLMService if not already registered
  // This is a workaround for potential container isolation issues in the test environment
  if (!container.isRegistered(AgentCommunicationBus)) {
    // Assuming LLMService is a dependency of AgentCommunicationBus
    if (!container.isRegistered(LLMService)) {
        // This might not be the correct way to instantiate LLMService if it has complex dependencies
        // but for the sake of unblocking the E2E tests, we'll try a basic instantiation.
        // A better long-term solution would be to fix the test environment's container setup.
        container.registerSingleton(LLMService);
    }
    const llmService = container.resolve(LLMService);
    const agentCommunicationBus = new AgentCommunicationBus(llmService);
    container.registerInstance(AgentCommunicationBus, agentCommunicationBus);
  }


  // Recommendations endpoint
  router.post(
    '/recommendations',
    validateRequest(RecommendationRequest, 'body'), // Apply body validation middleware
    async (req, res) => { // Type annotation removed as validation middleware handles it
console.log('Received recommendation request:', req.body); // Log the request body
      try {
        // Resolve the SommelierCoordinator from the container
console.log('routes.ts: SommelierCoordinator resolved.');
        const sommelierCoordinator = container.resolve(SommelierCoordinator);

        // Pass the validated request body to the coordinator
        const result = await sommelierCoordinator.handleMessage(req.body);

        // The SommelierCoordinator now re-throws errors, so this catch block will be reached on agent errors
        if (Array.isArray(result) && result.length > 0) {
          // Manually construct the response array to ensure only necessary properties are included
          const cleanResult = result.map((wine: any) => ({
            id: wine.id,
            name: wine.name,
            type: wine.type,
            region: wine.region,
            vintage: wine.vintage,
            price: wine.price,
            rating: wine.rating,
          }));
          res.status(200).json({ recommendation: cleanResult }); // Wrap the clean array
        }
        // Optionally, handle a specific case for no recommendations found if the coordinator returns an empty array
        else if (Array.isArray(result) && result.length === 0) {
           res.status(200).json({ recommendation: [] }); // Return an empty recommendation array
        }
        // Handle other cases (e.g., fallback response object, or unexpected result format)
        else if (result && result.recommendation) {
           res.status(200).json(result); // Keep existing logic for fallback response object if needed
        }
        else {
          res.status(500).json({ error: 'Invalid or empty response from recommendation service' });
        }
      } catch (error: any) {
        console.error('Error processing recommendation request:', error); // Log the error
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

  // User Preferences endpoints
  router.get('/preferences/:userId', async (req, res) => {
    const controller = container.resolve(UserPreferenceController);
    await controller.getPreferences(req, res);
  });

  router.post('/preferences/:userId', async (req, res) => {
    const controller = container.resolve(UserPreferenceController);
    await controller.addOrUpdatePreference(req, res);
  });

  router.put('/preferences/:userId/:preferenceId', async (req, res) => {
    const controller = container.resolve(UserPreferenceController);
    await controller.addOrUpdatePreference(req, res); // Reusing addOrUpdate for PUT
  });

  router.delete('/preferences/:userId/:preferenceId', async (req, res) => {
    const controller = container.resolve(UserPreferenceController);
    await controller.deletePreference(req, res);
  });


  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  return router;
};