import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import { WineRecommendationController } from './controllers/WineRecommendationController';
import { validateRequest } from './middleware/validation';
import { RecommendationRequest } from './dtos/RecommendationRequest.dto';
import { SearchRequest } from './dtos/SearchRequest.dto';

export const createRouter = () => {
  const router = express.Router();
  
  const wineController = container.resolve(WineRecommendationController);

  // Recommendation endpoints
  router.post(
    '/recommendations',
    validateRequest(RecommendationRequest, 'body'),
    (req, res) => wineController.execute(req, res)
  );
  
  router.get(
    '/search',
    validateRequest(SearchRequest, 'query'),
    (req, res) => wineController.searchWines(req, res)
  );
  
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  return router;
};