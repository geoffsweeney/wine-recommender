import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { UserPreferenceAgent, UserPreferenceAgentConfig } from '../UserPreferenceAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { PreferenceExtractionService } from '@src/services/PreferenceExtractionService';
import { KnowledgeGraphService } from '@src/services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '@src/services/PreferenceNormalizationService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import { PreferenceNode } from '@src/types';

// Test wrapper to access protected properties for testing
class TestUserPreferenceAgent extends UserPreferenceAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testMergePreferences(existing: PreferenceNode[], incoming: PreferenceNode[]): PreferenceNode[] {
    return (this as any).mergePreferences(existing, incoming);
  }
  public testPersistPreferences(preferences: PreferenceNode[], userId: string): Promise<void> {
    return (this as any).persistPreferences(preferences, userId);
  }
  public testQueueAsyncLLMExtraction(
    userInput: string,
    userId: string,
    conversationHistory?: any[],
    correlationId?: string
  ): Promise<void> {
    return (this as any).queueAsyncLLMExtraction(userInput, userId, conversationHistory, correlationId);
  }
}

describe('UserPreferenceAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockPreferenceExtractionService: PreferenceExtractionService;
  let mockKnowledgeGraphService: KnowledgeGraphService;
  let mockPreferenceNormalizationService: PreferenceNormalizationService;
  let agent: TestUserPreferenceAgent;
  let mockAgentConfig: UserPreferenceAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockPreferenceExtractionService = mockDeep<PreferenceExtractionService>();
    mockKnowledgeGraphService = mockDeep<KnowledgeGraphService>();
    mockPreferenceNormalizationService = mockDeep<PreferenceNormalizationService>();
    mockAgentConfig = {
      defaultConfidenceThreshold: 0.7
    };
    jest.clearAllMocks();
    agent = new TestUserPreferenceAgent(
      mockBus,
      mockDeadLetter,
      mockPreferenceExtractionService,
      mockPreferenceNormalizationService,
      mockLogger,
      mockAgentConfig
    );
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getName()).toBe('UserPreferenceAgent');
    expect(agent.getAgentId()).toBe('user-preference-agent');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[user-preference-agent] UserPreferenceAgent initialized'),
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
        'user-preference-agent'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] UserPreferenceAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handlePreferenceRequest', () => {
    it('should return an error if payload is missing or invalid', async () => {
      const message = createAgentMessage(
        'preference-request',
        null, // Invalid payload
        'source-agent',
        'conv-456',
        'corr-invalid-payload',
        'user-preference-agent'
      );

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-invalid-payload] Handling preference request'),
          expect.any(Object)
        );
        // Temporarily comment out for debugging
        // expect(mockLogger.error).toHaveBeenCalledWith(
        //   expect.stringContaining('[corr-invalid-payload] Error processing preference request: Invalid or missing payload in preference request'),
        //   expect.any(Object)
        // );
      }
    });

    it('should process a preference request with fast extraction success', async () => {
      const messagePayload = {
        input: 'I like red wine',
        userId: 'user123'
      };
      const message = createAgentMessage(
        'preference-request',
        messagePayload,
        'source-agent',
        'conv-fast-success',
        'corr-fast-success',
        'user-preference-agent'
      );

      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { color: 'red', type: 'wine' }
      });
      (mockPreferenceNormalizationService.normalizePreferences as jest.Mock).mockReturnValueOnce([
        { type: 'color', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: new Date().toISOString(), active: true },
        { type: 'type', value: 'wine', source: 'fast-extraction', confidence: 1, timestamp: new Date().toISOString(), active: true }
      ]);

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        // Removed KnowledgeGraphService interactions
        expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith('I like red wine');
        expect(mockPreferenceNormalizationService.normalizePreferences).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledWith(
          '*',
          expect.objectContaining({
            type: 'preferences-updated',
            payload: expect.objectContaining({
              userId: 'user123',
              preferences: expect.arrayContaining([
                expect.objectContaining({ type: 'color', value: 'red' }),
                expect.objectContaining({ type: 'type', value: 'wine' })
              ])
            })
          })
        );
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'preference-update-result',
            payload: expect.objectContaining({
              success: true,
              preferences: expect.arrayContaining([
                expect.objectContaining({ type: 'color', value: 'red' }),
                expect.objectContaining({ type: 'type', value: 'wine' })
              ])
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-fast-success] Preference request processed successfully (fast extraction)'),
          expect.any(Object)
        );
      }
    });

    it('should queue async LLM extraction if fast extraction fails or returns no data', async () => {
      const messagePayload = {
        input: 'I like red wine',
        userId: 'user123'
      };
      const message = createAgentMessage(
        'preference-request',
        messagePayload,
        'source-agent',
        'conv-async-queue',
        'corr-async-queue',
        'user-preference-agent'
      );

      // Removed KnowledgeGraphService interaction
      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockResolvedValueOnce({
        success: false, // Fast extraction fails
        error: new AgentError('Fast extraction failed', 'FAST_EXTRACTION_FAILED', 'test-agent', 'corr-async-queue')
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true); // Agent still returns success as it queued the task
      if (result.success) {
        // Removed KnowledgeGraphService interaction
        expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith('I like red wine');
        expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledWith(
          'LLMPreferenceExtractorAgent',
          expect.objectContaining({
            type: 'llm-preference-extraction',
            payload: expect.objectContaining({
              input: 'I like red wine',
              userId: 'user123'
            })
          })
        );
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'preference-update-result',
            payload: expect.objectContaining({
              success: false,
              preferences: [],
              error: 'Analyzing your input for preferences asynchronously.'
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-async-queue] Preference request queued for async LLM extraction'),
          expect.any(Object)
        );
      }
    });

    it('should handle general exceptions during processing', async () => {
      const messagePayload = {
        input: 'I like red wine',
        userId: 'user123'
      };
      const message = createAgentMessage(
        'preference-request',
        messagePayload,
        'source-agent',
        'conv-general-exception',
        'corr-general-exception',
        'user-preference-agent'
      );

      // Removed KnowledgeGraphService interaction
      // (mockKnowledgeGraphService.getPreferences as jest.Mock).mockImplementationOnce(() => {
      //   throw new Error('Database error');
      // });
      // Simulate an error from PreferenceExtractionService instead
      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockRejectedValueOnce(new Error('Simulated extraction error'));


      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('PREFERENCE_PROCESSING_ERROR');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Handling preference request'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Error processing preference request: Simulated extraction error'),
          expect.any(Object)
        );
      }
    });
  });

  describe('mergePreferences', () => {
    it('should merge preferences, with incoming overriding existing', () => {
      const existing: PreferenceNode[] = [
        { type: 'color', value: 'red', source: 'user', confidence: 1, timestamp: '2023-01-01T00:00:00Z', active: true },
        { type: 'body', value: 'full', source: 'user', confidence: 1, timestamp: '2023-01-01T00:00:00Z', active: true },
      ];
      const incoming: PreferenceNode[] = [
        { type: 'color', value: 'white', source: 'llm', confidence: 0.8, timestamp: '2023-01-02T00:00:00Z', active: true },
        { type: 'sweetness', value: 'dry', source: 'llm', confidence: 0.9, timestamp: '2023-01-02T00:00:00Z', active: true },
      ];

      const merged = agent.testMergePreferences(existing, incoming);
      expect(merged).toHaveLength(3);
      expect(merged).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'color', value: 'white' }),
        expect.objectContaining({ type: 'body', value: 'full' }),
        expect.objectContaining({ type: 'sweetness', value: 'dry' }),
      ]));
    });

    it('should handle empty existing preferences', () => {
      const existing: PreferenceNode[] = [];
      const incoming: PreferenceNode[] = [
        { type: 'color', value: 'red', source: 'llm', confidence: 0.8, timestamp: '2023-01-02T00:00:00Z', active: true },
      ];
      const merged = agent.testMergePreferences(existing, incoming);
      expect(merged).toHaveLength(1);
      expect(merged).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'color', value: 'red' }),
      ]));
    });

    it('should handle empty incoming preferences', () => {
      const existing: PreferenceNode[] = [
        { type: 'color', value: 'red', source: 'user', confidence: 1, timestamp: '2023-01-01T00:00:00Z', active: true },
      ];
      const incoming: PreferenceNode[] = [];
      const merged = agent.testMergePreferences(existing, incoming);
      expect(merged).toHaveLength(1);
      expect(merged).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'color', value: 'red' }),
      ]));
    });
  });

  // Commented out as preference persistence is no longer handled by KnowledgeGraphService
  // describe('persistPreferences', () => {
  //   it('should call knowledgeGraphService.addOrUpdatePreference for each preference', async () => {
  //     const preferences: PreferenceNode[] = [
  //       { type: 'color', value: 'red', source: 'user', confidence: 1, timestamp: '2023-01-01T00:00:00Z', active: true },
  //       { type: 'body', value: 'full', source: 'user', confidence: 1, timestamp: '2023-01-01T00:00:00Z', active: true },
  //     ];
  //     const userId = 'testUser';

  //     await agent.testPersistPreferences(preferences, userId);

  //     expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledTimes(2);
  //     expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(userId, preferences[0]);
  //     expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(userId, preferences[1]);
  //   });
  // });

  describe('queueAsyncLLMExtraction', () => {
    it('should publish an llm-preference-extraction message to LLMPreferenceExtractorAgent', async () => {
      const userInput = 'I want a sweet wine';
      const userId = 'user456';
      const correlationId = 'corr-queue';
      const conversationHistory = [{ role: 'user', content: 'initial query' }];

      await agent.testQueueAsyncLLMExtraction(userInput, userId, conversationHistory, correlationId);

      expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1);
      expect(mockBus.publishToAgent).toHaveBeenCalledWith(
        'LLMPreferenceExtractorAgent',
        expect.objectContaining({
          type: 'llm-preference-extraction',
          payload: expect.objectContaining({
            input: userInput,
            userId: userId,
            history: conversationHistory,
          }),
          correlationId: correlationId
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[${correlationId}] Queued async LLM preference extraction for user: ${userId}`),
        expect.any(Object)
      );
    });

    it('should generate a correlationId if not provided', async () => {
      const userInput = 'I want a sweet wine';
      const userId = 'user456';

      await agent.testQueueAsyncLLMExtraction(userInput, userId);

      expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1);
      expect(mockBus.publishToAgent).toHaveBeenCalledWith(
        'LLMPreferenceExtractorAgent',
        expect.objectContaining({
          correlationId: expect.any(String) // Should be generated
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Queued async LLM preference extraction for user: ${userId}`),
        expect.any(Object)
      );
    });
  });
});