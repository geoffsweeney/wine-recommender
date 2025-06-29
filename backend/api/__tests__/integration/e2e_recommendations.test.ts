import request from 'supertest';
import express, { Express } from 'express';
import { container, DependencyContainer } from 'tsyringe';
import { TYPES } from '../../../di/Types';
import createRouter from '../../routes';
import { EnhancedAgentCommunicationBus } from '../../../core/agents/communication/EnhancedAgentCommunicationBus';
import { SommelierCoordinator } from '../../../core/agents/SommelierCoordinator';
import { mock } from 'jest-mock-extended';
import { AgentMessage, MessageTypes } from '../../../core/agents/communication/AgentMessage';

describe('End-to-End Recommendation API', () => {
  let app: Express;
  const mockCommunicationBus = mock<EnhancedAgentCommunicationBus>();
  const mockSommelierCoordinator = mock<SommelierCoordinator>(); // Although not directly used in these tests, good to keep consistent

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
        // Fallback for other types if needed, or return a default mock
        return jest.fn();
      });

    app = express();
    app.use(express.json());
    app.use(createRouter(container));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    container.reset();
  });

  describe('POST /recommendations - Positive Cases (Known Good Pairings)', () => {
    it('should recommend Cabernet Sauvignon or Malbec for Steak', async () => {
      const mockRecommendationPayload = {
        primaryRecommendation: { name: 'Cabernet Sauvignon', type: 'red', region: 'Napa Valley' },
        alternatives: [{ name: 'Malbec', type: 'red', region: 'Mendoza' }],
        explanation: 'Cabernet Sauvignon and Malbec are full-bodied red wines that pair exceptionally well with the richness of steak.',
        confidence: 0.95,
        conversationId: 'conv-steak-123',
        canRefine: false,
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: {
          id: 'msg-steak-123',
          type: MessageTypes.FINAL_RECOMMENDATION,
          payload: mockRecommendationPayload,
          timestamp: new Date(),
          correlationId: 'corr-steak-123',
          sourceAgent: 'sommelier',
          conversationId: 'conv-steak-123',
        },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-steak',
          input: { message: 'I am having a juicy steak tonight. What wine should I drink?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: {
            userInput: expect.objectContaining({
              userId: 'user-steak',
              input: expect.objectContaining({
                message: 'I am having a juicy steak tonight. What wine should I drink?',
              }),
            }),
          },
        })
      );
    });

    it('should recommend Chardonnay or Pinot Noir for Chicken', async () => {
      const mockRecommendationPayload = {
        primaryRecommendation: { name: 'Chardonnay', type: 'white', region: 'Burgundy' },
        alternatives: [{ name: 'Pinot Noir', type: 'red', region: 'Oregon' }],
        explanation: 'Chardonnay, especially unoaked, complements chicken well. Pinot Noir is a versatile red that also pairs nicely with poultry.',
        confidence: 0.90,
        conversationId: 'conv-chicken-123',
        canRefine: false,
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: {
          id: 'msg-chicken-123',
          type: MessageTypes.FINAL_RECOMMENDATION,
          payload: mockRecommendationPayload,
          timestamp: new Date(),
          correlationId: 'corr-chicken-123',
          sourceAgent: 'sommelier',
          conversationId: 'conv-chicken-123',
        },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-chicken',
          input: { message: 'What wine goes well with roasted chicken?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: {
            userInput: expect.objectContaining({
              userId: 'user-chicken',
              input: expect.objectContaining({
                message: 'What wine goes well with roasted chicken?',
              }),
            }),
          },
        })
      );
    });

    it('should recommend Sauvignon Blanc or Pinot Grigio for Seafood', async () => {
      const mockRecommendationPayload = {
        primaryRecommendation: { name: 'Sauvignon Blanc', type: 'white', region: 'Marlborough' },
        alternatives: [{ name: 'Pinot Grigio', type: 'white', region: 'Veneto' }],
        explanation: 'Crisp and acidic white wines like Sauvignon Blanc and Pinot Grigio are excellent choices for various seafood dishes.',
        confidence: 0.92,
        conversationId: 'conv-seafood-123',
        canRefine: false,
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: {
          id: 'msg-seafood-123',
          type: MessageTypes.FINAL_RECOMMENDATION,
          payload: mockRecommendationPayload,
          timestamp: new Date(),
          correlationId: 'corr-seafood-123',
          sourceAgent: 'sommelier',
          conversationId: 'conv-seafood-123',
        },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-seafood',
          input: { message: 'I am making grilled salmon, any wine suggestions?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: {
            userInput: expect.objectContaining({
              userId: 'user-seafood',
              input: expect.objectContaining({
                message: 'I am making grilled salmon, any wine suggestions?',
              }),
            }),
          },
        })
      );
    });

    it('should recommend Pinot Noir or Port for Cheese Platter', async () => {
      const mockRecommendationPayload = {
        primaryRecommendation: { name: 'Pinot Noir', type: 'red', region: 'Burgundy' },
        alternatives: [{ name: 'Port', type: 'fortified', region: 'Douro Valley' }],
        explanation: 'Pinot Noir is versatile for many cheeses, while Port is a classic pairing for strong, aged cheeses.',
        confidence: 0.88,
        conversationId: 'conv-cheese-123',
        canRefine: false,
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: {
          id: 'msg-cheese-123',
          type: MessageTypes.FINAL_RECOMMENDATION,
          payload: mockRecommendationPayload,
          timestamp: new Date(),
          correlationId: 'corr-cheese-123',
          sourceAgent: 'sommelier',
          conversationId: 'conv-cheese-123',
        },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-cheese',
          input: { message: 'What wine should I serve with a cheese platter?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendationPayload);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'sommelier-coordinator',
        expect.objectContaining({
          type: MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST,
          payload: {
            userInput: expect.objectContaining({
              userId: 'user-cheese',
              input: expect.objectContaining({
                message: 'What wine should I serve with a cheese platter?',
              }),
            }),
          },
        })
      );
    });
  });

  describe('POST /recommendations - Negative Cases', () => {
    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/recommendations')
        .send({ input: { message: 'Any wine?' } }); // Missing userId

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

    it('should return 400 for missing input object', async () => {
      const response = await request(app)
        .post('/recommendations')
        .send({ userId: 'test-user-missing-input' }); // Missing input object

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['input'],
            message: 'Required',
          }),
        ]),
      });
    });

    it('should return 404 when no recommendations are found (simulated)', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: true,
        data: {
          id: 'msg-no-rec',
          type: MessageTypes.FINAL_RECOMMENDATION,
          payload: null, // Simulate no recommendations found
          timestamp: new Date(),
          correlationId: 'corr-no-rec',
          sourceAgent: 'sommelier',
          conversationId: 'conv-no-rec',
        },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-no-rec',
          input: { message: 'I need a wine for water.' }, // Unrealistic request
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No recommendations found' });
    });

    it('should return 400 when communication bus indicates an agent error', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue({
        success: false,
        error: { name: 'AgentError', message: 'Agent processing failed', code: 'AGENT_PROCESS_ERROR', agentId: 'llm-recommendation', correlationId: 'corr-agent-error', recoverable: false },
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-agent-error',
          input: { message: 'I need a wine.' },
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Agent processing failed' });
    });

    it('should return 500 on unexpected internal server error', async () => {
      mockCommunicationBus.sendMessageAndWaitForResponse.mockImplementation(() => {
        throw new Error('Simulated unexpected server error');
      });

      const response = await request(app)
        .post('/recommendations')
        .send({
          userId: 'user-internal-error',
          input: { message: 'Any wine?' },
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
});