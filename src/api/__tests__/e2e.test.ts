import request from 'supertest';
import { createServer } from '../../server'; // Adjusted path to the createServer function
import { Express } from 'express'; // Import Express type

describe('E2E Tests', () => {
  jest.setTimeout(10000); // Increase timeout for E2E tests
  let app: Express; // Explicitly define the type of app

  beforeAll(() => {
    app = createServer(); // Create the app instance
  });

  it('should return a successful response for the health check', async () => {
    const response = await request(app).get('/api/health'); // Use the health check endpoint
    console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.body).toHaveProperty('status', 'healthy'); // Check for the status property
  });

  it('should return an error response for an invalid request', async () => {
    const response = await request(app).get('/api/invalid-endpoint'); // Adjust the endpoint
    expect(response.status).toBe(404); // Expecting a 404 Not Found response
  });
it('should return a successful response for a valid recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user',
      input: { // Wrap preferences in the 'input' property
        preferences: {
          wineType: 'red',
          priceRange: [10, 30],
          foodPairing: 'salmon',
          excludeAllergens: []
        },
        message: 'Recommend a wine for salmon' // Added message field
      },
      recommendationSource: 'knowledgeGraph', // Added recommendationSource
      conversationHistory: [] // Include an empty conversation history array
    });
    console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  }, 30000); // Increased timeout to 30 seconds

  it('should return a successful response for a valid ingredient-based recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user-ingredient',
      input: { // Wrap ingredients in the 'input' property
        ingredients: ['beef'],
        recommendationSource: 'knowledgeGraph' // Added recommendationSource
      },
      conversationHistory: [] // Include an empty conversation history array
    });
    console.log('Test response (ingredient-based):', response.body); // Log the response body for debugging
    expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  }, 30000); // Increased timeout to 30 seconds
  it('should return a successful response for an LLM-based recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user-llm',
      input: { // Wrap message in the 'input' property
        message: 'Recommend a sweet white wine',
        recommendationSource: 'llm' // Set recommendationSource to 'llm'
      },
      conversationHistory: [] // Include an empty conversation history array
    });
    console.log('Test response (LLM-based):', response.body); // Log the response body for debugging
    expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  }, 30000); // Increased timeout to 30 seconds
});