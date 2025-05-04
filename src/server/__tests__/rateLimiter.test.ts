import request from 'supertest';
import { createServer } from '../../server';
import { Express } from 'express';
import { container } from 'tsyringe';
import { MockNeo4jService } from '../../services/MockNeo4jService';

describe('Rate Limiting', () => {
  let app: Express;

  beforeAll(() => {
    // Force mock service for tests
    container.register('Neo4jService', {
      useClass: MockNeo4jService
    });
    app = createServer();
    
    // Add test routes
    app.get('/test-rate-limit', (req, res) => {
      res.status(200).json({ success: true });
    });

    app.get('/test-rate-limit-2', (req, res) => {
      res.status(200).json({ success: true });
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/test-rate-limit');
        expect(response.status).toBe(200);
      }
    });

    it('should block requests over the limit', async () => {
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test-rate-limit');
      }
      
      const response = await request(app).get('/test-rate-limit');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should track different endpoints separately', async () => {
      // Use up limit on first endpoint
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test-rate-limit');
      }
      
      // Second endpoint should still work
      const response = await request(app).get('/test-rate-limit-2');
      expect(response.status).toBe(200);
    });

    it('should include proper rate limit headers', async () => {
      // Create a fresh server instance for this test
      const testApp = createServer();
      testApp.get('/test-rate-limit', (req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(testApp).get('/test-rate-limit');
      expect(response.headers['ratelimit-limit']).toBe('100');
      expect(response.headers['ratelimit-remaining']).toBe('99');
    });

    it('should reset after window expires', async () => {
      // Use up limit
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test-rate-limit');
      }
      
      // Mock time passing
      jest.useFakeTimers();
      jest.advanceTimersByTime(15 * 60 * 1000 + 1);
      
      // Should work again
      const response = await request(app).get('/test-rate-limit');
      expect(response.status).toBe(200);
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should return 429 with message when rate limited', async () => {
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test-rate-limit');
      }
      
      const response = await request(app).get('/test-rate-limit');
      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/please try again later/i);
    });
  });
});