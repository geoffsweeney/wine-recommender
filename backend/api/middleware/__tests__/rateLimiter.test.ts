import request from 'supertest';
import express from 'express';
import apiRateLimiter from '../rateLimiter'; // Adjust the path as necessary

describe('Rate Limiter Middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    // Apply the rate limiter to a test route
    app.get('/test', apiRateLimiter, (req, res) => {
      res.status(200).send('Success');
    });
  });

  it('should allow requests up to the limit', async () => {
    const limit = 100; // Based on the rate limiter config

    for (let i = 0; i < limit; i++) {
      await request(app).get('/test').expect(200);
    }
  });


  // Note: Testing the time window requires mocking timers or waiting,
  // which is more complex and might be beyond the scope of basic tests.
  // The express-rate-limit library itself is well-tested for this.
});