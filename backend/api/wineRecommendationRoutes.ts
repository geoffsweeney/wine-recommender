import { Router } from 'express';
import { container } from 'tsyringe';
import { TYPES } from '../di/Types';
import { WineRecommendationController } from './controllers/WineRecommendationController';
import { validateRequest } from './middleware/validation';
import { RecommendationRequest } from './dtos/RecommendationRequest.dto';
import { SearchRequest } from './dtos/SearchRequest.dto';

import { DependencyContainer } from 'tsyringe'; // Added DependencyContainer

export default function createWineRecommendationRouter(dependencyContainer: DependencyContainer): Router {
  const router = Router();
  const wineRecommendationController = dependencyContainer.resolve(WineRecommendationController);

  // POST /wine-recommendations (for recommendations)
  router.post(
    '/wine-recommendations',
    validateRequest(RecommendationRequest, 'body'),
    (req, res) => wineRecommendationController.execute(req, res)
  );

  // GET /wine-recommendations (for search)
  router.get(
    '/wine-recommendations',
    validateRequest(SearchRequest, 'query'),
    (req, res) => wineRecommendationController.execute(req, res)
  );

  return router;
}