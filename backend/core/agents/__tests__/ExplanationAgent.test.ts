import { mockDeep } from 'jest-mock-extended';
import { createAgentMessage } from '../communication/AgentMessage';
import { AgentError } from '../AgentError';
import { ExplanationAgent, ExplanationAgentConfig } from '../ExplanationAgent';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { LLMService } from '../../../services/LLMService';
import winston from 'winston';
import { PromptManager } from '../../../services/PromptManager'; // Import PromptManager

// Test wrapper to access protected properties for testing
class TestExplanationAgent extends ExplanationAgent {
  public getAgentId(): string {
    return this.id;
  }
}

describe('ExplanationAgent', () => {
  let mockBus: any;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockLLMService: LLMService;
  let mockPromptManager: PromptManager; // Added mockPromptManager
  let agent: TestExplanationAgent;
  let mockAgentConfig: ExplanationAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<any>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockLLMService = mockDeep<LLMService>();
    mockPromptManager = mockDeep<PromptManager>(); // Initialized mockPromptManager
    mockAgentConfig = {
      defaultExplanation: 'This is a default explanation.'
    };
    agent = new TestExplanationAgent(mockLLMService, mockDeadLetter, mockLogger, mockBus, mockAgentConfig, mockPromptManager); // Added mockPromptManager

    jest.clearAllMocks();
  });

  describe('handleExplanationRequestInternal', () => {
    it('should generate and send an explanation for valid request', async () => {
      const messagePayload = {
        wineName: 'Wine A',
        ingredients: ['beef'],
        preferences: {},
        recommendationContext: {},
        userId: 'user123'
      };
      const message = createAgentMessage(
        'explanation-request',
        messagePayload,
        'source-agent',
        'test-conversation-id-123', // Placeholder for conversationId
        'corr-123',
        'ExplanationAgent'
      );

      (mockPromptManager.getPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'This is a generated explanation prompt.'
      });

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { explanation: 'This is a generated explanation.' }
      });

      const result = await agent.handleExplanationRequestInternal(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockPromptManager.getPrompt).toHaveBeenCalledTimes(1);
        expect(mockPromptManager.getPrompt).toHaveBeenCalledWith(
          'explanation',
          expect.objectContaining({
            wineName: messagePayload.wineName,
            ingredients: messagePayload.ingredients,
            preferences: messagePayload.preferences,
            recommendationContext: messagePayload.recommendationContext,
          })
        );
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledTimes(1);
        expect(mockLLMService.sendStructuredPrompt).toHaveBeenCalledWith(
          'explanation',
          expect.objectContaining({
            wineName: messagePayload.wineName,
            ingredients: messagePayload.ingredients,
            preferences: messagePayload.preferences,
            recommendationContext: messagePayload.recommendationContext,
          }),
          expect.any(Object) // LogContext
        );
     
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[ExplanationAgent] Handling explanation request'),
          expect.objectContaining({ correlationId: 'corr-123' })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[ExplanationAgent] Explanation request processed successfully'),
          expect.objectContaining({ correlationId: 'corr-123' })
        );
      }
    });

    it('should return an error if payload is missing or invalid', async () => {
      const message = createAgentMessage(
        'explanation-request',
        null, // Invalid payload
        'source-agent',
        'test-conversation-id-456', // Placeholder for conversationId
        'corr-456',
        'ExplanationAgent'
      );

      const result = await agent.handleExplanationRequestInternal(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MISSING_OR_INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[ExplanationAgent] Error handling explanation request: Invalid or missing payload in explanation request'),
          expect.objectContaining({ correlationId: 'corr-456' })
        );
      }
    });

    it('should handle LLM service failure gracefully', async () => {
      const messagePayload = {
        wineName: 'Wine A',
        ingredients: ['beef'],
        preferences: {},
        recommendationContext: {},
        userId: 'user123'
      };
      const message = createAgentMessage(
        'explanation-request',
        messagePayload,
        'source-agent',
        'test-conversation-id-789', // Placeholder for conversationId
        'corr-789',
        'ExplanationAgent'
      );

      (mockPromptManager.getPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'This is a generated explanation prompt.'
      });

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new AgentError('LLM is down', 'LLM_DOWN', 'LLMService', 'corr-789')
      });

      const result = await agent.handleExplanationRequestInternal(message);

      expect(result.success).toBe(false); // Agent should return error when LLM fails
      if (!result.success) {
        expect(result.error.code).toBe('LLM_SERVICE_ERROR');
        expect(result.error.recoverable).toBe(true);
      }
    });
  });

  describe('handleMessage (fallback)', () => {
    it('should return an error for unhandled message types', async () => {
      const message = createAgentMessage(
        'unhandled-type',
        { some: 'payload' },
        'test-agent',
        'test-conversation-id', // This is already correct for conversationId
        'corr-unhandled',
        'ExplanationAgent',
        'NORMAL',
        undefined, // userId (optional, not used here)
        { sender: 'test-agent', traceId: 'test-trace-unhandled' } // metadata
      );

      const response = await agent.handleMessage(message);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeInstanceOf(AgentError);
        expect(response.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(response.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] ExplanationAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('error handling', () => {
    it('should process errors and send error response', async () => {
      const messagePayload = {
        wineName: null,
        ingredients: [],
        preferences: {},
        recommendationContext: {},
        userId: 'user123'
      };
      const message = createAgentMessage(
        'explanation-request',
        messagePayload,
        'source-agent',
        'test-conversation-id-error', // Placeholder for conversationId
        'corr-error',
        'ExplanationAgent'
      );
      // Enable console logging for this test
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      // Simulate an error during LLM processing that propagates to the top-level catch
      (mockPromptManager.getPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'This is a generated explanation prompt.'
      });

      (mockLLMService.sendStructuredPrompt as jest.Mock).mockRejectedValue(new Error('Test error'));
      const result = await agent.handleExplanationRequestInternal(message);

expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error).toBeInstanceOf(AgentError);
  expect(result.error.code).toBe('EXPLANATION_GENERATION_ERROR'); // Updated to match new error code
  expect(result.error.correlationId).toBe('corr-error');
}

      // Verify debug logs were called with expected messages
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEBUG: Raw error caught:'), expect.any(Error)); // Changed to expect.any(Error)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEBUG: Processed error:'));

      // Restore console.log
      console.log = originalConsoleLog;
      
      // Verify dead letter processing was called
      expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
      expect(mockDeadLetter.process).toHaveBeenCalledWith(
        messagePayload,
        expect.any(AgentError), // Expect an AgentError instance
        expect.objectContaining({
          source: agent.getAgentId(),
          stage: 'explanation-exception', // This is the stage from handleExplanationRequestInternal's catch block
          correlationId: 'corr-error' // This is the correlationId from the AgentError
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[ExplanationAgent] Error handling explanation request: Error generating explanation: Test error'),
        expect.objectContaining({ correlationId: 'corr-error' })
      );
    });
  });
});
