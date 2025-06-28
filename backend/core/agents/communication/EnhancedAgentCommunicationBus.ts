import { injectable, inject } from 'tsyringe';
import { Agent } from '../Agent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './AgentMessage';
import { LLMService } from '../../../services/LLMService';
import { TYPES, ILogger } from '../../../di/Types'; // Import ILogger
import { Result } from '../../types/Result';
import { AgentError } from '../AgentError';

@injectable()
export class EnhancedAgentCommunicationBus extends AgentCommunicationBus implements Agent {
  private messageHandlers: Map<string, Map<string, (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>>> = new Map();
  private responseCallbacks: Map<string, (response: AgentMessage) => void> = new Map();
  private logger: ILogger; // Add logger property

  constructor(
    @inject(TYPES.LLMService) llmService: LLMService,
    @inject(TYPES.Logger) logger: ILogger // Inject logger
  ) {
    super(llmService);
    this.logger = logger; // Assign logger
  }

  registerMessageHandler(
    agentId: string,
    messageType: string,
    handler: (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>
  ): void {
    this.logger.debug(`EnhancedAgentCommunicationBus: Registering handler for agent ${agentId}, message type ${messageType}`);
    
    // Ensure the agent's handler map exists
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, new Map());
    }

    const agentHandlers = this.messageHandlers.get(agentId)!;
    
    // Only register if not already present or if different handler
    if (!agentHandlers.has(messageType) || agentHandlers.get(messageType) !== handler) {
      agentHandlers.set(messageType, handler);
    }
  }

  async sendMessageAndWaitForResponse<T>(
    targetAgentId: string,
    message: AgentMessage,
    timeoutMs: number = 30000 // Increased timeout to 30 seconds
  ): Promise<Result<AgentMessage<T> | null, AgentError>> { // Allow null data on success
    const responseId = message.correlationId; // Use correlationId as responseId
    
    return new Promise((resolve) => {
      this.logger.debug(`[${message.correlationId}] Setting up response callback for ${targetAgentId}. Timeout: ${timeoutMs}ms`);
      const timeout = setTimeout(() => {
        this.responseCallbacks.delete(responseId);
        this.logger.warn(`[${message.correlationId}] Timeout triggered for ${targetAgentId}. Callback deleted.`);
        resolve({ success: false, error: new AgentError(`Timeout waiting for response from ${targetAgentId} for correlationId: ${responseId}`, 'TIMEOUT_ERROR', message.sourceAgent, message.correlationId) });
      }, timeoutMs);

      this.responseCallbacks.set(responseId, (response: AgentMessage) => {
        this.logger.debug(`[${message.correlationId}] Callback triggered for ${targetAgentId}. Clearing timeout and deleting callback.`);
        clearTimeout(timeout);
        this.responseCallbacks.delete(responseId);
        if (response.type === MessageTypes.ERROR) {
          const errorPayload = response.payload as AgentError;
          resolve({ success: false, error: errorPayload });
        } else {
          resolve({ success: true, data: response as AgentMessage<T> });
        }
      });

      this.routeMessage(targetAgentId, message);
    });
  }

