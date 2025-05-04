import express from 'express';
import { container } from 'tsyringe';
import { WineRecommendationController } from './controllers/WineRecommendationController';

export const createRouter = () => {
  const router = express.Router();
  
  const wineController = container.resolve(WineRecommendationController);

  // Recommendation endpoints
  router.post('/recommendations', (req, res) => wineController.execute(req, res));
  router.get('/search', (req, res) => wineController.searchWines(req, res));
  
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  return router;
};