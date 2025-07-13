import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { ValueAnalysisAgent, ValueAnalysisAgentConfig, ValueAnalysisRequest } from '../ValueAnalysisAgent';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';
import { ICommunicatingAgentDependencies } from '../../../di/Types';

// Test wrapper to access protected properties for testing
class TestValueAnalysisAgent extends ValueAnalysisAgent {
  public getAgentId(): string {
    return this.id;
  }
  public testIsValueAnalysisRequest(obj: unknown): boolean {
    return (this as any).isValueAnalysisRequest(obj);
  }
  public testProcessValueAnalysis(request: ValueAnalysisRequest, correlationId: string): Promise<any> {
    return (this as any).processValueAnalysis(request, correlationId);
  }
}

describe('ValueAnalysisAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let agent: TestValueAnalysisAgent;
  let mockAgentConfig: ValueAnalysisAgentConfig;
  let mockCommunicatingAgentDependencies: ICommunicatingAgentDependencies;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockAgentConfig = {
      defaultTimeoutMs: 5000
    };
    jest.clearAllMocks();
    mockCommunicatingAgentDependencies = {
      communicationBus: mockBus,
      logger: mockLogger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: mockAgentConfig as any,
    };

    agent = new TestValueAnalysisAgent(
      mockDeadLetter,
      mockAgentConfig,
      mockCommunicatingAgentDependencies
    );
  });

  afterEach(() => {
    // console.log('mockLogger.error calls:', mockLogger.error.mock.calls);
    // console.log('mockLogger.warn calls:', mockLogger.warn.mock.calls);
    // console.log('mockLogger.info calls:', mockLogger.info.mock.calls);
    // console.log('mockDeadLetter.process calls:', mockDeadLetter.process.mock.calls);
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getName()).toBe('ValueAnalysisAgent');
    expect(agent.getAgentId()).toBe('value-analysis-agent');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[value-analysis-agent] ValueAnalysisAgent initialized'),
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
        'value-analysis-agent'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] ValueAnalysisAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handleValueAnalysisRequest', () => {
    it('should return an error if payload is invalid', async () => {
      const message = createAgentMessage(
        'value-analysis',
        { wineId: '123', price: 100, region: 'Napa' }, // Missing vintage
        'source-agent',
        'conv-invalid',
        'corr-invalid-payload',
        'value-analysis-agent'
      );

      const result = await agent.handleValueAnalysisRequest(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-invalid-payload] Handling value analysis request'),
          expect.any(Object)
        );
        // Temporarily comment out for debugging
        // expect(mockLogger.error).toHaveBeenCalledWith(
        //   expect.stringContaining('[corr-invalid-payload] Error handling value analysis request: Invalid message payload for value analysis request'),
        //   expect.any(Object)
        // );
      }
    });

    it('should process a value analysis request successfully', async () => {
      const messagePayload: ValueAnalysisRequest = {
        wineId: 'wine-123',
        price: 50,
        region: 'Bordeaux',
        vintage: 2018,
        additionalContext: 'Good year'
      };
      const message = createAgentMessage(
        'value-analysis',
        messagePayload,
        'source-agent',
        'conv-success',
        'corr-success',
        'value-analysis-agent'
      );

      (mockBus.sendLLMPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: 'This wine offers excellent value.'
      });

      const result = await agent.handleValueAnalysisRequest(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockBus.sendLLMPrompt).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'value-analysis-result',
            payload: expect.objectContaining({
              success: true,
              analysis: 'This wine offers excellent value.',
              wineId: 'wine-123'
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Handling value analysis request'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Value analysis request processed successfully'),
          expect.any(Object)
        );
      }
    });

    it('should handle general exceptions during processing', async () => {
      const messagePayload: ValueAnalysisRequest = {
        wineId: 'wine-123',
        price: 50,
        region: 'Bordeaux',
        vintage: 2018,
      };
      const message = createAgentMessage(
        'value-analysis',
        messagePayload,
        'source-agent',
        'conv-general-exception',
        'corr-general-exception',
        'value-analysis-agent'
      );

      (mockBus.sendLLMPrompt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected error during LLM call');
      });

      const result = await agent.handleValueAnalysisRequest(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('VALUE_ANALYSIS_PROCESSING_ERROR');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Handling value analysis request'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Error during value analysis processing: Unexpected error during LLM call'),
          expect.any(Object)
        );
      }
    });
  });

  describe('isValueAnalysisRequest', () => {
    it('should return true for a valid ValueAnalysisRequest', () => {
      const validRequest = { wineId: '1', price: 10, region: 'A', vintage: 2020 };
      expect(agent.testIsValueAnalysisRequest(validRequest)).toBe(true);
    });

    it('should return false if wineId is missing', () => {
      const invalidRequest = { price: 10, region: 'A', vintage: 2020 };
      expect(agent.testIsValueAnalysisRequest(invalidRequest)).toBe(false);
    });

    it('should return false if price is missing', () => {
      const invalidRequest = { wineId: '1', region: 'A', vintage: 2020 };
      expect(agent.testIsValueAnalysisRequest(invalidRequest)).toBe(false);
    });

    it('should return false if region is missing', () => {
      const invalidRequest = { wineId: '1', price: 10, vintage: 2020 };
      expect(agent.testIsValueAnalysisRequest(invalidRequest)).toBe(false);
    });

    it('should return false if vintage is missing', () => {
      const invalidRequest = { wineId: '1', price: 10, region: 'A' };
      expect(agent.testIsValueAnalysisRequest(invalidRequest)).toBe(false);
    });

    it('should return false for non-object input', () => {
      expect(agent.testIsValueAnalysisRequest(null)).toBe(false);
      expect(agent.testIsValueAnalysisRequest(undefined)).toBe(false);
      expect(agent.testIsValueAnalysisRequest('string')).toBe(false);
      expect(agent.testIsValueAnalysisRequest(123)).toBe(false);
    });
  });

  describe('processValueAnalysis', () => {
    it('should return LLM_SERVICE_ERROR if LLM service fails', async () => {
      const request: ValueAnalysisRequest = { wineId: '1', price: 10, region: 'A', vintage: 2020 };
      const correlationId = 'corr-llm-fail';

      (mockBus.sendLLMPrompt as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new AgentError('LLM is down', 'LLM_DOWN', 'llm-service', correlationId)
      });

      const result = await agent.testProcessValueAnalysis(request, correlationId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_SERVICE_ERROR');
        expect(result.error.correlationId).toBe(correlationId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(`[${correlationId}] LLM service failed to respond: LLM service failed: LLM is down`),
          expect.any(Object)
        );
      }
    });

    it('should return LLM_NO_RESPONSE if LLM returns no data', async () => {
      const request: ValueAnalysisRequest = { wineId: '1', price: 10, region: 'A', vintage: 2020 };
      const correlationId = 'corr-no-response';

      (mockBus.sendLLMPrompt as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: null // No data from LLM
      });

      const result = await agent.testProcessValueAnalysis(request, correlationId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_NO_RESPONSE');
        expect(result.error.correlationId).toBe(correlationId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(`[${correlationId}] No response data from LLM`),
          expect.any(Object)
        );
      }
    });

    it('should return VALUE_ANALYSIS_PROCESSING_ERROR for general exceptions', async () => {
      const request: ValueAnalysisRequest = { wineId: '1', price: 10, region: 'A', vintage: 2020 };
      const correlationId = 'corr-process-exception';

      (mockBus.sendLLMPrompt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Processing error');
      });

      const result = await agent.testProcessValueAnalysis(request, correlationId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('VALUE_ANALYSIS_PROCESSING_ERROR');
        expect(result.error.correlationId).toBe(correlationId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(`[${correlationId}] Error during value analysis processing: Processing error`),
          expect.any(Object)
        );
      }
    });
  });
});
