// Import necessary modules
import request from 'supertest';
import { createServer } from '../../server';
import { container } from 'tsyringe';

// Describe the test suite for the /search endpoint
describe('Search Endpoint E2E Tests', () => {
  let app: any;

  // Before all tests, create the server
  beforeAll(() => {
    app = createServer();
  });

  // Test case for a valid search query
  it('should return search results for a valid query', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ query: 'red wine' })
      .expect(200);

    expect(response.body).toHaveProperty('results');
  });

  // Test case for an invalid search query
  it('should return an error for an invalid query', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ query: '' })
      .expect(400);

    expect(response.body).toHaveProperty('errors'); // Check for 'errors' array
  });

  // Test case for a missing query parameter
  it('should return an error for a missing query parameter', async () => {
    const response = await request(app)
      .get('/api/search')
      .expect(400);

    expect(response.body).toHaveProperty('errors'); // Check for 'errors' array
  });
});