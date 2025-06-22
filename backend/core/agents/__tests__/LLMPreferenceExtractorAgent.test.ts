import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { LLMPreferenceExtractorAgent, LLMPreferenceExtractorAgentConfig } from '../LLMPreferenceExtractorAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { LLMService } from '@src/services/LLMService';
import { KnowledgeGraphService } from '@src/services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '@src/services/PreferenceNormalizationService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';

// Test wrapper to access protected properties for testing
class TestLLMPreferenceExtractorAgent extends LLMPreferenceExtractorAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testParseLLMResponse(response: string, input: string): Promise<any> {
    return (this as any).parseLLMResponse(response, input);
  }
  public testCalculateConfidenceScore(result: any, input: string): number {
    return (this as any).calculateConfidenceScore(result, input);
  }
}

describe('LLMPreferenceExtractorAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockLLMService: LLMService;
  let mockKnowledgeGraphService: KnowledgeGraphService;
  let mockPreferenceNormalizationService: PreferenceNormalizationService;
  let agent: TestLLMPreferenceExtractorAgent;
  let mockAgentConfig: LLMPreferenceExtractorAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockLLMService = mockDeep<LLMService>();
    mockKnowledgeGraphService = mockDeep<KnowledgeGraphService>();
    mockPreferenceNormalizationService = mockDeep<PreferenceNormalizationService>();
    mockAgentConfig = {
      maxRetries: 3
    };
    jest.clearAllMocks();
    agent = new TestLLMPreferenceExtractorAgent(
      mockLLMService,
      mockKnowledgeGraphService,
      mockPreferenceNormalizationService,
      mockDeadLetter,
      mockLogger,
      mockBus,
      mockAgentConfig
    );
  });

  afterEach(() => {
    // Clean up any console.logs used for debugging
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getName()).toBe('LLMPreferenceExtractorAgent');
    expect(agent.getAgentId()).toBe('llm-preference-extractor');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[llm-preference-extractor] LLMPreferenceExtractorAgent initialized'),
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
        'llm-preference-extractor'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] LLMPreferenceExtractorAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handleExtractionRequest', () => {
    it('should return an error if payload is missing', async () => {
      const message = createAgentMessage(
        'preference-extraction-request',
        null, // Missing payload
        'source-agent',
        'conv-456',
        'corr-missing-payload',
        'llm-preference-extractor'
      );

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-missing-payload] Handling preference extraction request'),
          expect.any(Object)
        );
      }
    });

    it('should process a preference extraction request successfully', async () => {
      const messagePayload = {
        input: 'I like dry white wines',
        userId: 'user123'
      };
      const message = createAgentMessage(
        'preference-extraction-request',
        messagePayload,
        'source-agent',
        'conv-123',
        'corr-success',
        'llm-preference-extractor'
      );

      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: '```json\n{"isValid": true, "preferences": {"style": "dry", "color": "white"}, "ingredients": []}\n```'
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'preference-extraction-response',
            payload: expect.objectContaining({
              isValid: true,
              preferences: { style: 'dry', color: 'white' },
              ingredients: [],
              confidence: expect.any(Number)
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Handling preference extraction request'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Preference extraction successful on attempt 1'),
          expect.any(Object)
        );
      }
    });

    it('should handle LLM service failure', async () => {
      const messagePayload = {
        input: 'I like red wine',
        userId: 'user123'
      };
      const message = createAgentMessage(
        'preference-extraction-request',
        messagePayload,
        'source-agent',
        'conv-llm-fail',
        'corr-llm-fail',
        'llm-preference-extractor'
      );

      (mockLLMService.sendPrompt as jest.Mock)
        .mockResolvedValueOnce({ success: false, error: new Error('LLM API is down') }) // First attempt
        .mockResolvedValueOnce({ success: false, error: new Error('LLM API is down') }) // Second attempt
        .mockResolvedValueOnce({ success: false, error: new Error('LLM API is down') }); // Third attempt

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_RESPONSE_PARSE_ERROR'); // LLM service error is wrapped
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-llm-fail] Handling preference extraction request'),
          expect.any(Object)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-llm-fail] Preference extraction attempt 1 failed: Error: LLM API is down'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-llm-fail] Error in LLMPreferenceExtractorAgent: Error: LLM API is down'),
          expect.any(Object)
        );
      }
    });
  });

  describe('parseLLMResponse', () => {
    it('should return an error if LLM response is empty', async () => {
      const result = await agent.testParseLLMResponse(undefined as any, 'test input');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_NO_RESPONSE');
      }
    });

    it('should parse a valid JSON response from LLM', async () => {
      const llmResponse = '```json\n{"isValid": true, "preferences": {"color": "red"}}\n```';
      const result = await agent.testParseLLMResponse(llmResponse, 'red wine');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(expect.objectContaining({
          isValid: true,
          preferences: { color: 'red' },
          confidence: expect.any(Number)
        }));
      }
    });

    it('should return an error for invalid JSON response', async () => {
      const llmResponse = 'invalid json';
      const result = await agent.testParseLLMResponse(llmResponse, 'test input');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_PARSE_ERROR');
      }
    });
  });

  describe('calculateConfidenceScore', () => {
    it('should return a base score for empty result', () => {
      const score = agent.testCalculateConfidenceScore({}, 'test');
      expect(score).toBeCloseTo(0.5);
    });

    it('should increase score for isValid true', () => {
      const score = agent.testCalculateConfidenceScore({ isValid: true }, 'test');
      expect(score).toBeCloseTo(0.7); // 0.5 + 0.2
    });

    it('should increase score for preferences', () => {
      const score = agent.testCalculateConfidenceScore({ preferences: { color: 'red' } }, 'test');
      expect(score).toBeCloseTo(0.65); // 0.5 + 0.15
    });

    it('should increase score for ingredients', () => {
      const score = agent.testCalculateConfidenceScore({ ingredients: ['beef'] }, 'test');
      expect(score).toBeCloseTo(0.65); // 0.5 + 0.15
    });

    it('should return max score for all valid fields', () => {
      const score = agent.testCalculateConfidenceScore({ isValid: true, preferences: { color: 'red' }, ingredients: ['beef'] }, 'test');
      expect(score).toBeCloseTo(1.0); // 0.5 + 0.2 + 0.15 + 0.15
    });
  });
});