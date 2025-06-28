import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { DependencyContainer } from 'tsyringe';
import { createServer } from '../../server';
import { EnhancedAgentCommunicationBus } from '../../core/agents/communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from '../../core/agents/communication/AgentMessage';
import { TYPES } from '../../di/Types';
import { SommelierCoordinator } from '../../core/agents/SommelierCoordinator';
import { v4 as uuidv4 } from 'uuid';
import { createTestContainer } from '../../test-setup';
import { LLMService } from '../../services/LLMService';
import { Neo4jService } from '../../services/Neo4jService';
import { mock } from 'jest-mock-extended';
import { AgentError } from '../../core/agents/AgentError'; // Added

describe('Recommendations API', () => {
  let app: Express;
  let server: Server;
  let container: DependencyContainer;
  let resetMocks: () => void;
  let coordinator: SommelierCoordinator;
  let communicationBus: EnhancedAgentCommunicationBus;
  let mockLLMService: LLMService;
  let mockNeo4jService: Neo4jService;

  beforeEach(async () => {
    ({ container, resetMocks } = createTestContainer());

    // Get mocked instances from the container
    communicationBus = container.resolve(TYPES.AgentCommunicationBus) as jest.Mocked<EnhancedAgentCommunicationBus>;
    mockLLMService = container.resolve(TYPES.LLMService) as LLMService;
    mockNeo4jService = container.resolve(TYPES.Neo4jService) as Neo4jService;


    // Mock sendMessageAndWaitForResponse to return a successful recommendation
    (communicationBus.sendMessageAndWaitForResponse as jest.Mock).mockImplementation(async (targetAgentId: string, message: AgentMessage) => {
      if (targetAgentId === 'sommelier-coordinator' && message.type === MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST) {
        return {
          success: true,
          data: createAgentMessage(
            MessageTypes.FINAL_RECOMMENDATION,
            {
              primaryRecommendation: {
                id: 'w1',
                name: 'Wine 1',
                type: 'Red',
                region: 'Bordeaux',
                year: 2018,
                price: 45.99,
                rating: 4.5,
                description: 'Full-bodied with notes of black cherry'
              },
              alternatives: [],
              explanation: 'Mock explanation',
              confidence: 0.9,
              conversationId: message.conversationId,
              canRefine: false,
            },
            'sommelier-coordinator',
            message.conversationId,
            message.correlationId,
            message.sourceAgent
          )
        };
      }
      return { success: false, error: new AgentError('Unexpected message', 'UNEXPECTED_MESSAGE', 'test-suite', message.correlationId) };
    });

    // Resolve SommelierCoordinator from the container
    coordinator = container.resolve(SommelierCoordinator);

    // Create the Express app
    app = createServer(container);

    // Start the server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
  });

  afterEach(async () => {
    // Close the server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    resetMocks();
    jest.clearAllMocks();
  });

  it('should return recommendation for valid input', async () => {
    // Increase timeout to 30 seconds
    const response = await request(app)
      .post('/api/recommendations')
      .send({
        userId: 'test-user',
        input: {
          preferences: {
            wineType: 'red',
            priceRange: [20, 50] // Corrected to match Zod schema (tuple of numbers)
          }
        }
      })
      .expect(200);

    // The response body structure will now be an AgentMessage
    expect(response.body).toEqual(
      expect.objectContaining({
        primaryRecommendation: expect.objectContaining({
          id: 'w1',
          name: 'Wine 1',
          type: 'Red',
          region: 'Bordeaux',
          year: 2018,
          price: 45.99,
          rating: 4.5,
          description: 'Full-bodied with notes of black cherry'
        }),
        alternatives: expect.arrayContaining([]),
        explanation: 'Mock explanation',
        confidence: expect.any(Number),
        conversationId: expect.any(String),
        canRefine: expect.any(Boolean),
      })
    );

  }, 30000); // Increase timeout to 30 seconds
  it('should return 400 if communicationBus.sendMessageAndWaitForResponse returns failure', async () => {
    (communicationBus.sendMessageAndWaitForResponse as jest.Mock).mockImplementation(async () => {
      return { success: false, error: new AgentError('Test error message', 'TEST_ERROR', 'test-suite', uuidv4()) };
    });

    const response = await request(app)
      .post('/api/recommendations')
      .send({
        userId: 'test-user',
        input: {
          preferences: {
            wineType: 'red',
            priceRange: [20, 50]
          }
        }
      })
      .expect(400);

    expect(response.body.error).toBe('Test error message');
  }, 30000);

  it('should return 404 if communicationBus.sendMessageAndWaitForResponse returns null data', async () => {
    (communicationBus.sendMessageAndWaitForResponse as jest.Mock).mockImplementation(async () => {
      return { success: true, data: null };
    });

    const response = await request(app)
      .post('/api/recommendations')
      .send({
        userId: 'test-user',
        input: {
          preferences: {
            wineType: 'red',
            priceRange: [20, 50]
          }
        }
      })
      .expect(404);

    expect(response.body.error).toBe('No recommendations found');
  }, 30000);

  it('should return 500 for unexpected errors', async () => {
    (communicationBus.sendMessageAndWaitForResponse as jest.Mock).mockImplementation(async () => {
      throw new Error('Unexpected internal error');
    });

    const response = await request(app)
      .post('/api/recommendations')
      .send({
        userId: 'test-user',
        input: {
          preferences: {
            wineType: 'red',
            priceRange: [20, 50]
          }
        }
      })
      .expect(500);

    expect(response.body.error).toBe('Internal server error');
  }, 30000);

  it('should return 400 for invalid input', async () => {
    const response = await request(app)
      .post('/api/recommendations')
      .send({
        // Missing userId and invalid priceRange
        input: {
          preferences: {
            wineType: 'red',
            priceRange: 'invalid' // Should be a tuple
          }
        }
      })
      .expect(400);

    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_type',
          path: ['userId'],
          message: 'Required'
        }),
        expect.objectContaining({
          code: 'invalid_type',
          path: ['input', 'preferences', 'priceRange'],
          message: 'Expected array, received string'
        })
      ])
    );
  }, 30000);
});
