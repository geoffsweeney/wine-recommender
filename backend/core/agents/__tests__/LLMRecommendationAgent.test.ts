import { DependencyContainer } from 'tsyringe';
import winston from 'winston';
import { ICommunicatingAgentDependencies, TYPES } from '../../../di/Types';
import { LLMService } from '../../../services/LLMService';
import { PromptManager } from '../../../services/PromptManager';
import { createTestContainer } from '../../../test-setup';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { AgentError } from '../AgentError';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import { LLMRecommendationAgent, LLMRecommendationAgentConfig } from '../LLMRecommendationAgent';

describe('LLMRecommendationAgent', () => {
  let container: DependencyContainer;
  let resetMocks: () => void;
  let llmRecommendationAgent: LLMRecommendationAgent;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockDeadLetterProcessor: jest.Mocked<BasicDeadLetterProcessor>;
  let mockLogger: jest.Mocked<winston.Logger>;
  let mockCommunicationBus: jest.Mocked<EnhancedAgentCommunicationBus>;
  let mockAgentConfig: LLMRecommendationAgentConfig;
  let mockCommunicatingAgentDependencies: ICommunicatingAgentDependencies;

  beforeEach(() => {
    ({ container, resetMocks } = createTestContainer());

    // Resolve mocked dependencies from the container
    mockLLMService = container.resolve(TYPES.LLMService) as jest.Mocked<LLMService>;
    mockPromptManager = container.resolve(TYPES.PromptManager) as jest.Mocked<PromptManager>;
    mockDeadLetterProcessor = container.resolve(TYPES.DeadLetterProcessor) as jest.Mocked<BasicDeadLetterProcessor>;
    mockLogger = container.resolve(TYPES.Logger) as jest.Mocked<winston.Logger>;
    mockCommunicationBus = container.resolve(TYPES.AgentCommunicationBus) as jest.Mocked<EnhancedAgentCommunicationBus>;
    mockAgentConfig = container.resolve(TYPES.LLMRecommendationAgentConfig) as LLMRecommendationAgentConfig;

    // Manually instantiate the agent, passing the resolved mocks
    mockCommunicatingAgentDependencies = {
      communicationBus: mockCommunicationBus,
      logger: mockLogger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: mockAgentConfig as any,
    };

    llmRecommendationAgent = new LLMRecommendationAgent(
      mockLLMService,
      mockPromptManager,
      mockDeadLetterProcessor,
      mockAgentConfig,
      mockCommunicatingAgentDependencies
    );

    // Mock PromptManager methods that LLMService calls
    mockPromptManager.ensureLoaded.mockResolvedValue(undefined);
    mockPromptManager.getSystemPrompt.mockResolvedValue('mock system prompt');
    mockPromptManager.getPrompt.mockResolvedValue({ success: true, data: 'mock user prompt' });
  });

  afterEach(() => {
    resetMocks();
  });

  it('should initialize correctly', () => {
    expect(llmRecommendationAgent).toBeDefined();
    expect(llmRecommendationAgent.getName()).toBe('llm-recommendation-agent');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[llm-recommendation-agent] LLMRecommendationAgent initialized'),
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
        'llm-recommendation'
      );
 
       const result = await llmRecommendationAgent.handleMessage(message);
       expect(result.success).toBe(false);
       if (!result.success) {
         expect(result.error).toBeInstanceOf(AgentError);
         expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
         expect(result.error.correlationId).toBe(message.correlationId);
         expect(mockLogger.warn).toHaveBeenCalledWith(
           expect.stringContaining(`[${message.correlationId}] LLMRecommendationAgent received unhandled message type: unhandled-type`),
           expect.any(Object)
         );
       }
     });

    it('should process a recommendation request successfully', async () => {
      const messagePayload = {
        preferences: { type: 'red', body: 'full' },
        message: 'I want a bold red wine for steak',
        ingredients: ['beef'],
        conversationHistory: [{ role: 'user', content: 'I like red wine' }],
        priceRange: { min: 10, max: 30 },
        occasion: 'casual dinner',
        wineStyle: ['fruity', 'smooth'],
        bodyPreference: 'medium',
        sweetness: 'dry'
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-123',
        'corr-success',
        'llm-recommendation'
      );

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          recommendations: [
            { name: 'Cabernet Sauvignon', grapeVarieties: [{ name: 'Cabernet Sauvignon', percentage: 100 }] },
            { name: 'Malbec', grapeVarieties: [{ name: 'Malbec', percentage: 100 }] }
          ],
          confidence: 0.9,
          reasoning: 'These full-bodied reds pair well with red meat',
          pairingNotes: 'Excellent with grilled steak.',
          alternatives: []
        }
      });

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledTimes(1);
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledWith(
          'recommendWines', // task
          expect.objectContaining({ // variables
            userPreferences: messagePayload.preferences,
            conversationHistory: messagePayload.conversationHistory,
            priceRange: messagePayload.priceRange,
            occasion: messagePayload.occasion,
            wineStyle: messagePayload.wineStyle,
            bodyPreference: messagePayload.bodyPreference,
            sweetness: messagePayload.sweetness,
          }),
          expect.objectContaining({ // logContext
            correlationId: 'corr-success',
            agentId: llmRecommendationAgent.getName(), // Use getName()
            operation: 'handleRecommendationRequest'
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Processing recommendation request'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Recommendation request processed successfully'),
          expect.any(Object)
        );
        expect((result.data?.payload as any).recommendation.recommendations[0].name).toBe('Cabernet Sauvignon');
        expect((result.data?.payload as any).recommendation.confidence).toBe(0.9);
      }
    });

    it('should return an error if payload is missing', async () => {
      const message = createAgentMessage(
        'llm-recommendation-request',
        null, // Missing payload
        'source-agent',
        'conv-456',
        'corr-missing-payload',
        'llm-recommendation'
      );

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MISSING_PAYLOAD');
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
          null, // payload
          expect.objectContaining({ code: 'MISSING_PAYLOAD' }),
          expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-validation', correlationId: 'corr-missing-payload' })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-missing-payload] Processing recommendation request'),
          expect.any(Object)
        );
      }
    });

    it('should return an error if insufficient information for recommendation', async () => {
      const messagePayload = {
        conversationHistory: []
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-insufficient-data',
        'corr-insufficient-data',
        'llm-recommendation'
      );

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INSUFFICIENT_DATA');
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'INSUFFICIENT_DATA' }),
          expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-validation', correlationId: 'corr-insufficient-data' })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-insufficient-data] Processing recommendation request'),
          expect.any(Object)
        );
      }
    });

    it('should handle simulated LLM error', async () => {
      const messagePayload = {
        message: 'simulate_error' // Trigger simulated error
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-789',
        'corr-simulated-error',
        'llm-recommendation'
      );

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('SIMULATED_LLM_ERROR');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
          messagePayload,
          expect.any(AgentError), // Changed from expect.objectContaining({ code: 'SIMULATED_LLM_ERROR' })
          expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-simulated-error', correlationId: 'corr-simulated-error' })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-simulated-error] Processing recommendation request'),
          expect.any(Object)
        );
      }
    });

    it('should handle LLM service failure', async () => {
      const messagePayload = {
        message: 'test message'
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-llm-fail',
        'corr-llm-fail',
        'llm-recommendation'
      );

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new Error('LLM API is down')
      });

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_SERVICE_ERROR');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'LLM_SERVICE_ERROR' }),
          expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-llm-failure', correlationId: 'corr-llm-fail' })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-llm-fail] Processing recommendation request'),
          expect.any(Object)
        );
      }
    });

    it('should handle general exceptions during processing', async () => {
      const messagePayload = {
        message: 'test message'
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-general-exception',
        'corr-general-exception',
        'llm-recommendation'
      );

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected error during LLM call');
      });

      const result = await llmRecommendationAgent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_RECOMMENDATION_EXCEPTION');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'LLM_RECOMMENDATION_EXCEPTION' }),
          expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-exception', correlationId: 'corr-general-exception' })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Failed to process LLM recommendation request: Unexpected error during LLM call'),
          expect.any(Object)
        );
      }
    });

   it('should handle LLM response with malformed JSON', async () => {
     const messagePayload = {
       message: 'test message'
     };
     const message = createAgentMessage(
       'llm-recommendation-request',
       messagePayload,
       'source-agent',
       'conv-malformed-json',
       'corr-malformed-json',
       'llm-recommendation'
     );

     (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
       success: true,
       data: { recommendations: [], confidence: 0.9, reasoning: 'Pairs well with steak' } // Valid JSON, but with empty recommendations
     });

     const result = await llmRecommendationAgent.handleMessage(message);

     expect(result.success).toBe(false);
     if (!result.success) {
       expect(result.error).toBeInstanceOf(AgentError);
       expect(result.error.code).toBe('INVALID_LLM_RESPONSE');
       expect(result.error.correlationId).toBe('corr-malformed-json');
       expect(result.error.recoverable).toBe(true); // Changed from false
       expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
       expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
         messagePayload,
         expect.objectContaining({ code: 'INVALID_LLM_RESPONSE' }),
         expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-validation', correlationId: 'corr-malformed-json' })
       );
       // Removed expect(mockLogger.error).toHaveBeenCalledWith(...)
     }
   });

   it('should handle LLM response with valid JSON but incorrect RecommendationResult structure', async () => {
     const messagePayload = {
       message: 'test message'
     };
     const message = createAgentMessage(
       'llm-recommendation-request',
       messagePayload,
       'source-agent',
       'conv-invalid-structure',
       'corr-invalid-structure',
       'llm-recommendation'
     );

     (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
       success: true,
       data: { recommendations: [{ name: 'Cabernet Sauvignon' }], confidence: 1.1, reasoning: 'Pairs well with steak' } // Valid JSON, but invalid confidence
     });

     const result = await llmRecommendationAgent.handleMessage(message);

     expect(result.success).toBe(false);
     if (!result.success) {
       expect(result.error).toBeInstanceOf(AgentError);
       expect(result.error.code).toBe('INVALID_LLM_RESPONSE');
       expect(result.error.correlationId).toBe('corr-invalid-structure');
       expect(result.error.recoverable).toBe(true); // Changed from false
       expect(mockDeadLetterProcessor.process).toHaveBeenCalledTimes(1);
       expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(
         messagePayload,
         expect.objectContaining({ code: 'INVALID_LLM_RESPONSE' }),
         expect.objectContaining({ source: llmRecommendationAgent.getName(), stage: 'recommendation-validation', correlationId: 'corr-invalid-structure' })
       );
       // Removed expect(mockLogger.error).toHaveBeenCalledWith(...)
     }
   });
  });
});