  private async routeMessage(targetAgentId: string, message: AgentMessage): Promise<void> {
    const agentHandlers = this.messageHandlers.get(targetAgentId);
    if (!agentHandlers) {
      this.logger.warn(`No handlers registered for agent: ${targetAgentId}. Current handlers:`, Array.from(this.messageHandlers.keys()));
      // Send an error response if no handlers are found for the target agent
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR,
        new AgentError(`No handlers registered for agent: ${targetAgentId}`, 'NO_HANDLER_REGISTERED', 'EnhancedAgentCommunicationBus', message.correlationId),
        'EnhancedAgentCommunicationBus',
        message.conversationId,
        message.correlationId,
        message.sourceAgent
      ));
      return;
    }

    const handler = agentHandlers.get(message.type);
    if (!handler) {
      this.logger.warn(`No handler for message type ${message.type} in agent ${targetAgentId}`);
      // Send an error response if no handler is found for the message type
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR,
        new AgentError(`No handler for message type ${message.type} in agent ${targetAgentId}`, 'NO_MESSAGE_TYPE_HANDLER', 'EnhancedAgentCommunicationBus', message.correlationId),
        'EnhancedAgentCommunicationBus',
        message.conversationId,
        message.correlationId,
        message.sourceAgent
      ));
      return;
    }

    try {
      const result: Result<AgentMessage | null, AgentError> = await handler(message);
      
      this.logger.debug(`[${message.correlationId}] Handler for ${targetAgentId} returned result: success=${result.success}, data=${result.success ? !!result.data : 'N/A'}, error=${!result.success ? !!result.error : 'N/A'}`);
      if (result.success) {
        if (result.data) {
          if (message.correlationId) {
            this.logger.debug(`[${message.correlationId}] Routing response from handler to sendResponse for ${message.sourceAgent}.`);
            this.sendResponse(message.sourceAgent, result.data);
          }
        } else {
          this.logger.debug(`[${message.correlationId}] Handler for ${message.type} in ${targetAgentId} returned null data.`);
        }
      } else {
        this.logger.error(`[${message.correlationId}] Handler for ${message.type} in ${targetAgentId} returned an error: ${result.error.message}`);
        this.sendResponse(message.sourceAgent, createAgentMessage(
          MessageTypes.ERROR,
          { message: result.error.message, code: result.error.code },
          'EnhancedAgentCommunicationBus',
          message.conversationId,
          message.correlationId,
          message.sourceAgent
        ));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${message.correlationId}] Error handling message in agent ${targetAgentId}: ${errorMessage}`);
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR,
        new AgentError(errorMessage, 'HANDLER_EXECUTION_ERROR', 'EnhancedAgentCommunicationBus', message.correlationId),
        'EnhancedAgentCommunicationBus',
        message.conversationId,
        message.correlationId,
        message.sourceAgent
      ));
    }
  }

  sendResponse(targetAgentId: string, response: AgentMessage): void {
    this.logger.debug(`EnhancedAgentCommunicationBus: sendResponse called for ${targetAgentId} with correlationId: ${response.correlationId}. Full response: ${JSON.stringify(response)}`);
    const callback = this.responseCallbacks.get(response.correlationId);
    if (callback) {
      this.logger.debug(`EnhancedAgentCommunicationBus: Callback found for correlationId: ${response.correlationId}. Executing callback.`);
      callback(response);
    } else {
      this.logger.warn(`EnhancedAgentCommunicationBus: No callback found for correlationId: ${response.correlationId}. Message will not be routed.`);
    }
  }

  getName(): string {
    return 'EnhancedAgentCommunicationBus';
  }

  getCapabilities(): string[] {
    return ['message-routing', 'response-handling', 'error-handling'];
  }

  async handleMessage(message: AgentMessage): Promise<Result<AgentMessage | null, AgentError>> {
    // The bus doesn't handle messages itself, it routes them to other agents
    return {
      success: false,
      error: new AgentError(
        'EnhancedAgentCommunicationBus does not handle messages directly',
        'INVALID_MESSAGE_HANDLER',
        this.getName(),
        message.correlationId
      )
    };
  }

  publishToAgent<T>(targetAgentId: string, message: AgentMessage<T>): void {
    if (targetAgentId === '*') {
      // Broadcast to all registered agents
      this.messageHandlers.forEach((handlers, agentId) => {
        if (handlers.has(message.type)) {
          // Only route if the agent has a handler for this message type
          this.logger.debug(`Broadcasting message type ${message.type} to agent ${agentId}`);
          this.routeMessage(agentId, message);
        }
      });
    } else {
      // Normal routing for a specific agent
      this.routeMessage(targetAgentId, message);
    }
  }
}
