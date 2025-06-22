import { mockDeep } from 'jest-mock-extended';
import { AgentError } from '../AgentError';
import { MCPAdapterAgent, MCPAdapterAgentConfig } from '../MCPAdapterAgent';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus';
import { MCPClient } from '@src/mcp/mcpClient';
import winston from 'winston';
import { createAgentMessage } from '../communication/AgentMessage';

// Test wrapper to access protected properties for testing
class TestMCPAdapterAgent extends MCPAdapterAgent {
  public getAgentId(): string {
    return this.id;
  }
}

describe('MCPAdapterAgent', () => {
  let mockBus: EnhancedAgentCommunicationBus;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let mockMCPClient: MCPClient;
  let agent: TestMCPAdapterAgent;
  let mockAgentConfig: MCPAdapterAgentConfig;

  beforeEach(() => {
    mockBus = mockDeep<EnhancedAgentCommunicationBus>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as winston.Logger; // Manual mock for winston.Logger
    mockMCPClient = mockDeep<MCPClient>();
    mockAgentConfig = {
      defaultToolTimeoutMs: 5000
    };
    jest.clearAllMocks();
    agent = new TestMCPAdapterAgent(
      mockMCPClient,
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
    expect(agent.getName()).toBe('MCPAdapterAgent');
    expect(agent.getAgentId()).toBe('mcp-adapter');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[mcp-adapter] MCPAdapterAgent initialized'),
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
        'mcp-adapter'
      );

      const result = await agent.handleMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(result.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[corr-unhandled] MCPAdapterAgent received unhandled message type: unhandled-type'),
          expect.any(Object)
        );
      }
    });
  });

  describe('handleToolRequest', () => {
    it('should return an error if payload is missing or invalid', async () => {
      const message = createAgentMessage(
        'mcp-tool-request',
        null, // Invalid payload
        'source-agent',
        'conv-invalid',
        'corr-invalid-payload',
        'mcp-adapter'
      );

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('INVALID_PAYLOAD');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-invalid-payload] Handling MCP tool request'),
          expect.any(Object)
        );
      }
    });

    it('should process a successful MCP tool request', async () => {
      const messagePayload = {
        toolName: 'get_weather',
        arguments: { city: 'London' }
      };
      const message = createAgentMessage(
        'mcp-tool-request',
        messagePayload,
        'source-agent',
        'conv-success',
        'corr-success',
        'mcp-adapter'
      );

      (mockMCPClient.useTool as jest.Mock).mockResolvedValueOnce({
        status: 'success',
        result: { temperature: 15, conditions: 'Cloudy' }
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(mockMCPClient.useTool).toHaveBeenCalledTimes(1);
        expect(mockMCPClient.useTool).toHaveBeenCalledWith('get_weather', { city: 'London' });
        expect(mockBus.sendResponse).toHaveBeenCalledTimes(1);
        expect(mockBus.sendResponse).toHaveBeenCalledWith(
          'source-agent',
          expect.objectContaining({
            type: 'mcp-tool-response',
            payload: expect.objectContaining({
              status: 'success',
              result: { temperature: 15, conditions: 'Cloudy' }
            })
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Handling MCP tool request'),
          expect.any(Object)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] Calling MCP tool: get_weather'),
          expect.any(Object)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-success] MCP tool request processed successfully'),
          expect.any(Object)
        );
      }
    });

    it('should handle MCP tool call failure', async () => {
      const messagePayload = {
        toolName: 'get_weather',
        arguments: { city: 'London' }
      };
      const message = createAgentMessage(
        'mcp-tool-request',
        messagePayload,
        'source-agent',
        'conv-fail',
        'corr-fail',
        'mcp-adapter'
      );

      (mockMCPClient.useTool as jest.Mock).mockResolvedValueOnce({
        status: 'error',
        error: 'Tool not found'
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MCP_TOOL_CALL_FAILED');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-fail] Handling MCP tool request'),
          expect.any(Object)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('[corr-fail] Calling MCP tool: get_weather'),
          expect.any(Object)
        );
      }
    });

    it('should handle general exceptions during processing', async () => {
      const messagePayload = {
        toolName: 'get_weather',
        arguments: { city: 'London' }
      };
      const message = createAgentMessage(
        'mcp-tool-request',
        messagePayload,
        'source-agent',
        'conv-general-exception',
        'corr-general-exception',
        'mcp-adapter'
      );

      (mockMCPClient.useTool as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected client error');
      });

      const result = await agent.handleMessage(message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('MCP_ADAPTER_ERROR');
        expect(mockDeadLetter.process).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Handling MCP tool request'),
          expect.any(Object)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Calling MCP tool: get_weather'),
          expect.any(Object)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('[corr-general-exception] Error handling MCP tool request: Unexpected client error'),
          expect.any(Object)
        );
      }
    });
  });
});