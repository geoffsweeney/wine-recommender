import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent } from './CommunicatingAgent';
import { ICommunicatingAgentDependencies } from '../../di/Types';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { LLMService } from '../../services/LLMService';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';

interface FallbackMessagePayload {
  error: {
    message: string;
    stack?: string;
    originalMessage?: any;
  };
  context?: {
    userId?: string;
    conversationId?: string;
    traceId?: string;
  };
}

// Define the configuration interface for FallbackAgent
export interface FallbackAgentConfig {
  defaultFallbackResponse: string;
}

@injectable()
export class FallbackAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.FallbackAgentConfig) private readonly agentConfig: FallbackAgentConfig, // Inject agent config
    @inject(TYPES.CommunicatingAgentDependencies) dependencies: ICommunicatingAgentDependencies // Inject dependencies for base class
  ) {
    const id = 'fallback-agent';
    super(id, agentConfig, dependencies);
    this.registerHandlers(); // Corrected method name
    this.logger.info(`[${this.id}] FallbackAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'FallbackAgent';
  }

  getCapabilities(): string[] {
    return [
      'error-handling',
      'llm-fallback-generation',
      'dead-letter-processing',
      'graceful-degradation'
    ];
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    if (message.type === 'fallback-request') {
      return this.handleFallbackRequest(message as AgentMessage<FallbackMessagePayload>);
    }
    this.logger.warn(`[${correlationId}] FallbackAgent received unhandled message type: ${message.type}`, {
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

  protected registerHandlers(): void { // Corrected method name
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.FALLBACK_REQUEST, // Use MessageTypes.FALLBACK_REQUEST
      this.handleFallbackRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.EMERGENCY_RECOMMENDATIONS, // Use MessageTypes.EMERGENCY_RECOMMENDATIONS
      this.handleFallbackRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handleFallbackRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling fallback request`, { agentId: this.id, operation: 'handleFallbackRequest' });

    try {
      const payload = message.payload as FallbackMessagePayload;
      if (!payload) {
        const error = new AgentError('Missing payload in fallback request', 'MISSING_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'fallback-validation', correlationId });
        return { success: false, error };
      }
      const fallbackResponseResult = await this.generateFallbackResponse(payload, correlationId);

      if (!fallbackResponseResult.success) {
        const error = new AgentError(`Failed to generate fallback response: ${fallbackResponseResult.error.message}`, 'FALLBACK_GENERATION_ERROR', this.id, correlationId, true, { originalError: fallbackResponseResult.error.message });
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'fallback-generation-failure', correlationId });
        return { success: false, error };
      }

      const responseMessage = createAgentMessage(
        'fallback-response',
        fallbackResponseResult.data,
        this.id,
        correlationId,
        message.sourceAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
      this.logger.info(`[${correlationId}] Fallback request processed successfully`, { agentId: this.id, operation: 'handleFallbackRequest' });
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'FALLBACK_REQUEST_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'fallback-exception', correlationId });
      this.logger.error(`[${correlationId}] Error handling fallback request: ${errorMessage}`, { agentId: this.id, operation: 'handleFallbackRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private async generateFallbackResponse(payload: FallbackMessagePayload, correlationId: string): Promise<Result<{ response: string }, AgentError>> {
    this.logger.info(`[${correlationId}] Generating fallback response`, { agentId: this.id, operation: 'generateFallbackResponse' });
    try {
      const prompt = `A request failed with error: ${payload.error.message}. Context: ${JSON.stringify(payload.context)}. Generate a helpful fallback response.`;
      const llmResponseResult = await this.llmService.sendPrompt(
        'rawLlmPrompt',
        { promptContent: prompt },
        { correlationId: correlationId }
      );
      
      if (!llmResponseResult.success) {
        this.logger.warn(`[${correlationId}] LLM failed to generate fallback response: ${llmResponseResult.error.message}`, { agentId: this.id, operation: 'generateFallbackResponse', originalError: llmResponseResult.error.message });
        return { success: true, data: { response: this.agentConfig.defaultFallbackResponse } }; // Use injected default fallback response
      }
      
      return { success: true, data: { response: llmResponseResult.data } };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error during fallback response generation: ${errorMessage}`, { agentId: this.id, operation: 'generateFallbackResponse', originalError: errorMessage });
      return { success: false, error: new AgentError(
        `Failed to generate fallback response from LLM: ${errorMessage}`,
        'LLM_FALLBACK_ERROR',
        this.id,
        correlationId,
        true,
        { originalError: errorMessage }
      )};
    }
  }

  private async handleError(message: AgentMessage<unknown>, error: AgentError, correlationId: string): Promise<void> {
    await this.deadLetterProcessor.process(
      message.payload,
      error,
      { source: this.id, stage: 'FallbackProcessing', correlationId }
    );

    const errorMessage = createAgentMessage(
      'error-response',
      {
        error: error.message,
        code: error.code,
        userId: (message.payload as FallbackMessagePayload)?.context?.userId // Use userId from message payload context
      },
      this.id,
      correlationId,
      message.sourceAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
    this.logger.error(`[${correlationId}] Error in FallbackAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
  }
}
