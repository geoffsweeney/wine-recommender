import { injectable, inject } from 'tsyringe';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './AgentMessage'; // Import MessageTypes
import { LLMService } from '../../../services/LLMService';
import { TYPES } from '../../../di/Types';
import { Result } from '../../types/Result';
import { AgentError } from '../AgentError';

@injectable()
export class EnhancedAgentCommunicationBus extends AgentCommunicationBus {
  private messageHandlers: Map<string, Map<string, (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>>> = new Map();
  private responseCallbacks: Map<string, (response: AgentMessage) => void> = new Map();

  constructor(@inject(TYPES.LLMService) llmService: LLMService) {
    super(llmService);
  }

  registerMessageHandler(
    agentId: string,
    messageType: string,
    handler: (message: AgentMessage) => Promise<Result<AgentMessage | null, AgentError>>
  ): void {
    console.log(`EnhancedAgentCommunicationBus: Registering handler for agent ${agentId}, message type ${messageType}`);
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, new Map());
    }
    this.messageHandlers.get(agentId)!.set(messageType, handler);
  }

  async sendMessageAndWaitForResponse<T>(
    targetAgentId: string,
    message: AgentMessage,
    timeoutMs: number = 10000
  ): Promise<Result<AgentMessage<T> | null, AgentError>> { // Allow null data on success
    const responseId = message.correlationId; // Use correlationId as responseId
    
    return new Promise((resolve) => { // Removed reject from Promise constructor
      const timeout = setTimeout(() => {
        this.responseCallbacks.delete(responseId);
        resolve({ success: false, error: new AgentError(`Timeout waiting for response from ${targetAgentId} for correlationId: ${responseId}`, 'TIMEOUT_ERROR', message.sourceAgent, message.correlationId) });
      }, timeoutMs);

      this.responseCallbacks.set(responseId, (response: AgentMessage) => {
        clearTimeout(timeout);
        this.responseCallbacks.delete(responseId);
        if (response.type === MessageTypes.ERROR) { // Check for ERROR message type
          const errorPayload = response.payload as AgentError; // Cast to AgentError
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
      console.warn(`No handlers registered for agent: ${targetAgentId}`);
      // Send an error response if no handlers are found for the target agent
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR, // Changed to MessageTypes.ERROR
        new AgentError(`No handlers registered for agent: ${targetAgentId}`, 'NO_HANDLER_REGISTERED', 'EnhancedAgentCommunicationBus', message.correlationId), // Created AgentError
        'EnhancedAgentCommunicationBus',
        message.conversationId, // Added conversationId
        message.correlationId,
        message.sourceAgent
      ));
      return;
    }

    const handler = agentHandlers.get(message.type);
    if (!handler) {
      console.warn(`No handler for message type ${message.type} in agent ${targetAgentId}`);
      // Send an error response if no handler is found for the message type
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR, // Changed to MessageTypes.ERROR
        new AgentError(`No handler for message type ${message.type} in agent ${targetAgentId}`, 'NO_MESSAGE_TYPE_HANDLER', 'EnhancedAgentCommunicationBus', message.correlationId), // Created AgentError
        'EnhancedAgentCommunicationBus',
        message.conversationId, // Added conversationId
        message.correlationId,
        message.sourceAgent
      ));
      return;
    }

    try {
      const result: Result<AgentMessage | null, AgentError> = await handler(message);
      
      if (result.success) {
        if (result.data) {
          // If the message was a request expecting a response, send it back
          if (message.correlationId) { // Use correlationId for response tracking
            this.sendResponse(message.sourceAgent, result.data);
          }
        } else {
          // Handler processed message but returned null (e.g., for broadcast acks)
          console.log(`Handler for ${message.type} in ${targetAgentId} returned null data.`);
        }
      } else {
        // Handler returned an error result
        console.error(`Handler for ${message.type} in ${targetAgentId} returned an error: ${result.error.message}`);
        this.sendResponse(message.sourceAgent, createAgentMessage(
          MessageTypes.ERROR, // Changed to MessageTypes.ERROR
          result.error, // Pass the AgentError directly
          'EnhancedAgentCommunicationBus',
          message.conversationId, // Added conversationId
          message.correlationId,
          message.sourceAgent
        ));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error handling message in agent ${targetAgentId}:`, errorMessage);
      this.sendResponse(message.sourceAgent, createAgentMessage(
        MessageTypes.ERROR, // Changed to MessageTypes.ERROR
        new AgentError(errorMessage, 'HANDLER_EXECUTION_ERROR', 'EnhancedAgentCommunicationBus', message.correlationId), // Created AgentError
        'EnhancedAgentCommunicationBus',
        message.conversationId, // Added conversationId
        message.correlationId,
        message.sourceAgent
      ));
    }
  }

  sendResponse(targetAgentId: string, response: AgentMessage): void {
    console.log('EnhancedAgentCommunicationBus: sendResponse called with correlationId:', response.correlationId);
    const callback = this.responseCallbacks.get(response.correlationId);
    if (callback) {
      console.log('EnhancedAgentCommunicationBus: Callback found for correlationId:', response.correlationId);
      callback(response);
    } else {
      console.log('EnhancedAgentCommunicationBus: No callback found for correlationId:', response.correlationId, 'Routing message instead.');
      // If no callback, it means the original sender is not waiting for a direct response
      // In this case, we might route it as a new message or log it.
      // For now, we'll route it as a new message to the targetAgentId (which is the original sender)
      this.routeMessage(targetAgentId, response);
    }
  }

  publishToAgent<T>(targetAgentId: string, message: AgentMessage<T>): void {
    this.routeMessage(targetAgentId, message);
  }
}