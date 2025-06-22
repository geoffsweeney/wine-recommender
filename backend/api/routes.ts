import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod'; // Import z for schema definition
import { createAgentMessage, MessageTypes } from '../core/agents/communication/AgentMessage';
import { DependencyContainer, container } from 'tsyringe'; // Added DependencyContainer
import { TYPES } from '../di/Types';
import { SommelierCoordinator } from '../core/agents/SommelierCoordinator';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import type { Result } from '../core/types/Result';
import type { AgentMessage } from '../core/agents/communication/AgentMessage';
import type { AgentError } from '../core/agents/AgentError';
import { validateRequest } from './middleware/validation'; // Import validation middleware
import { RecommendationRequest as RecommendationRequestSchema } from './dtos/RecommendationRequest.dto'; // Import the DTO schema

// Export a function that returns the router, allowing dependencies to be resolved at call time
export default function createRouter(dependencyContainer: DependencyContainer): Router {
  const router = Router();

  // Resolve dependencies inside the function, so they are resolved when the function is called
  // and the container is properly configured.
  const sommelierCoordinator = dependencyContainer.resolve<SommelierCoordinator>(TYPES.SommelierCoordinator);
  const communicationBus = dependencyContainer.resolve<EnhancedAgentCommunicationBus>(TYPES.AgentCommunicationBus);

  router.post(
    '/recommendations',
    validateRequest(RecommendationRequestSchema, 'body'), // Apply validation middleware
    async (req: Request, res: Response): Promise<void> => {
      try {
        const correlationId = uuidv4();
        const conversationId = uuidv4();

        // req.validatedBody is now guaranteed to conform to RecommendationRequestSchema due to validation middleware
        const message = createAgentMessage(
          MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          req.validatedBody, // Use validated req.body
          'api',
          conversationId,
          correlationId,
          'sommelier'
        );

        const result = await communicationBus.sendMessageAndWaitForResponse(
          'sommelier',
          message
        );

        if (!result.success) {
          res.status(400).json({ error: result.error.message });
          return;
        }

        if (result.data === null) {
          res.status(404).json({ error: 'No recommendations found' });
          return;
        }

        res.status(200).json(result.data.payload);
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