import { inject } from 'tsyringe'; // Import inject
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { BaseAgent } from './BaseAgent';
import { AgentError } from './AgentError';
import { Result } from '../types/Result';
import winston from 'winston'; // Assuming logger is winston for now

import { ICommunicatingAgentDependencies, TYPES } from '../../di/Types'; // Import ICommunicatingAgentDependencies and TYPES

export abstract class CommunicatingAgent extends BaseAgent<any, any> { // TConfig and TState will be defined by concrete agents
  protected communicationBus: EnhancedAgentCommunicationBus;
  protected logger: winston.Logger;

  constructor(
    id: string, // Removed @inject and type
    config: any, // Removed @inject and type
    @inject(TYPES.CommunicatingAgentDependencies) dependencies: ICommunicatingAgentDependencies // Inject dependencies
  ) {
    super(id, config, dependencies);
    this.communicationBus = dependencies.communicationBus;
    this.logger = dependencies.logger;
    this.registerHandlers();
  }

  abstract getName(): string;
  
  getCapabilities(): string[] {
    return ['communication'];
  }

  // handleMessage now returns Result as per coding standards
  protected abstract handleMessage<T>(
    message: AgentMessage<T>
  ): Promise<Result<AgentMessage | null, AgentError>>;

  // Implement abstract methods from BaseAgent
  protected validateConfig(config: any): void {
    // Basic validation, can be overridden by concrete agents
    if (!config) {
      this.logger.warn(`[${this.id}] Agent config is empty.`);
    }
  }

  protected getInitialState(): any {
    return {}; // Default empty state, can be overridden
  }

  protected registerHandlers(): void {
    // Concrete agents will register their specific handlers.
    // This base class does not register generic direct-message or broadcast handlers.
  }

  protected async handleDirectMessage(
    message: AgentMessage
  ): Promise<Result<AgentMessage | null, AgentError>> {
    const traceId = message.correlationId; // Use correlationId as traceId for consistency
    try {
      this.logger.info(`[${traceId}] Handling direct message for ${this.id}: ${message.type}`);
      const result = await this.handleMessage(message); // Pass the full message
      
      if (result.success) {
        return result; // Simply return the result from the concrete agent's handleMessage
      } else {
        const errorMessage = createAgentMessage(
          'error-response',
          { error: result.error.message, code: result.error.code },
          this.id,
          traceId,
          message.sourceAgent
        );
        return { success: false, error: result.error };
      }
    } catch (error: unknown) { // Explicitly type as unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${traceId}] Error handling direct message for ${this.id}: ${errorMessage}`, { error });
      const agentError = new AgentError(
        `Failed to handle direct message: ${errorMessage}`,
        'COMMUNICATION_ERROR',
        this.id,
        traceId,
        true, // Assuming recoverable for now
        { originalError: errorMessage }
      );
      return { success: false, error: agentError }; // Simply return the error
    }
  }
  
  protected async handleBroadcast(
    message: AgentMessage
  ): Promise<Result<AgentMessage, AgentError>> {
    const traceId = message.correlationId;
    try {
      this.logger.info(`[${traceId}] Handling broadcast message for ${this.id}: ${message.type}`);
      // Default broadcast handler - override in subclasses if needed
      const responseMessage = createAgentMessage(
        'broadcast-ack',
        { status: 'acknowledged' },
        this.id,
        traceId,
        message.sourceAgent // Acknowledge the sender
      );
      return { success: true, data: responseMessage };
    } catch (error: unknown) { // Explicitly type as unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${traceId}] Error handling broadcast message for ${this.id}: ${errorMessage}`, { error });
      const agentError = new AgentError(
        `Failed to handle broadcast message: ${errorMessage}`,
        'COMMUNICATION_ERROR',
        this.id,
        traceId,
        true,
        { originalError: errorMessage }
      );
      return { success: false, error: agentError };
    }
  }

  protected async sendToAgent<T>(
    targetAgentId: string,
    type: string,
    payload: any,
    correlationId?: string
  ): Promise<Result<AgentMessage<T> | null, AgentError>> { // Allow null data on success
    const msgCorrelationId = correlationId || this.generateCorrelationId();
    const message = createAgentMessage(
      type,
      payload,
      this.id,
      msgCorrelationId,
      targetAgentId
    );

    try {
      this.logger.info(`[${msgCorrelationId}] Sending message to ${targetAgentId}: ${type}`);
      const responseResult = await this.communicationBus.sendMessageAndWaitForResponse<T>(targetAgentId, message); // Renamed to responseResult
      if (responseResult.success) {
        // If data is null, it means the operation was successful but yielded no specific AgentMessage
        // This is handled by the caller (e.g., routes.ts)
        return { success: true, data: responseResult.data };
      } else {
        return { success: false, error: responseResult.error };
      }
    } catch (error: unknown) { // Explicitly type as unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${msgCorrelationId}] Failed to send message to ${targetAgentId}: ${errorMessage}`, { error });
      const agentError = new AgentError(
        `Failed to send message to ${targetAgentId}: ${errorMessage}`,
        'COMMUNICATION_ERROR',
        this.id,
        msgCorrelationId,
        true,
        { originalError: errorMessage }
      );
      return { success: false, error: agentError };
    }
  }

  protected broadcast(type: string, payload: any, correlationId?: string): void {
    const msgCorrelationId = correlationId || this.generateCorrelationId();
    const message = createAgentMessage(
      type,
      payload,
      this.id,
      msgCorrelationId,
      '*' // Broadcast to all
    );
    this.logger.info(`[${msgCorrelationId}] Broadcasting message: ${type}`);
    this.communicationBus.publishToAgent('*', message);
  }

  protected generateCorrelationId(): string {
    return `${this.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}