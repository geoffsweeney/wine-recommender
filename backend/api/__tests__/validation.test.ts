import { mockDeep } from 'jest-mock-extended';
import request from 'supertest';
import express from 'express';
import { createRouter } from '../routes';
import { container } from 'tsyringe';
import { WineRecommendationController } from '../controllers/WineRecommendationController';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator';
import { InputValidationAgent } from '../../core/agents/InputValidationAgent';
import { RecommendationAgent } from '../../core/agents/RecommendationAgent';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { Neo4jService } from '../../services/Neo4jService';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation'; // Moved import to top

// Create validation schemas for testing
const recommendationSchema = z.object({
  userId: z.string(),
  input: z.object({
    preferences: z.record(z.string(), z.string()).optional()
  })
});

const searchSchema = z.object({
  query: z.string(),
  limit: z.union([z.number(), z.string().transform(val => parseInt(val, 10))]).optional()
});

// Mock controller
const mockController = {
  execute: jest.fn((req, res) => res.status(200).json({})),
  searchWines: jest.fn((req, res) => res.status(200).json({ results: [] }))
};

afterEach(() => {
  jest.clearAllMocks();
  // Clear container after each test to ensure isolation
  container.clearInstances();
  container.reset();
});

// Increase test timeout
jest.setTimeout(10000);

describe('API Validation', () => {
  let app: express.Express;
  let mockNeo4jService: Neo4jService;

  beforeEach(() => {
    // Clear container before each test to ensure isolation
    container.clearInstances();
    container.reset();

    // Register dependencies with the container for the test environment
    container.registerInstance(WineRecommendationController, mockController as any);

    mockNeo4jService = mockDeep<Neo4jService>();
    container.registerInstance(Neo4jService, mockNeo4jService);

    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService });
    container.register(InputValidationAgent, { useClass: InputValidationAgent });
    container.register(RecommendationAgent, { useClass: RecommendationAgent });
    container.register(SommelierCoordinator, { useClass: SommelierCoordinator });

    app = express();
    app.use(express.json());
    
    // Setup routes with validation middleware
    app.post('/recommendations',
      validateRequest(recommendationSchema, 'body'),
      (req, res) => mockController.execute(req, res)
    );
    
    app.get('/search',
      validateRequest(searchSchema, 'query'),
      (req, res) => mockController.searchWines(req, res)
    );
  });

  describe('POST /recommendations', () => {
    it('should reject empty request', async () => {
      const res = await request(app)
        .post('/recommendations')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject invalid preferences format', async () => {
      const res = await request(app)
      .post('/recommendations')
      .send({ userId: 'test', input: { preferences: 'invalid_format' } });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e: any) => e.path.includes('preferences'))).toBe(true);
    });

    it('should handle missing preferences gracefully', async () => {
      const res = await request(app)
        .post('/recommendations')
        .send({ userId: 'test', input: {} });
      expect(res.status).toBe(200);
      expect(mockController.execute).toHaveBeenCalled();
    });

    it('should accept valid request', async () => {
      const validRequest = {
        userId: 'test',
        input: { preferences: { color: 'red', type: 'dry' } }
      };
      const res = await request(app)
        .post('/recommendations')
        .send(validRequest);
      expect(res.status).toBe(200);
      expect(mockController.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          body: validRequest
        }),
        expect.anything()
      );
    });
  });

  describe('GET /search', () => {
    it('should accept valid search query with string number parameters', async () => {
      const res = await request(app)
        .get('/search')
        .query({ query: 'merlot', limit: '10' });
      expect(res.status).toBe(200);
      expect(mockController.searchWines).toHaveBeenCalled();
    });

    it('should require query parameter', async () => {
      const res = await request(app)
        .get('/search')
        .query({ limit: 10 });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e: any) => e.path.includes('query'))).toBe(true);
    });

    it('should accept valid search', async () => {
      const res = await request(app)
        .get('/search')
        .query({ query: 'merlot' });
      expect(res.status).toBe(200);
      expect(mockController.searchWines).toHaveBeenCalled();
    });
  });
});