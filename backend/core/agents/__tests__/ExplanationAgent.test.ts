import { mockDeep } from 'jest-mock-extended';
import { createAgentMessage } from '../communication/AgentMessage';
import { AgentError } from '../AgentError';
import { ExplanationAgent, ExplanationAgentConfig } from '../ExplanationAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { LLMService } from '@src/services/LLMService'; // Use alias
import winston from 'winston';
import { Result } from '@src/core/types/Result'; // Use alias

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
  let agent: TestExplanationAgent;
  let mockAgentConfig: ExplanationAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<any>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockLLMService = mockDeep<LLMService>();
    mockAgentConfig = {
      defaultExplanation: 'This is a default explanation.'
    };
    agent = new TestExplanationAgent(mockLLMService, mockDeadLetter, mockLogger, mockBus, mockAgentConfig);

    jest.clearAllMocks();
  });

  describe('handleExplanationRequestInternal', () => {
    it('should generate and send an explanation for valid request', async () => {
      const messagePayload = {
        recommendedWines: [{ id: '1', name: 'Wine A', region: 'Region A', type: 'Red' }],
        recommendationContext: { ingredients: ['beef'] },
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

      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'This is a generated explanation.'
      });

      const result = await agent.handleExplanationRequestInternal(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockLLMService.sendPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'explanation-response',
            payload: expect.objectContaining({
              explanation: 'This is a generated explanation.',
              recommendedWines: messagePayload.recommendedWines,
              userId: messagePayload.userId
            })
          })
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
        recommendedWines: [{ id: '1', name: 'Wine A', region: 'Region A', type: 'Red' }],
        recommendationContext: { ingredients: ['beef'] },
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

      (mockLLMService.sendPrompt as jest.Mock).mockResolvedValueOnce({
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
        { sender: 'test-agent', traceId: 'test-trace-unhandled' }
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
        recommendedWines: [],
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
      (mockLLMService.sendPrompt as jest.Mock).mockRejectedValue(new Error('Test error'));
const result = await agent.handleExplanationRequestInternal(message);

expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error).toBeInstanceOf(AgentError);
  expect(result.error.code).toBe('LLM_SERVICE_EXCEPTION'); // Updated to match new error code
  expect(result.error.correlationId).toBe('corr-error');
}

      // Verify debug logs were called with expected messages
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEBUG: Raw error caught:'), expect.any(AgentError));
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
        expect.stringContaining('[ExplanationAgent] Error handling explanation request: LLM service error: Test error'),
        expect.objectContaining({ correlationId: 'corr-error' })
      );
    });
  });
});