import request from 'supertest';
import express from 'express';
import { createRouter } from '../routes';
import { container } from 'tsyringe';
import { WineRecommendationController } from '../controllers/WineRecommendationController';

// Mock controller
jest.mock('../controllers/WineRecommendationController');
const mockController = {
  execute: jest.fn((req, res) => res.status(200).json({})),
  searchWines: jest.fn((req, res) => res.status(200).json({}))
};

beforeEach(() => {
  container.resolve = jest.fn().mockReturnValue(mockController);
  mockController.execute.mockImplementation((req, res) => res.status(200).json({}));
  mockController.searchWines.mockImplementation((req, res) => res.status(200).json({}));
});

afterEach(() => {
  jest.clearAllMocks();
});

// Increase test timeout
jest.setTimeout(10000);

describe('API Validation', () => {
  let app: express.Express;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(createRouter());
  });

  describe('POST /recommendations', () => {
    it('should reject empty request', async () => {
      const res = await request(app)
        .post('/recommendations')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should require userId', async () => {
      const res = await request(app)
        .post('/recommendations')
        .send({ preferences: {} });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e: any) => e.path === 'userId')).toBe(true);
    });

    it('should accept valid request', async () => {
      const res = await request(app)
        .post('/recommendations')
        .send({ userId: 'test', preferences: {} });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /search', () => {
    it('should reject empty query', async () => {
      const res = await request(app)
        .get('/search')
        .query({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should require query parameter', async () => {
      const res = await request(app)
        .get('/search')
        .query({ limit: 10 });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e: any) => e.path === 'query')).toBe(true);
    });

    it('should accept valid search', async () => {
      mockController.searchWines.mockImplementation((req, res) => {
        console.log('Mock searchWines called with:', req.query);
        res.status(200).json({});
      });
      
      const res = await request(app)
        .get('/search')
        .query({ query: 'merlot' });
      
      console.log('Test response:', res.status, res.body);
      expect(res.status).toBe(200);
      expect(mockController.searchWines).toHaveBeenCalled();
    });
  });
});