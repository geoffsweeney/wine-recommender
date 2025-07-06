import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { LLMService } from '../../services/LLMService';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { UserPreferences } from '../../types'; // Import UserPreferences
import { PromptManager } from '../../services/PromptManager'; // Import PromptManager
import { z } from 'zod'; // Import Zod

interface ExplanationMessagePayload {
  wineName: string | null;
  ingredients: string[];
  preferences: UserPreferences;
  recommendationContext: any;
  userId?: string;
}

// Define the configuration interface for ExplanationAgent
export interface ExplanationAgentConfig {
  defaultExplanation: string;
}

// Define schemas directly in this file
export const ExplanationInputSchema = z.object({
  wineName: z.string().optional().nullable(),
  ingredients: z.array(z.string()).optional(),
  preferences: z.any().optional(), // UserPreferences schema is complex, using any for now
  recommendationContext: z.any().optional(), // Full conversation state
});

export const ExplanationOutputSchema = z.object({
  explanation: z.string().describe('A conversational explanation for the wine recommendation.'),
});

@injectable()
export class ExplanationAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.ExplanationAgentConfig) private readonly agentConfig: ExplanationAgentConfig, // Inject agent config
    @inject(TYPES.PromptManager) private readonly promptManager: PromptManager // Inject PromptManager
  ) {
    const id = 'explanation-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers(); // Corrected method name
    this.logger.info(`[${this.id}] ExplanationAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'ExplanationAgent';
  }

  getCapabilities(): string[] {
    return [
      'wine-explanation',
      'llm-generation',
      'context-aware-explanation',
      'error-handling'
    ];
  }

  protected validateConfig(config: ExplanationAgentConfig): void {
    if (!config.defaultExplanation) {
      // Use this.dependencies.logger as this.logger is not yet assigned in BaseAgent constructor
      this.dependencies.logger.warn(`[${this.id}] Default explanation is not provided in config.`, { agentId: this.id, operation: 'validateConfig' });
    }
  }

  protected getInitialState(): any {
    return {};
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    if (message.type === MessageTypes.GENERATE_EXPLANATION) {
      return this.handleExplanationRequestInternal(message as AgentMessage<ExplanationMessagePayload>);
    }
    this.logger.warn(`[${correlationId}] ExplanationAgent received unhandled message type: ${message.type}`, {
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
      MessageTypes.GENERATE_EXPLANATION,
      this.handleExplanationRequestInternal.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  public async handleExplanationRequestInternal(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(
      `[ExplanationAgent] Handling explanation request (message.correlationId: ${message.correlationId})`,
      {
        agentId: this.id,
        operation: 'handleExplanationRequestInternal',
        correlationId: message.correlationId
      }
    );

    try {
      // Validate and cast payload
      const payload = message.payload as ExplanationMessagePayload;
      if (!payload || typeof payload.wineName === 'undefined' || typeof payload.recommendationContext === 'undefined') { // Basic validation
        const error = new AgentError('Invalid or missing payload in explanation request', 'MISSING_OR_INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'explanation-validation', correlationId });
        this.logger.error(
          `[ExplanationAgent] Error handling explanation request: ${error.message}`,
          {
            agentId: this.id,
            operation: 'handleExplanationRequestInternal',
            correlationId: message.correlationId,
            originalError: error.message
          }
        );
        return { success: false, error };
      }
      const explanation = await this.generateExplanation(
        payload.wineName,
        payload.ingredients,
        payload.preferences,
        payload.recommendationContext,
        correlationId
      );

      const responseMessage = createAgentMessage(
        'explanation-response',
        {
          explanation,
          wineName: payload.wineName,
          userId: payload.userId
        },
        this.id,
        message.conversationId,
        correlationId,
        message.sourceAgent
      );
      this.logger.info(
        '[ExplanationAgent] Explanation request processed successfully',
        {
          agentId: this.id,
          operation: 'handleExplanationRequestInternal',
          correlationId: message.correlationId
        }
      );
      return { success: true, data: responseMessage };
    } catch (e: any) {
      console.log(`[ExplanationAgent] DEBUG: Raw error caught:`, e);
      let agentError: AgentError;
      if (e instanceof AgentError) {
        agentError = e;
      } else {
        const errorMessage = e instanceof Error ? e.message : String(e);
        agentError = new AgentError(errorMessage, 'TEST_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      }
      
      await this.deadLetterProcessor.process(message.payload, agentError, {
        source: this.id,
        stage: 'explanation-exception',
        correlationId
      });
      
      this.logger.error(
        `[ExplanationAgent] Error handling explanation request: ${agentError.message}`,
        {
          agentId: this.id,
          operation: 'handleExplanationRequestInternal',
          correlationId: message.correlationId,
          originalError: agentError.message
        }
      );
      
      console.log(`[ExplanationAgent] DEBUG: Processed error: ${JSON.stringify(agentError)}`);
      this.logger.debug(`[ExplanationAgent] Returning from catch block: ${JSON.stringify({ success: false, error: agentError })}`, { correlationId: message.correlationId });
      return { success: false, error: agentError };
    }
  }

  private async generateExplanation(
    wineName: string | null,
    ingredients: string[],
    preferences: UserPreferences,
    recommendationContext: any,
    correlationId: string
  ): Promise<string> {
    this.logger.info(
      `[ExplanationAgent] Generating explanation for wine: ${wineName} (correlationId: ${correlationId})`,
      {
        agentId: this.id,
        operation: 'generateExplanation',
        correlationId: correlationId
      }
    );

    const promptVariables = {
      wineName,
      ingredients,
      preferences,
      recommendationContext,
    };

    try {
      const explanationPromptResult = await this.promptManager.getPrompt('explanation', promptVariables);

      if (!explanationPromptResult.success) {
        throw new AgentError(
          `Failed to get explanation prompt: ${explanationPromptResult.error.message}`,
          'PROMPT_GENERATION_ERROR',
          this.id,
          correlationId
        );
      }

      const llmResponseResult = await this.llmService.sendStructuredPrompt<
        'explanation', // Task name
        { explanation: string } // Explicitly define the expected output structure
      >(
        'explanation', // Task name
        promptVariables, // Variables
        { correlationId: correlationId } // Log context
      );

      if (!llmResponseResult.success) {
        throw new AgentError(
          `LLM service returned error: ${llmResponseResult.error.message}`,
          'LLM_SERVICE_ERROR',
          this.id,
          correlationId
        );
      }
      return llmResponseResult.data.explanation; // Assuming the output schema has an 'explanation' field
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      throw new AgentError(
        `Error generating explanation: ${error instanceof Error ? error.message : String(error)}`,
        'EXPLANATION_GENERATION_ERROR',
        this.id,
        correlationId
      );
    }
  }

  private async handleError(message: AgentMessage<unknown>, error: AgentError, correlationId: string): Promise<void> {
    await this.deadLetterProcessor.process(
      message.payload,
      error,
      { source: this.id, stage: 'ExplanationProcessing', correlationId }
    );

    const errorMessage = createAgentMessage(
      'error-response',
      {
        error: error.message,
        code: error.code,
        userId: (message.payload as ExplanationMessagePayload)?.userId // Pass userId from payload
      },
      this.id,
      message.conversationId, // Corrected: conversationId
      correlationId, // Corrected: correlationId
      message.sourceAgent // Corrected: targetAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
    this.logger.error(`[${correlationId}] Error in ExplanationAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
  }
}
