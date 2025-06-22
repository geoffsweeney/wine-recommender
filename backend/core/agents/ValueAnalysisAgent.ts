import { inject, injectable } from 'tsyringe';
import { TYPES } from '../../di/Types';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import winston from 'winston';

export interface ValueAnalysisRequest {
  wineId: string;
  price: number;
  region: string;
  vintage: number;
  additionalContext?: string;
}

export interface ValueAnalysisResponse {
  success: boolean;
  analysis?: string;
  error?: string;
  wineId: string;
}

// Define the configuration interface for ValueAnalysisAgent
export interface ValueAnalysisAgentConfig {
  // Add any specific configuration properties for this agent here
  // For now, it can be empty or include default values if needed
  defaultTimeoutMs: number;
}

@injectable()
export class ValueAnalysisAgent extends CommunicatingAgent {
  constructor(
    @inject(TYPES.AgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger, // Inject logger
    @inject(TYPES.ValueAnalysisAgentConfig) private readonly agentConfig: ValueAnalysisAgentConfig // Inject agent config
  ) {
    const id = 'value-analysis-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies); // Pass agentConfig as the config for BaseAgent
    this.registerHandlers();
    this.logger.info(`[${this.id}] ValueAnalysisAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  getName(): string {
    return 'ValueAnalysisAgent';
  }

  getCapabilities(): string[] {
    return [
      'value-analysis',
      'price-evaluation',
      'llm-integration',
      'wine-quality-assessment'
    ];
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    
    this.communicationBus.registerMessageHandler(
      this.id, // Use this.id
      'value-analysis',
      this.handleValueAnalysisRequest.bind(this)
    );
  }

  async handleValueAnalysisRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling value analysis request`, { agentId: this.id, operation: 'handleValueAnalysisRequest' });

    try {
      if (!this.isValueAnalysisRequest(message.payload)) {
        const error = new AgentError('Invalid message payload for value analysis request', 'INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'value-analysis-validation', correlationId });
        return { success: false, error };
      }

      const result = await this.processValueAnalysis(message.payload, correlationId);
      
      if (!result.success) {
        // result.error is already an AgentError from processValueAnalysis
        await this.deadLetterProcessor.process(message.payload, result.error, { source: this.id, stage: 'value-analysis-processing', correlationId });
        return { success: false, error: result.error };
      }

      const responseMessage = createAgentMessage(
        'value-analysis-result',
        result.data,
        this.id,
        correlationId,
        message.sourceAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
      this.logger.info(`[${correlationId}] Value analysis request processed successfully`, { agentId: this.id, operation: 'handleValueAnalysisRequest' });
      return { success: true, data: responseMessage };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = new AgentError(
        `Error handling value analysis request: ${errorMessage}`,
        'VALUE_ANALYSIS_REQUEST_ERROR',
        this.id,
        correlationId,
        true,
        { originalError: errorMessage }
      );
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'value-analysis-exception', correlationId });
      this.logger.error(`[${correlationId}] Error handling value analysis request: ${errorMessage}`, { agentId: this.id, operation: 'handleValueAnalysisRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private isValueAnalysisRequest(obj: unknown): obj is ValueAnalysisRequest {
    return typeof obj === 'object' &&
           obj !== null &&
           'wineId' in obj &&
           'price' in obj &&
           'region' in obj &&
           'vintage' in obj;
  }

  async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.warn(`[${correlationId}] ValueAnalysisAgent received unhandled message type: ${message.type}`, {
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

  private async processValueAnalysis(request: ValueAnalysisRequest, correlationId: string): Promise<Result<ValueAnalysisResponse, AgentError>> {
    this.logger.info(`[${correlationId}] Processing value analysis for wineId: ${request.wineId}`, { agentId: this.id, operation: 'processValueAnalysis' });

    try {
      const llmPrompt = `Analyze the following wine data and provide value analysis:
        Wine ID: ${request.wineId}
        Price: ${request.price}
        Region: ${request.region}
        Vintage: ${request.vintage}
        Additional context: ${request.additionalContext ?? 'None'}`;

      const llmResponseResult = await this.communicationBus.sendLLMPrompt(llmPrompt, correlationId);

      if (!llmResponseResult.success) {
        const error = new AgentError(`LLM service failed: ${llmResponseResult.error.message}`, 'LLM_SERVICE_ERROR', this.id, correlationId, true, { originalError: llmResponseResult.error.message });
        this.logger.error(`[${correlationId}] LLM service failed to respond: ${error.message}`, { agentId: this.id, operation: 'processValueAnalysis', originalError: error.message });
        return { success: false, error };
      }

      const llmResponse = llmResponseResult.data;

      if (!llmResponse) {
        const error = new AgentError('No response data from LLM', 'LLM_NO_RESPONSE', this.id, correlationId, true);
        this.logger.error(`[${correlationId}] No response data from LLM`, { agentId: this.id, operation: 'processValueAnalysis' });
        return { success: false, error };
      }

      const response: ValueAnalysisResponse = {
        success: true,
        analysis: llmResponse,
        wineId: request.wineId
      };
      this.logger.info(`[${correlationId}] Value analysis processed by LLM successfully`, { agentId: this.id, operation: 'processValueAnalysis' });
      return { success: true, data: response };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(`Error during value analysis: ${errorMessage}`, 'VALUE_ANALYSIS_PROCESSING_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      this.logger.error(`[${correlationId}] Error during value analysis processing: ${errorMessage}`, { agentId: this.id, operation: 'processValueAnalysis', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }
}