import express, { Express } from 'express';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { container } from 'tsyringe';
import { AgentMessage, MessageTypes } from '../../../core/agents/communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../../../core/agents/communication/EnhancedAgentCommunicationBus';
import { SommelierCoordinator } from '../../../core/agents/SommelierCoordinator'; // Import SommelierCoordinator
import { TYPES } from '../../../di/Types';
import createRouter from '../../routes'; // Import createRouter function

describe('RecommendationRoutes', () => {
  let app: Express;
  const mockCommunicationBus = mock<EnhancedAgentCommunicationBus>();
  const mockSommelierCoordinator = mock<SommelierCoordinator>();

  beforeAll(() => {
    // Mock container.resolve for the specific types used in routes.ts
    jest.spyOn(container, 'resolve')
      .mockImplementation((token: any) => {
        if (token === TYPES.AgentCommunicationBus) {
          return mockCommunicationBus;
        }
        if (token === TYPES.SommelierCoordinator) {
          return mockSommelierCoordinator;
        }
        // Fallback for other types if needed, or throw an error for unmocked types
        return jest.fn(); // Or return a default mock
      });

    app = express();
    app.use(express.json());
    app.use(createRouter(container)); // Call createRouter to get the router instance
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks(); // Restore original implementations
    container.reset();
  });

  describe('POST /recommendations', () => {
    it('should return 200 with recommendations when communication bus returns success', async () => {
      const mockRecommendationPayload = {
        recommendations: [{ wine: 'Chardonnay', score: 0.9 }],
      };
      const mockAgentMessage: AgentMessage = {
        id: 'msg-123',
        type: MessageTypes.FINAL_RECOMMENDATION,
        payload: mockRecommendationPayload,
        timestamp: new Date(),
        correlationId: 'corr-123',
        sourceAgent: 'sommelier',
        conversationId: 'conv-123', // Added conversationId
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: mockAgentMessage,
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-123',
          input: { preferences: { wineType: 'red' } },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: expect.objectContaining({
            userInput: expect.objectContaining({
              userId: 'test-user-123',
              input: expect.objectContaining({ preferences: { wineType: 'red' }, recommendationSource: 'knowledgeGraph' }),
            }),
            conversationId: expect.any(String),
            correlationId: expect.any(String),
            sourceAgent: 'api',
          }),
          targetAgent: 'sommelier-coordinator',
        })
      );
    });

    it('should return 400 when communication bus returns an error', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: false,
        error: { name: 'AgentError', message: 'Agent error', code: 'AGENT_ERROR', agentId: 'sommelier', correlationId: 'corr-456', recoverable: true },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-123',
          input: { preferences: { wineType: 'red' } },
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Agent error' });
    });

    it('should return 404 when communication bus returns null data', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: null,
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-123',
          input: { preferences: { wineType: 'red' } },
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No recommendations found' });
    });

    it('should return 500 on unexpected errors', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockImplementation(() => {
        throw new Error('Unexpected internal error');
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-123',
          input: { preferences: { wineType: 'red' } },
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should return 400 for invalid input (e.g., missing userId)', async () => {
      const response = await request(app)
        .post('/recommendations')
        .send({ input: { preferences: { wineType: 'red' } } }); // Missing 'userId'

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['userId'],
            message: 'Required',
          }),
        ]),
      });
    });

    it('should return 400 for an empty request body', async () => {
      const response = await request(app)
        .post('/recommendations')
        .send({}); // Empty body

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['userId'],
            message: 'Required',
          }),
          expect.objectContaining({
            path: ['input'],
            message: 'Required',
          }),
        ]),
      });
    });

    it('should return 200 with recommendations for food pairing input', async () => {
      const mockRecommendationPayload = {
        recommendations: [{ wine: 'Cabernet Sauvignon', score: 0.95 }],
      };
      const mockAgentMessage: AgentMessage = {
        id: 'msg-fp-123',
        type: MessageTypes.FINAL_RECOMMENDATION,
        payload: mockRecommendationPayload,
        timestamp: new Date(),
        correlationId: 'corr-fp-123',
        sourceAgent: 'sommelier',
        conversationId: 'conv-fp-123',
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: mockAgentMessage,
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-fp',
          input: { preferences: { foodPairing: 'steak' } },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: expect.objectContaining({
            userInput: expect.objectContaining({
              userId: 'test-user-fp',
              input: expect.objectContaining({ preferences: { foodPairing: 'steak', wineType: 'red' }, recommendationSource: 'knowledgeGraph' }),
            }),
            conversationId: expect.any(String),
            correlationId: expect.any(String),
            sourceAgent: 'api',
          }),
          targetAgent: 'sommelier-coordinator',
        })
      );
    });

    it('should return 200 with recommendations for ingredients input', async () => {
      const mockRecommendationPayload = {
        recommendations: [{ wine: 'Pinot Noir', score: 0.92 }],
      };
      const mockAgentMessage: AgentMessage = {
        id: 'msg-ing-123',
        type: MessageTypes.FINAL_RECOMMENDATION,
        payload: mockRecommendationPayload,
        timestamp: new Date(),
        correlationId: 'corr-ing-123',
        sourceAgent: 'sommelier',
        conversationId: 'conv-ing-123',
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: mockAgentMessage,
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-ing',
          input: { ingredients: ['chicken', 'mushrooms'] },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: expect.objectContaining({
            userInput: expect.objectContaining({
              userId: 'test-user-ing',
              input: expect.objectContaining({ ingredients: ['chicken', 'mushrooms'], recommendationSource: 'knowledgeGraph' }),
            }),
            conversationId: expect.any(String),
            correlationId: expect.any(String),
            sourceAgent: 'api',
          }),
          targetAgent: 'sommelier-coordinator',
        })
      );
    });

    it('should return 200 with recommendations for conversation history input', async () => {
      const mockRecommendationPayload = {
        recommendations: [{ wine: 'Merlot', score: 0.88 }],
      };
      const mockAgentMessage: AgentMessage = {
        id: 'msg-conv-123',
        type: MessageTypes.FINAL_RECOMMENDATION,
        payload: mockRecommendationPayload,
        timestamp: new Date(),
        correlationId: 'corr-conv-123',
        sourceAgent: 'sommelier',
        conversationId: 'conv-conv-123',
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: mockAgentMessage,
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'test-user-conv',
          input: { message: 'I like light-bodied red wines.' },
          conversationHistory: [
            { role: 'user', content: 'Hi, I need a wine recommendation.' },
            { role: 'assistant', content: 'Sure, what are you looking for?' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: expect.objectContaining({
            userInput: expect.objectContaining({
              userId: 'test-user-conv',
              input: expect.objectContaining({ message: 'I like light-bodied red wines.', recommendationSource: 'knowledgeGraph' }),
              conversationHistory: expect.arrayContaining([
                expect.objectContaining({ role: 'user', content: 'Hi, I need a wine recommendation.' }),
                expect.objectContaining({ role: 'assistant', content: 'Sure, what are you looking for?' }),
              ]),
            }),
            conversationId: expect.any(String),
            correlationId: expect.any(String),
            sourceAgent: 'api',
          }),
          targetAgent: 'sommelier-coordinator',
        })
      );
    });
  });
});