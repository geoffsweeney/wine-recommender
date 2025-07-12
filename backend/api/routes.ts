import { Response, Router } from 'express';
import { DependencyContainer } from 'tsyringe'; // Added DependencyContainer
import { v4 as uuidv4 } from 'uuid';
import { createAgentMessage, MessageTypes } from '../core/agents/communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../core/agents/communication/EnhancedAgentCommunicationBus';
import { TYPES } from '../di/Types';
import { AdminCommandController } from './controllers/AdminCommandController'; // Added
import { AdminUserPreferenceController } from './controllers/AdminUserPreferenceController';
import { AdminCommandRequestSchema } from './dtos/AdminCommandRequest.dto'; // Added
import { DeletePreferenceQuerySchema } from './dtos/DeletePreferenceQuery.dto'; // Added
import { RecommendationRequest } from './dtos/RecommendationRequest.dto'; // Added
import { UserIdParamSchema } from './dtos/UserIdParam.dto'; // Added
import { UserPreferencesUpdateSchema } from './dtos/UserPreferencesUpdate.dto'; // Added
import { ValidatedRequest, validateRequest } from './middleware/validation'; // Added

// Define a local interface to extend Request with validatedBody/Query
// interface ValidatedRequest extends Request { // Moved to validation.ts
//   validatedBody?: any;
//   validatedQuery?: any;
// }

// Export a function that returns the router, allowing dependencies to be resolved at call time
export default function createRouter(
  dependencyContainer: DependencyContainer,
  adminCommandController: AdminCommandController // Add AdminCommandController as an argument
): Router {
  const router = Router();

  // Resolve dependencies inside the function, so they are resolved when the function is called
  // and the container is properly configured.
  const communicationBus = dependencyContainer.resolve<EnhancedAgentCommunicationBus>(TYPES.AgentCommunicationBus);

  router.post(
    '/recommendations',
    validateRequest(RecommendationRequest, 'body'), // Apply validation middleware
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

  // Admin Command Route
  // const adminCommandController = dependencyContainer.resolve<AdminCommandController>(TYPES.AdminCommandController); // Removed
  router.post(
    '/admin-commands',
    validateRequest(AdminCommandRequestSchema, 'body'),
    async (req: ValidatedRequest, res) => adminCommandController.execute(req, res) // Use the injected controller
  );
 
   // Admin User Preference Routes
   const adminUserPreferenceController = dependencyContainer.resolve(AdminUserPreferenceController);
  
   router.get('/admin/preferences', (req, res) => adminUserPreferenceController.execute(req, res));
   router.get('/admin/preferences/:userId', validateRequest(UserIdParamSchema, 'params'), (req, res) => adminUserPreferenceController.execute(req, res));
   router.put('/admin/preferences/:userId', validateRequest(UserIdParamSchema, 'params'), validateRequest(UserPreferencesUpdateSchema, 'body'), (req, res) => adminUserPreferenceController.execute(req, res));
   router.delete('/admin/preferences/:userId', validateRequest(UserIdParamSchema, 'params'), validateRequest(DeletePreferenceQuerySchema, 'query'), (req, res) => adminUserPreferenceController.execute(req, res));
  
    return router;
}
