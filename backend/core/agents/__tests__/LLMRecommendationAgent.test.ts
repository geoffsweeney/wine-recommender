import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { LLMRecommendationAgent, LLMRecommendationAgentConfig } from '../LLMRecommendationAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { LLMService } from '@src/services/LLMService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';

// Test wrapper to access protected properties for testing
class TestLLMRecommendationAgent extends LLMRecommendationAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testBuildPrompt(payload: any): string {
    return (this as any).buildPrompt(payload);
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
      defaultConfidenceScore: 0.75
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
    expect(agent.getName()).toBe('LLMRecommendationAgent');
    expect(agent.getAgentId()).toBe('llm-recommendation');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[llm-recommendation] LLMRecommendationAgent initialized'),
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
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] LLMRecommendationAgent received unhandled message type: unhandled-type'),
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
        conversationHistory: [{ role: 'user', content: 'I like red wine' }]
      };
      const message = createAgentMessage(
        'llm-recommendation-request',
        messagePayload,
        'source-agent',
        'conv-123',
        'corr-success',
        'llm-recommendation'
      );

      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: '{"wines": ["Cabernet Sauvignon"], "confidence": 0.9}'
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'llm-recommendation-response',
            payload: expect.objectContaining({
              recommendation: '{"wines": ["Cabernet Sauvignon"], "confidence": 0.9}',
              confidenceScore: mockAgentConfig.defaultConfidenceScore
            })
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
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-missing-payload] Processing recommendation request'),
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

      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
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

      (mockLLMService.sendPrompt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected error during LLM call');
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_RECOMMENDATION_EXCEPTION');
        expect(result.error.recoverable).toBe(true);
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Processing recommendation request'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Failed to process LLM recommendation request: Unexpected error during LLM call'),
          expect.any(Object)
        );
      }
    });
  });

  describe('buildPrompt', () => {
    it('should build a prompt with message only', () => {
      const payload = { message: 'I need a wine for pizza' };
      const prompt = agent.testBuildPrompt(payload);
      expect(prompt).toContain('Input: "I need a wine for pizza"');
      expect(prompt).not.toContain('Preferences:');
      expect(prompt).not.toContain('Ingredients:');
      expect(prompt).not.toContain('Conversation context:');
    });

    it('should build a prompt with preferences', () => {
      const payload = { preferences: { type: 'red', body: 'light' } };
      const prompt = agent.testBuildPrompt(payload);
      expect(prompt).toContain('Preferences: {"type":"red","body":"light"}');
    });

    it('should build a prompt with ingredients', () => {
      const payload = { ingredients: ['chicken', 'pasta'] };
      const prompt = agent.testBuildPrompt(payload);
      expect(prompt).toContain('Ingredients: chicken, pasta');
    });

    it('should build a prompt with conversation history', () => {
      const payload = { conversationHistory: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }] };
      const prompt = agent.testBuildPrompt(payload);
      expect(prompt).toContain('Conversation context:');
      expect(prompt).toContain('user: Hello');
      expect(prompt).toContain('assistant: Hi there!');
    });

    it('should build a prompt with all fields', () => {
      const payload = {
        message: 'Find me a wine',
        preferences: { type: 'white' },
        ingredients: ['fish'],
        conversationHistory: [{ role: 'user', content: 'White wine please' }]
      };
      const prompt = agent.testBuildPrompt(payload);
      expect(prompt).toContain('Input: "Find me a wine"');
      expect(prompt).toContain('Preferences: {"type":"white"}');
      expect(prompt).toContain('Ingredients: fish');
      expect(prompt).toContain('Conversation context:');
      expect(prompt).toContain('user: White wine please');
    });
  });
});