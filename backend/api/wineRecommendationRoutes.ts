import { Router } from 'express';
import { WineRecommendationController } from './controllers/WineRecommendationController';
import { RecommendationRequest } from './dtos/RecommendationRequest.dto';
import { SearchRequest } from './dtos/SearchRequest.dto';
import { validateRequest } from './middleware/validation';
import { DependencyContainer } from 'tsyringe'; // Added DependencyContainer

export default function createWineRecommendationRouter(dependencyContainer: DependencyContainer): Router {
  const router = Router();
  const wineRecommendationController = dependencyContainer.resolve(WineRecommendationController);
  console.log('WineRecommendationController resolved in router:', wineRecommendationController); // Add log

  // Changed from '/' to '/wine-recommendations' to match test expectations
  router.post(
    '/wine-recommendations',
    validateRequest(RecommendationRequest, 'body'), // Added 'body' as source
    wineRecommendationController.executeImpl.bind(wineRecommendationController)
  );

  router.get(
    '/wine-recommendations',
    validateRequest(SearchRequest, 'query'), // Added 'query' as source
    wineRecommendationController.executeImpl.bind(wineRecommendationController)
  );

  return router;
}