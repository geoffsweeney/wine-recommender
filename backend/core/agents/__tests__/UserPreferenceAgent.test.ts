import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { UserPreferenceAgent, UserPreferenceAgentConfig } from '../UserPreferenceAgent';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { PreferenceExtractionService } from '../../../services/PreferenceExtractionService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../../services/PreferenceNormalizationService';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import { PreferenceNode } from '../../../types';

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

  public testHandlePreferenceRequest(message: any): Promise<any> {
    return (this as any).handlePreferenceRequest(message);
  }
} // Corrected closing brace
// Removed testQueueAsyncLLMExtraction as it's not a method in the agent

describe('UserPreferenceAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockPreferenceExtractionService: PreferenceExtractionService;
  let mockKnowledgeGraphService: KnowledgeGraphService; // Keep this for now, even if not used in agent
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
        { }, // Empty payload to trigger validation
        'source-agent',
        'conv-456',
        'corr-invalid-payload',
        'user-preference-agent'
      );

      const result = await agent.testHandlePreferenceRequest(message as any); // Directly call handlePreferenceRequest

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-invalid-payload] Handling preference request'),
          expect.any(Object)
        );
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
        'user-preference-agent', // targetAgent (6th argument)
        'user123', // userId (7th argument)
        'NORMAL' // priority (8th argument)
      );

      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { color: 'red', type: 'wine' }
      });
      (mockPreferenceNormalizationService.normalizePreferences as jest.Mock).mockReturnValueOnce([
        { type: 'color', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: new Date().toISOString(), active: true },
        { type: 'type', value: 'wine', source: 'fast-extraction', confidence: 1, timestamp: new Date().toISOString(), active: true }
      ]);

      const result = await agent.testHandlePreferenceRequest(message as any); // Directly call handlePreferenceRequest

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith('I like red wine');
        expect(mockPreferenceNormalizationService.normalizePreferences).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledWith(
          '*',
          expect.objectContaining({
            type: 'preference-update', // Changed from 'preferences-updated'
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
        'conv-fast-success',
        'corr-fast-success',
        'user-preference-agent', // targetAgent (6th argument)
        'user123', // userId (7th argument)
        'NORMAL' // priority (8th argument)
      );

      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockResolvedValueOnce({
        success: false, // Fast extraction fails
        error: new AgentError('Fast extraction failed', 'FAST_EXTRACTION_FAILED', 'test-agent', 'corr-async-queue')
      });
      // Mock LLM extraction service call
      (mockPreferenceExtractionService.extractPreferencesWithLLM as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          preferences: { color: 'red' },
          ingredients: [],
          isValid: true,
          errors: []
        }
      });
      // Mock normalization service call
      (mockPreferenceNormalizationService.normalizePreferences as jest.Mock).mockResolvedValueOnce([
        { type: 'color', value: 'red', source: 'llm-extraction', confidence: 0.8, timestamp: new Date().toISOString(), active: true }
      ]);

      const result = await agent.testHandlePreferenceRequest(message as any); // Directly call handlePreferenceRequest

      expect(result.success).toBe(true); // Agent still returns success as it processed the request
      if (result.success) {
        expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith('I like red wine');
        expect(mockPreferenceExtractionService.extractPreferencesWithLLM).toHaveBeenCalledTimes(1);
        expect(mockBus.publishToAgent).toHaveBeenCalledTimes(1); // For preferences-updated
        expect(mockBus.publishToAgent).toHaveBeenCalledWith(
          '*',
          expect.objectContaining({
            type: 'preference-update', // Changed from 'preferences-updated'
            payload: expect.objectContaining({
              userId: 'user123',
              preferences: expect.arrayContaining([
                expect.objectContaining({ type: 'color', value: 'red' })
              ])
            })
          })
        );
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1); // For preference-update-result
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-fast-success] Preference request processed successfully (LLM extraction)'), // Corrected correlation ID
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

      (mockPreferenceExtractionService.attemptFastExtraction as jest.Mock).mockRejectedValueOnce(new Error('Simulated extraction error'));

      const result = await agent.testHandlePreferenceRequest(message as any); // Directly call handlePreferenceRequest

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
});
