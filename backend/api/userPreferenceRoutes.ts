import { Router } from 'express';
import { container } from 'tsyringe';
import { TYPES } from '../di/Types';
import { UserPreferenceController } from './controllers/UserPreferenceController';
import { validateRequest } from './middleware/validation';
import { z } from 'zod';

// Define schemas for validation
const userIdParamSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
});

const preferenceBodySchema = z.object({
  type: z.string().min(1, 'Preference type is required'),
  value: z.any(), // Value can be of any type
  active: z.boolean(),
  confidence: z.number().optional(),
  source: z.string().optional(),
  timestamp: z.string().optional(),
});

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

  // PUT /users/:userId/preferences
  router.put(
    '/users/:userId/preferences',
    validateRequest(userIdParamSchema, 'params'),
    validateRequest(preferenceBodySchema, 'body'),
    (req, res) => userPreferenceController.execute(req, res)
  );

  // DELETE /users/:userId/preferences/:preferenceId
  router.delete(
    '/users/:userId/preferences/:preferenceId',
    validateRequest(preferenceIdParamSchema, 'params'),
    (req, res) => userPreferenceController.execute(req, res)
  );

  return router;
}