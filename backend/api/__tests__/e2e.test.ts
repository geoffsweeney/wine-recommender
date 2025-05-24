import "reflect-metadata"; // Required for tsyringe
import request from 'supertest';
import { Express } from 'express'; // Import Express type
import { container } from 'tsyringe'; // Import container

// Import dependencies that need to be registered
import { LLMService } from '../../services/LLMService';
import { AgentCommunicationBus } from '../../core/AgentCommunicationBus';
import { Neo4jService } from '../../services/Neo4jService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceExtractionService } from '../../services/PreferenceExtractionService';
import { InMemoryDeadLetterQueue } from '../../core/InMemoryDeadLetterQueue';
import { LoggingDeadLetterHandler } from '../../core/BasicDeadLetterProcessor';
import { BasicRetryManager } from '../../core/BasicRetryManager';
import { BasicDeadLetterProcessor } from '../../core/BasicDeadLetterProcessor';
import { ConversationHistoryService } from '../../core/ConversationHistoryService';
import { logger } from '../../utils/logger'; // Import the logger instance
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService'; // Import PreferenceNormalizationService


import { createServer } from '../../server'; // Adjusted path to the createServer function


describe('E2E Tests', () => {
  jest.setTimeout(30000); // Increase timeout for E2E tests
  let app: Express; // Explicitly define the type of app
  let server: any; // Declare server variable

  beforeAll(() => {
    console.log('e2e.test.ts: beforeAll started'); // Add logging
    container.clearInstances(); // Clear container before registering dependencies

    // Explicitly register core dependencies for E2E tests
    // These registrations mirror those in src/server.ts's registerDependencies function
    container.registerInstance('llmApiUrl', 'http://localhost:11434');
    container.registerInstance('llmModel', 'llama3.1:latest');
    container.registerInstance('llmApiKey', '');
    container.registerSingleton('LLMService', LLMService);

    // Instantiate and register AgentCommunicationBus and its dependencies
    const llmService = container.resolve(LLMService);
    const agentCommunicationBus = new AgentCommunicationBus(llmService);
    container.registerInstance(AgentCommunicationBus, agentCommunicationBus);

    // Instantiate and register Neo4jService
    const neo4jService = new Neo4jService();
    container.registerInstance(Neo4jService, neo4jService);

    // Instantiate and register KnowledgeGraphService
    const knowledgeGraphService = new KnowledgeGraphService(neo4jService);
    container.registerInstance('KnowledgeGraphService', knowledgeGraphService);

    // Instantiate and register PreferenceExtractionService
    const preferenceExtractionService = new PreferenceExtractionService(); // Assuming no dependencies
    container.registerInstance(PreferenceExtractionService, preferenceExtractionService);

    // Instantiate and register PreferenceNormalizationService
    const preferenceNormalizationService = new PreferenceNormalizationService(); // Assuming no dependencies
    container.registerInstance(PreferenceNormalizationService, preferenceNormalizationService);


    // Instantiate and register Dead Letter Queue and related components
    const deadLetterQueue = new InMemoryDeadLetterQueue();
    container.registerInstance('DeadLetterQueue', deadLetterQueue);

    const loggingDeadLetterHandler = new LoggingDeadLetterHandler();
    container.registerInstance(LoggingDeadLetterHandler, loggingDeadLetterHandler);

    const retryManager = new BasicRetryManager();
    container.registerInstance(BasicRetryManager, retryManager);

    // Instantiate and register DeadLetterProcessor
    const deadLetterProcessor = new BasicDeadLetterProcessor(deadLetterQueue, loggingDeadLetterHandler, retryManager);
    container.registerInstance('DeadLetterProcessor', deadLetterProcessor);

    // Instantiate and register ConversationHistoryService
    const conversationHistoryService = new ConversationHistoryService(); // Assuming no dependencies
    container.registerInstance(ConversationHistoryService, conversationHistoryService);

    // Register the logger (using the instance from src/utils/logger)
    container.registerInstance('logger', logger);


    app = createServer(); // Create the app instance after registering dependencies
    server = app.listen(0); // Start the server and assign to the server variable. Use port 0 to get a random available port.
  });

  it('should return a successful response for the health check', async () => {
    const response = await request(app).get('/api/health'); // Use the health check endpoint
    // console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy'); // Check for the status property
  });

  it('should return an error response for an invalid request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      // Missing required fields
    });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
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
    // console.log('Test response:', response.body); // Log the response body for debugging
    expect(response.status).toBe(200); // Expect a 200 status code
    expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  }, 30000); // Increased timeout to 30 seconds

  // it('should return a successful response for a valid ingredient-based recommendation request', async () => {
  //   const response = await request(app).post('/api/recommendations').send({
  //     userId: 'test-user-ingredient',
  //     input: { // Wrap ingredients in the 'input' property
  //       ingredients: ['beef'],
  //       recommendationSource: 'knowledgeGraph' // Added recommendationSource
  //     },
  //     conversationHistory: [] // Include an empty conversation history array
  //   });
  //   // console.log('Test response (ingredient-based):', response.body); // Log the response body for debugging
  //   expect(response.status).toBe(200); // Expect a 200 status code
  //   expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  // }, 30000); // Increased timeout to 30 seconds

  it('should return a successful response for an LLM-based recommendation request', async () => {
    const response = await request(app).post('/api/recommendations').send({
      userId: 'test-user-llm',
      input: { // Wrap message in the 'input' property
        message: 'Recommend a sweet white wine',
        recommendationSource: 'llm' // Set recommendationSource to 'llm'
      },
      conversationHistory: [] // Include an empty conversation history array
    });
    // console.log('Test response (LLM-based):', response.body); // Log the response body for debugging
    expect(response.status).toBe(200); // Expect a 200 status code
    expect(response.body).toHaveProperty('recommendation'); // Check for the recommendation property
  }, 30000); // Increased timeout to 30 seconds

  afterAll(async () => {
    console.log('e2e.test.ts: afterAll started'); // Add logging
    try {
      // Close server first
      if (server) { // Check if server is defined
        console.log('e2e.test.ts: Attempting to close server'); // Log before closing
        await new Promise((resolve, reject) => {
          server.close((err: Error | undefined) => { // Add type annotation for err
            if (err) {
              console.error('e2e.test.ts: Error closing server:', err); // Log the error
              reject(err);
            } else {
              console.log('e2e.test.ts: Server closed successfully'); // Log successful closure
              resolve(undefined);
            }
          });
        });
        console.log('e2e.test.ts: server.close() promise resolved'); // Log after closing
      } else {
        console.log('e2e.test.ts: Server instance not found, skipping close'); // Log if server is not defined
      }
    } catch (error) {
      console.error('e2e.test.ts: Error during server closure promise:', error); // More specific error logging
    }

    try {
      // Close database connections
      const neo4jService = container.resolve(Neo4jService);
      await neo4jService.close();
    } catch (error) {
      console.error('Error closing Neo4j connections:', error);
    }

    try {
      // Clean up container - use reset() instead of dispose()
      container.reset();
    } catch (error) {
      console.error('Error resetting container:', error);
    }
  });
});
