import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent } from './CommunicatingAgent';
import { ICommunicatingAgentDependencies } from '../../di/Types';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { MCPClient } from '../../mcp/mcpClient';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';

interface MCPAdapterRequestPayload {
  toolName: string;
  arguments: Record<string, any>;
  context?: Record<string, any>;
}

interface MCPAdapterResponsePayload {
  status: 'success' | 'partial' | 'error';
  result?: any;
  error?: string;
}

// Define the configuration interface for MCPAdapterAgent
export interface MCPAdapterAgentConfig {
  defaultToolTimeoutMs: number;
}

@injectable()
export class MCPAdapterAgent extends CommunicatingAgent {
  constructor(
  @inject(MCPClient) private readonly mcpClient: MCPClient,
  @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
  @inject(TYPES.MCPAdapterAgentConfig) private readonly agentConfig: MCPAdapterAgentConfig, // Inject agent config
  @inject(TYPES.CommunicatingAgentDependencies) dependencies: ICommunicatingAgentDependencies // Inject dependencies for base class
  ) {
    const id = 'mcp-adapter';
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] MCPAdapterAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'MCPAdapterAgent';
  }

  public getCapabilities(): string[] {
    return [
      'mcp-tool-integration',
      'external-service-adapter',
      'protocol-translation',
      'error-handling',
      'dead-letter-processing'
    ];
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    if (message.type === 'mcp-tool-request') {
      return this.handleToolRequest(message as AgentMessage<MCPAdapterRequestPayload>);
    }
    this.logger.warn(`[${correlationId}] MCPAdapterAgent received unhandled message type: ${message.type}`, {
      agentId: this.id,
      operation: 'handleMessage',
      correlationId: correlationId,
      messageType: message.type
    });
    return {
      success: false,
      error: new AgentError(
        `Unhandled message type: ${message.type}`,
        'UNHANDLED_MESSAGE_TYPE',
        this.id,
        correlationId,
        false, // Not recoverable, as it's an unhandled type
        { messageType: message.type }
      )
    };
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      'mcp-tool-request',
      this.handleToolRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handleToolRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling MCP tool request`, { agentId: this.id, operation: 'handleToolRequest' });

    try {
      const payload = message.payload as MCPAdapterRequestPayload;
      if (!payload || typeof payload.toolName !== 'string' || typeof payload.arguments !== 'object' || payload.arguments === null) {
        const error = new AgentError('Invalid or missing payload in MCP tool request: toolName or arguments missing/malformed', 'INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'mcp-validation', correlationId });
        return { success: false, error };
      }
      const { toolName, arguments: args } = payload;
      this.logger.debug(`[${correlationId}] Calling MCP tool: ${toolName}`, {
        toolName,
        correlationId: correlationId,
        agentId: this.id,
        operation: 'handleToolRequest'
      });

      // Call MCP tool through client
      const response = await this.mcpClient.useTool(toolName, args);
      if (response.status === 'error') {
        const error = new AgentError(response.error ?? 'MCP tool call failed', 'MCP_TOOL_CALL_FAILED', this.id, correlationId, true, { mcpError: response.error });
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'mcp-tool-failure', correlationId });
        return { success: false, error };
      }
      const result = response.result;

      const responseMessage = createAgentMessage(
        'mcp-tool-response',
        {
          status: 'success',
          result
        },
        this.id,
        correlationId,
        message.sourceAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
      this.logger.info(`[${correlationId}] MCP tool request processed successfully`, { agentId: this.id, operation: 'handleToolRequest' });
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'MCP_ADAPTER_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'mcp-exception', correlationId });
      this.logger.error(`[${correlationId}] Error handling MCP tool request: ${errorMessage}`, { agentId: this.id, operation: 'handleToolRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private async handleError(message: AgentMessage<unknown>, error: AgentError, correlationId: string): Promise<void> {
    await this.deadLetterProcessor.process(
      message.payload,
      error,
      { source: this.id, stage: 'MCPToolCall', correlationId }
    );

    const errorMessage = createAgentMessage(
      'error-response',
      {
        status: 'error',
        error: error.message,
        code: error.code,
        details: error.message, // Use error.message as details
        userId: (message.payload as MCPAdapterRequestPayload)?.context?.userId // Use userId from message context
      },
      this.id,
      correlationId,
      message.sourceAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
    this.logger.error(`[${correlationId}] Error in MCPAdapterAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
  }
}