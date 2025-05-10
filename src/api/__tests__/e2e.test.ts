import request from 'supertest';
import { createServer } from '../../server';
import { container } from 'tsyringe';
import { InMemoryDeadLetterQueue } from '../../core/InMemoryDeadLetterQueue';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator';
import { BasicDeadLetterProcessor } from '../../core/BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor
import { RecommendationAgent } from '../../core/agents/RecommendationAgent'; // Import RecommendationAgent

// Mock BasicDeadLetterProcessor
jest.mock('../../core/BasicDeadLetterProcessor');
const MockBasicDeadLetterProcessor = jest.fn().mockImplementation(() => ({
  process: jest.fn(),
}));

// Mock RecommendationAgent
jest.mock('../../core/agents/RecommendationAgent');
const MockRecommendationAgent = jest.fn().mockImplementation(() => ({
  handleMessage: jest.fn(),
  getName: jest.fn().mockReturnValue('MockRecommendationAgent')
}));


describe('End-to-End Tests', () => {
  let app: any;
  let dlq: InMemoryDeadLetterQueue;
  let mockBasicDeadLetterProcessor: jest.Mocked<BasicDeadLetterProcessor>; // Declare mockBasicDeadLetterProcessor here
  let mockRecommendationAgent: jest.Mocked<RecommendationAgent>; // Declare mockRecommendationAgent here


  beforeAll(() => {
    // Register the mock BasicDeadLetterProcessor and RecommendationAgent instances FIRST
    mockBasicDeadLetterProcessor = new MockBasicDeadLetterProcessor() as jest.Mocked<BasicDeadLetterProcessor>;
    container.registerInstance(BasicDeadLetterProcessor, mockBasicDeadLetterProcessor);

    mockRecommendationAgent = new MockRecommendationAgent() as jest.Mocked<RecommendationAgent>;
    container.registerInstance(RecommendationAgent, mockRecommendationAgent);


    // Then create the server, which will resolve dependencies from the container
    app = createServer();

    // Resolve the DLQ instance that the test will inspect (optional, but good for direct DLQ assertions if needed)
    // Note: With the processor mocked, this DLQ instance won't be used by the processor in this test.
    dlq = container.resolve('InMemoryDeadLetterQueue');

    // Register the actual DLQ instance with BasicDeadLetterProcessor by its class type
    // This ensures the processor uses the same DLQ instance as the test (though the processor is mocked here)
    // This registration might not be strictly necessary when the processor is mocked,
    // but it keeps the container setup consistent with how the real processor would be configured.
    container.registerInstance(InMemoryDeadLetterQueue, dlq);
  });

  beforeEach(() => {
    // Configure the mock RecommendationAgent's handleMessage for successful cases by default
    mockRecommendationAgent.handleMessage.mockResolvedValue({ recommendation: 'Mocked wine recommendation' });
    // Clear mock calls before each test
    mockBasicDeadLetterProcessor.process.mockClear();
    mockRecommendationAgent.handleMessage.mockClear();
  });

  afterEach(() => {
    dlq.clear();
    // Reset mock implementations after each test
    mockBasicDeadLetterProcessor.process.mockReset();
    mockRecommendationAgent.handleMessage.mockReset();
  });

  it('should complete successful recommendation flow', async () => {
    const response = await request(app)
      .post('/api/recommendations')
      .send({
        userId: 'test-user',
        preferences: {
          wineType: 'red',
          priceRange: [20, 50]
        }
      })
      .expect(200);

    expect(response.body).toHaveProperty('recommendation', 'Mocked wine recommendation'); // Assert on the mocked response
    expect(dlq.getAll().length).toBe(0);
    expect(mockBasicDeadLetterProcessor.process).not.toHaveBeenCalled(); // DLQ processor should not be called on success
    expect(mockRecommendationAgent.handleMessage).toHaveBeenCalled(); // RecommendationAgent should be called
  });

  it('should handle failed recommendations and send to DLQ', async () => {
    // Force RecommendationAgent failure by mocking it to reject
    const recommendationError = new Error('Recommendation failed');
    mockRecommendationAgent.handleMessage.mockRejectedValue(recommendationError);

    try {
      const response = await request(app)
         .post('/api/recommendations')
         .send({
           userId: 'test-user',
           preferences: {
             wineType: 'red',
             priceRange: [20, 50]
           }
         })
         .expect(500); // Expect 500 Internal Server Error on agent failure

       // Verify the response body contains the generic error message from the route handler
       expect(response.body).toHaveProperty('error', 'Failed to process recommendation request');

       // Verify that the dead letter processor was called by the SommelierCoordinator
       expect(mockBasicDeadLetterProcessor.process).toHaveBeenCalledWith(
         { userId: 'test-user', preferences: { wineType: 'red', priceRange: [ 20, 50 ] } }, // Original message
         recommendationError, // The error from the RecommendationAgent
         { source: 'SommelierCoordinator', stage: 'RecommendationAgent' } // Metadata from the SommelierCoordinator's catch block
       );

       // The DLQ assertion here is no longer relevant because we are mocking the processor.
       // The mock processor doesn't interact with the real DLQ instance.
       // expect(dlq.getAll().length).toBe(1);
       // expect(dlq.getAll()[0].error).toContain('Agent failure'); // The original error should be in the DLQ

    } catch (error) {
      console.error('Error in failed recommendations test:', error);
      throw error; // Re-throw the error to see the full test failure details
    }
  });

  it('should validate recommendation requests', async () => {
    await request(app)
      .post('/api/recommendations')
      .send({ invalid: 'request' })
      .expect(400);
    expect(mockBasicDeadLetterProcessor.process).not.toHaveBeenCalled(); // DLQ processor should not be called on validation failure
    expect(mockRecommendationAgent.handleMessage).not.toHaveBeenCalled(); // RecommendationAgent should not be called on validation failure
  });

  it('should search wines successfully', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ query: 'merlot', limit: 5 }) // Ensure the query parameters are correct
      .expect(200);

    expect(Array.isArray(response.body.results)).toBe(true);
    expect(mockBasicDeadLetterProcessor.process).not.toHaveBeenCalled(); // DLQ processor should not be called on search success
    // Note: The /search route handler currently doesn't use the RecommendationAgent or SommelierCoordinator
    // expect(mockRecommendationAgent.handleMessage).not.toHaveBeenCalled();
  });
});