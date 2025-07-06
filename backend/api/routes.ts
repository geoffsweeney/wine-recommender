import { Request, Response, Router } from 'express';
import { DependencyContainer } from 'tsyringe'; // Added DependencyContainer
import { v4 as uuidv4 } from 'uuid';
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator';
import { createAgentMessage, MessageTypes } from '../core/agents/communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import { TYPES } from '../di/Types';
import { RecommendationRequest as RecommendationRequestSchema } from './dtos/RecommendationRequest.dto'; // Import the DTO schema
import { validateRequest } from './middleware/validation'; // Import validation middleware

// Define a local interface to extend Request with validatedBody/Query
interface ValidatedRequest extends Request {
  validatedBody?: any;
  validatedQuery?: any;
}

// Export a function that returns the router, allowing dependencies to be resolved at call time
export default function createRouter(dependencyContainer: DependencyContainer): Router {
  const router = Router();

  // Resolve dependencies inside the function, so they are resolved when the function is called
  // and the container is properly configured.
  const communicationBus = dependencyContainer.resolve<EnhancedAgentCommunicationBus>(TYPES.AgentCommunicationBus);

  router.post(
    '/recommendations',
    validateRequest(RecommendationRequestSchema, 'body'), // Apply validation middleware
    async (req: ValidatedRequest, res: Response): Promise<void> => { // Cast req to ValidatedRequest
      try {
        const correlationId = uuidv4();
        const conversationId = uuidv4();

        // req.validatedBody is now guaranteed to conform to RecommendationRequestSchema due to validation middleware
        const message = createAgentMessage(
          MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          { // Wrap req.validatedBody in an OrchestrationInput object
            userInput: req.validatedBody,
            conversationId: conversationId,
            correlationId: correlationId,
            sourceAgent: 'api'
          },
          'api',
          conversationId,
          correlationId,
          'sommelier-coordinator'
        );

        const result = await communicationBus.sendMessageAndWaitForResponse(
          'sommelier-coordinator', // Corrected target agent ID
          message
        );

        if (!result.success) {
          res.status(400).json({ error: result.error.message });
          return;
        }

        if (result.data === null || result.data.payload === null) { // Check for null data or null payload
          res.status(404).json({ error: 'No recommendations found' });
          return;
        }

        res.status(200).json(result.data.payload); // Access the payload property
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error handling recommendation request:', error.message);
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  return router;
}
