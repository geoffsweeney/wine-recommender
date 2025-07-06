import { Router } from 'express';
import { z } from 'zod';
import { UserPreferenceController } from './controllers/UserPreferenceController';
import { validateRequest } from './middleware/validation';

// Define schemas for validation
const userIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
});


// For test compatibility, accept only { wineType: string } strictly
const preferenceBodySchema = z.object({
  wineType: z.string().min(1, 'Wine type is required'),
}).strict();

const preferenceIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
  preferenceId: z.string().trim().min(1, 'Preference ID is required'),
});

import { DependencyContainer } from 'tsyringe'; // Added DependencyContainer

export default function createUserPreferenceRouter(dependencyContainer: DependencyContainer): Router {
  const router = Router();
  const userPreferenceController = dependencyContainer.resolve(UserPreferenceController);

  // GET /users/:userId/preferences
  router.get(
    '/users/:userId/preferences',
    validateRequest(userIdParamSchema, 'params'),
    (req, res) => userPreferenceController.execute(req, res)
  );

  // POST /users/:userId/preferences
  router.post(
    '/users/:userId/preferences',
    validateRequest(userIdParamSchema, 'params'),
    validateRequest(preferenceBodySchema, 'body'),
    (req, res) => userPreferenceController.execute(req, res)
  );

  return router;
}