import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { RecommendationAgent, RecommendationAgentConfig } from '../RecommendationAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { LLMService } from '@src/services/LLMService';
import { KnowledgeGraphService } from '@src/services/KnowledgeGraphService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';

// Test wrapper to access protected properties for testing
class TestRecommendationAgent extends RecommendationAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testEnhanceRecommendations(recommendedWines: any[], payload: any, recommendationType: string, correlationId: string): Promise<any> {
    return (this as any).enhanceRecommendations(recommendedWines, payload, recommendationType, correlationId);
  }
  public testHandleNoWinesFound(message: any, recommendationType: string, correlationId: string): Promise<void> {
    return (this as any).handleNoWinesFound(message, recommendationType, correlationId);
  }
}

describe('RecommendationAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockLLMService: LLMService;
  let mockKnowledgeGraphService: KnowledgeGraphService;
  let agent: TestRecommendationAgent;
  let mockAgentConfig: RecommendationAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as winston.Logger; // Manual mock for winston.Logger
    mockLLMService = mockDeep<LLMService>();
    mockKnowledgeGraphService = mockDeep<KnowledgeGraphService>();
    mockAgentConfig = {
      defaultRecommendationCount: 5
    };
    jest.clearAllMocks();
    agent = new TestRecommendationAgent(
      mockLLMService,
      mockKnowledgeGraphService,
      mockDeadLetter,
      mockLogger,
      mockBus,
      mockAgentConfig
    );
  });

  afterEach(() => {
    // console.log('mockLogger.error calls:', mockLogger.error.mock.calls);
    // console.log('mockLogger.warn calls:', mockLogger.warn.mock.calls);
    // console.log('mockLogger.info calls:', mockLogger.info.mock.calls);
    // console.log('mockBus.sendResponse calls:', mockBus.sendResponse.mock.calls);
    // console.log('mockBus.publishToAgent calls:', mockBus.publishToAgent.mock.calls);
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getName()).toBe('RecommendationAgent');
    expect(agent.getAgentId()).toBe('recommendation-agent');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[recommendation-agent] RecommendationAgent initialized'),
      expect.any(Object)
    );
  });

  describe('handleMessage', () => {
    it('should return an error for unhandled message types', async () => {
      const message = createAgentMessage(
        'unhandled-type',
        { some: 'payload' },
        'test-agent',
        'test-conversation-id',
        'corr-unhandled',
        'recommendation-agent'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] RecommendationAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handleRecommendationRequest', () => {
    it('should return an error if payload input is missing', async () => {
      const message = createAgentMessage(
        'recommendation-request',
        { }, // Missing input
        'source-agent',
        'conv-invalid',
        'corr-invalid-payload',
        'recommendation-agent'
      );

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MISSING_PAYLOAD_INPUT');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-invalid-payload] RecommendationAgent.handleRecommendationRequest entered'),
          expect.any(Object)
        );
      }
    });

    it('should process an ingredient-based recommendation request successfully', async () => {
      const messagePayload = {
        input: { ingredients: ['beef'] },
        userId: 'user123'
      };
      const message = createAgentMessage(
        'recommendation-request',
        messagePayload,
        'source-agent',
        'conv-ingredient',
        'corr-ingredient',
        'recommendation-agent'
      );

      const mockWines = [{ id: '1', name: 'Wine A', region: 'Region A', type: 'Red' }];
      (mockKnowledgeGraphService.findWinesByIngredients as jest.Mock).mockResolvedValueOnce(mockWines);
      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({ recommendedWines: mockWines, llmEnhancement: 'Enhanced by LLM' })
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockKnowledgeGraphService.findWinesByIngredients).toHaveBeenCalledWith(['beef']);
        expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'recommendation-response',
            payload: expect.objectContaining({
              recommendedWines: mockWines,
              llmEnhancement: 'Enhanced by LLM'
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-ingredient] Handling ingredient-based request'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-ingredient] Recommendation request processed successfully'),
          expect.any(Object)
        );
      }
    });

    it('should process a preference-based recommendation request successfully', async () => {
      const messagePayload = {
        input: { preferences: { color: 'red' } },
        userId: 'user123'
      };
      const message = createAgentMessage(
        'recommendation-request',
        messagePayload,
        'source-agent',
        'conv-preference',
        'corr-preference',
        'recommendation-agent'
      );

      const mockWines = [{ id: '2', name: 'Wine B', region: 'Region B', type: 'Red' }];
      (mockKnowledgeGraphService.findWinesByPreferences as jest.Mock).mockResolvedValueOnce(mockWines);
      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({ recommendedWines: mockWines, llmEnhancement: 'Enhanced by LLM' })
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockKnowledgeGraphService.findWinesByPreferences).toHaveBeenCalledWith({ color: 'red' });
        expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'recommendation-response',
            payload: expect.objectContaining({
              recommendedWines: mockWines,
              llmEnhancement: 'Enhanced by LLM'
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-preference] Handling preference-based request'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-preference] Recommendation request processed successfully'),
          expect.any(Object)
        );
      }
    });

    it('should handle no wines found and send appropriate response', async () => {
      const messagePayload = {
        input: { ingredients: ['non-existent'] },
        userId: 'user123'
      };
      const message = createAgentMessage(
        'recommendation-request',
        messagePayload,
        'source-agent',
        'conv-no-wines',
        'corr-no-wines',
        'recommendation-agent'
      );

      (mockKnowledgeGraphService.findWinesByIngredients as jest.Mock).mockResolvedValueOnce([]); // No wines found

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true); // Agent successfully handled no wines found
      if (result.success) {
        expect(mockKnowledgeGraphService.findWinesByIngredients).toHaveBeenCalledWith(['non-existent']);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'recommendation-response',
            payload: expect.objectContaining({
              recommendedWines: [],
              error: 'No wines found matching ingredients criteria'
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-no-wines] No wines found for request'),
          expect.any(Object)
        );
      }
    });

    it('should handle general exceptions during processing', async () => {
      const messagePayload = {
        input: { ingredients: ['beef'] },
        userId: 'user123'
      };
      const message = createAgentMessage(
        'recommendation-request',
        messagePayload,
        'source-agent',
        'conv-general-exception',
        'corr-general-exception',
        'recommendation-agent'
      );

      (mockKnowledgeGraphService.findWinesByIngredients as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('RECOMMENDATION_PROCESSING_ERROR');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] RecommendationAgent.handleRecommendationRequest entered'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Error processing recommendation request: Database error'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handlePreferenceUpdate', () => {
    it('should log debug message for successful preference update', async () => {
      const message = createAgentMessage(
        'preference-update-result',
        { success: true, preferences: { color: 'red' } },
        'source-agent',
        'conv-pref-update',
        'corr-pref-update',
        'recommendation-agent'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[corr-pref-update] Received preference update'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[corr-pref-update] Processing updated preferences'),
        expect.any(Object)
      );
    });

    it('should return error for failed preference update', async () => {
      const message = createAgentMessage(
        'preference-update-result',
        { success: false, error: 'Update failed' },
        'source-agent',
        'conv-pref-fail',
        'corr-pref-fail',
        'recommendation-agent'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('PREFERENCE_UPDATE_FAILED');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('[corr-pref-fail] Received preference update'),
          expect.any(Object)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-pref-fail] Preference update failed: Update failed'),
          expect.any(Object)
        );
      }
    });
  });

  describe('enhanceRecommendations', () => {
    const mockWines = [{ id: '1', name: 'Wine A', region: 'Region A', type: 'Red' }];
    const payload = { input: { ingredients: ['beef'] } };
    const recommendationType = 'ingredients';
    const correlationId = 'corr-enhance';

    it('should enhance recommendations with LLM response', async () => {
      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({ recommendedWines: mockWines, llmEnhancement: 'Enhanced by LLM' })
      });

      const result = await agent.testEnhanceRecommendations(mockWines, payload, recommendationType, correlationId);
      expect(result).toEqual({ recommendedWines: mockWines, llmEnhancement: 'Enhanced by LLM' });
      expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning for successful enhancement
      expect(mockLogger.error).not.toHaveBeenCalled(); // No error for successful enhancement
    });

    it('should return original recommendations if LLM service fails', async () => {
      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new Error('LLM API is down')
      });

      const result = await agent.testEnhanceRecommendations(mockWines, payload, recommendationType, correlationId);
      expect(result).toEqual({ recommendedWines: mockWines });
      expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[corr-enhance] LLM enhancement failed: LLM API is down'),
        expect.any(Object)
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return original recommendations if LLM response format is invalid', async () => {
      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'invalid json'
      });

      const result = await agent.testEnhanceRecommendations(mockWines, payload, recommendationType, correlationId);
      expect(result).toEqual({ recommendedWines: mockWines });
      expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[corr-enhance] Error enhancing recommendations: Unexpected token'),
        expect.any(Object)
      );
    });

    it('should return original recommendations for general exceptions', async () => {
      (mockLLMService.sendPrompt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const result = await agent.testEnhanceRecommendations(mockWines, payload, recommendationType, correlationId);
      expect(result).toEqual({ recommendedWines: mockWines });
      expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[corr-enhance] Error enhancing recommendations: Unexpected error'),
        expect.any(Object)
      );
    });
  });

  describe('handleNoWinesFound', () => {
    it('should send a recommendation-response with no wines and an error message', async () => {
      const message = createAgentMessage(
        'recommendation-request',
        { input: { ingredients: ['non-existent'] } },
        'source-agent',
        'conv-no-wines',
        'corr-no-wines',
        'recommendation-agent'
      );
      const recommendationType = 'ingredients';
      const correlationId = 'corr-no-wines';

      await agent.testHandleNoWinesFound(message, recommendationType, correlationId);

      expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
      expect(mockBus.sendResponse).toHaveBeenCalledWith(
        'source-agent',
        expect.objectContaining({
          type: 'recommendation-response',
          payload: expect.objectContaining({
            recommendedWines: [],
            error: 'No wines found matching ingredients criteria'
          })
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[corr-no-wines] No wines found for request'),
        expect.any(Object)
      );
    });
  });
});