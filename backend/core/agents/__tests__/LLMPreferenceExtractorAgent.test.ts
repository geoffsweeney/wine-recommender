import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { LLMPreferenceExtractorAgent, LLMPreferenceExtractorAgentConfig } from '../LLMPreferenceExtractorAgent';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { LLMService } from '../../../services/LLMService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../../services/PreferenceNormalizationService';
import { UserProfileService } from '../../../services/UserProfileService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import { container } from 'tsyringe'; // Added import
import { TYPES } from '../../../di/Types'; // Added import

// Test wrapper to access protected properties for testing
class TestLLMPreferenceExtractorAgent extends LLMPreferenceExtractorAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testCalculateConfidenceScore(result: any, input: string): number {
    return (this as any).calculateConfidenceScore(result, input);
  }
}

describe('LLMPreferenceExtractorAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>;
  let mockPreferenceNormalizationService: jest.Mocked<PreferenceNormalizationService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let agent: TestLLMPreferenceExtractorAgent;
  let mockAgentConfig: LLMPreferenceExtractorAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockLLMService = mockDeep<LLMService>();
    mockKnowledgeGraphService = mockDeep<KnowledgeGraphService>();
    mockPreferenceNormalizationService = mockDeep<PreferenceNormalizationService>();
    mockUserProfileService = mockDeep<UserProfileService>();
    mockAgentConfig = {
      maxRetries: 3
    };
    
    // Register mocks with the container
    container.clearInstances();
    container.reset();
    container.registerInstance(TYPES.AgentCommunicationBus, mockBus);
    container.registerInstance(TYPES.DeadLetterProcessor, mockDeadLetter);
    container.registerInstance(TYPES.Logger, mockLogger);
    container.registerInstance(TYPES.LLMService, mockLLMService);
    container.registerInstance(TYPES.KnowledgeGraphService, mockKnowledgeGraphService);
    container.registerInstance(TYPES.PreferenceNormalizationService, mockPreferenceNormalizationService);
    container.registerInstance(TYPES.UserProfileService, mockUserProfileService);
    container.registerInstance(TYPES.LLMPreferenceExtractorAgentConfig, mockAgentConfig);

    jest.clearAllMocks();
    agent = new TestLLMPreferenceExtractorAgent(
      mockLLMService,
      mockKnowledgeGraphService,
      mockPreferenceNormalizationService,
      mockUserProfileService,
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
        userId: 'user123',
        conversationHistory: [], // Add conversationHistory
      };
      const message = createAgentMessage(
        'preference-extraction-request',
        messagePayload,
        'source-agent',
        'conv-123',
        'corr-success',
        'llm-preference-extractor'
      );

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockImplementation(
        async (task, variables, logContext) => {
          expect(task).toBe('extractPreferences');
          expect(variables).toEqual({
            userInput: messagePayload.input,
            conversationContext: messagePayload.conversationHistory || [],
          });
          expect(logContext).toBeDefined();
          return {
            success: true,
            data: { isValid: true, preferences: { style: 'dry', color: 'white' }, ingredients: [] }
          };
        }
      );

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledTimes(1);
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
        userId: 'user123',
        conversationHistory: [], // Add conversationHistory
      };
      const message = createAgentMessage(
        'preference-extraction-request',
        messagePayload,
        'source-agent',
        'conv-llm-fail',
        'corr-llm-fail',
        'llm-preference-extractor'
      );

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockImplementation(
        async (task, variables, logContext) => {
          expect(task).toBe('extractPreferences');
          expect(variables).toBeDefined();
          expect(logContext).toBeDefined();
          return { success: false, error: new Error('LLM API is down') };
        }
      );

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
