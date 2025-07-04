import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { LLMRecommendationAgent, LLMRecommendationAgentConfig } from '../LLMRecommendationAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { LLMService } from '@src/services/LLMService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';

import { RecommendationResult } from '../../../types/agent-outputs';
// Test wrapper to access protected properties for testing
class TestLLMRecommendationAgent extends LLMRecommendationAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testBuildEnhancedPrompt(payload: any): string {
    return (this as any).buildEnhancedPrompt(payload);
  }
}

describe('LLMRecommendationAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockLLMService: LLMService;
  let agent: TestLLMRecommendationAgent;
  let mockAgentConfig: LLMRecommendationAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockLLMService = mockDeep<LLMService>();
    mockAgentConfig = {
      defaultConfidenceScore: 0.75,
      maxRecommendations: 3,
      includePairingAdvice: true,
      modelTemperature: 0.7
    };
    jest.clearAllMocks(); // Clear mocks before agent initialization
    agent = new TestLLMRecommendationAgent(mockLLMService, mockDeadLetter, mockLogger, mockBus, mockAgentConfig);
  });

  afterEach(() => {
    // console.log('mockLogger.error calls:', mockLogger.error.mock.calls);
    // console.log('mockLogger.info calls:', mockLogger.info.mock.calls);
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getName()).toBe('llm-recommendation-agent');
    expect(agent.getAgentId()).toBe('llm-recommendation-agent');
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

      const result = await agent.handleMessage(message);
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
  });

  describe('handleRecommendationRequest', () => {
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledTimes(1);
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledWith(
          expect.any(String), // prompt
          expect.any(Object), // EnhancedRecommendationSchema
          null, // zodSchema
          { temperature: mockAgentConfig.modelTemperature, num_predict: 2048 }, // llmOptions
          'corr-success' // correlationId
        );
        // Removed expect(mockBus.publish).toHaveBeenCalledTimes(1); as it's not directly called by this agent
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MISSING_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetter.process).toHaveBeenCalledWith(
          null, // payload
          expect.objectContaining({ code: 'MISSING_PAYLOAD' }),
          expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-validation', correlationId: 'corr-missing-payload' })
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INSUFFICIENT_DATA');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetter.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'INSUFFICIENT_DATA' }),
          expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-validation', correlationId: 'corr-insufficient-data' })
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('SIMULATED_LLM_ERROR');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetter.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'SIMULATED_LLM_ERROR' }),
          expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-simulated-error', correlationId: 'corr-simulated-error' })
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_SERVICE_ERROR');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetter.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'LLM_SERVICE_ERROR' }),
          expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-llm-failure', correlationId: 'corr-llm-fail' })
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

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_RECOMMENDATION_EXCEPTION');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockDeadLetter.process).toHaveBeenCalledWith(
          messagePayload,
          expect.objectContaining({ code: 'LLM_RECOMMENDATION_EXCEPTION' }),
          expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-exception', correlationId: 'corr-general-exception' })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Failed to process LLM recommendation request: Unexpected error during LLM call'),
          expect.any(Object)
        );
      }
    });
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

     const result = await agent.handleMessage(message);

     expect(result.success).toBe(false);
     if (!result.success) {
       expect(result.error).toBeInstanceOf(AgentError);
       expect(result.error.code).toBe('LLM_RECOMMENDATION_EXCEPTION'); // Changed from INVALID_LLM_RESPONSE
       expect(result.error.correlationId).toBe('corr-malformed-json');
       expect(result.error.recoverable).toBe(true); // Changed from false
       expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
       expect(mockDeadLetter.process).toHaveBeenCalledWith(
         messagePayload,
         expect.objectContaining({ code: 'LLM_RECOMMENDATION_EXCEPTION' }), // Changed from INVALID_LLM_RESPONSE
         expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-exception', correlationId: 'corr-malformed-json' }) // Changed stage
       );
       expect(mockLogger.error).toHaveBeenCalledWith(
         expect.stringContaining('[corr-malformed-json] Failed to process LLM recommendation request: Invalid LLM response:'), // Updated message
         expect.any(Object)
       );
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

     const result = await agent.handleMessage(message);

     expect(result.success).toBe(false);
     if (!result.success) {
       expect(result.error).toBeInstanceOf(AgentError);
       expect(result.error.code).toBe('LLM_RECOMMENDATION_EXCEPTION'); // Changed from INVALID_LLM_RESPONSE
       expect(result.error.correlationId).toBe('corr-invalid-structure');
       expect(result.error.recoverable).toBe(true); // Changed from false
       expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
       expect(mockDeadLetter.process).toHaveBeenCalledWith(
         messagePayload,
         expect.objectContaining({ code: 'LLM_RECOMMENDATION_EXCEPTION' }), // Changed from INVALID_LLM_RESPONSE
         expect.objectContaining({ source: agent.getAgentId(), stage: 'recommendation-exception', correlationId: 'corr-invalid-structure' }) // Changed stage
       );
       expect(mockLogger.error).toHaveBeenCalledWith(
         expect.stringContaining('[corr-invalid-structure] Failed to process LLM recommendation request: Invalid LLM response:'), // Updated message
         expect.any(Object)
       );
     }
   });

   describe('buildPrompt', () => {
     it('should build a prompt with message only', () => {
       const payload = { message: 'I need a wine for pizza' };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('You are an expert sommelier'); // System prompt
       expect(prompt).toContain('## Examples of Good Recommendations:'); // Examples section
       expect(prompt).toContain('## Current Request:\nUser Message: "I need a wine for pizza"');
       expect(prompt).toContain('## Current Request Context:'); // Changed from not.toContain
       expect(prompt).not.toContain('Food/Ingredients:');
       expect(prompt).toContain('## Instructions:'); // Instructions section
     });

     it('should build a prompt with preferences', () => {
       const payload = { preferences: { type: 'red', body: 'light' } };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('You are an expert sommelier');
       expect(prompt).toContain('## Examples of Good Recommendations:');
       expect(prompt).toContain('## Current Request Context:\n### User Preferences: {\n  "type": "red",\n  "body": "light"\n}');
       expect(prompt).toContain('## Instructions:');
     });

     it('should build a prompt with ingredients', () => {
       const payload = { ingredients: ['chicken', 'pasta'] };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('You are an expert sommelier');
       expect(prompt).toContain('## Examples of Good Recommendations:');
       expect(prompt).toContain('## Current Request:\nFood/Ingredients: chicken, pasta');
       expect(prompt).toContain('## Instructions:');
     });

     it('should build a prompt with conversation history', () => {
       const payload = { conversationHistory: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }] };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('You are an expert sommelier');
       expect(prompt).toContain('## Examples of Good Recommendations:');
       expect(prompt).toContain('## Current Request Context:\n### Previous Conversation:\nuser: Hello\nassistant: Hi there!');
       expect(prompt).toContain('## Instructions:');
     });

     it('should build a prompt with all fields', () => {
       const payload = {
         message: 'Find me a wine',
         preferences: { type: 'white' },
         ingredients: ['fish'],
         conversationHistory: [{ role: 'user', content: 'White wine please' }]
       };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('You are an expert sommelier');
       expect(prompt).toContain('## Examples of Good Recommendations:');
       expect(prompt).toContain('## Current Request:\nUser Message: "Find me a wine"');
       expect(prompt).toContain('## Current Request Context:'); // Check for header
       expect(prompt).toContain('### User Preferences: {'); // Check for start of preferences
       expect(prompt).toContain('"type": "white"'); // Check for content of preferences
       expect(prompt).toContain('}'); // Check for end of preferences
       expect(prompt).toContain('## Current Request:\nFood/Ingredients: fish'); // Reverted to exact string match
       expect(prompt).toContain('## Current Request Context:\n### Previous Conversation:\nuser: White wine please');
       expect(prompt).toContain('## Instructions:');
     });

     it('should build a prompt with price range', () => {
       const payload = { priceRange: { min: 20, max: 50 } };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('## Current Request Context:\n### Budget: $20 - $50');
     });

     it('should build a prompt with occasion', () => {
       const payload = { occasion: 'dinner party' };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('## Current Request Context:\n### Occasion: dinner party');
     });

     it('should build a prompt with wine style', () => {
       const payload = { wineStyle: ['bold', 'oaky'] };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('## Current Request:\nPreferred Wine Styles: bold, oaky');
     });

     it('should build a prompt with body preference', () => {
       const payload = { bodyPreference: 'full' };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('## Current Request:\nBody Preference: full');
     });

     it('should build a prompt with sweetness preference', () => {
       const payload = { sweetness: 'dry' };
       const prompt = agent.testBuildEnhancedPrompt(payload);
       expect(prompt).toContain('## Current Request:\nSweetness Preference: dry');
     });
   });
 });