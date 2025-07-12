import { inject, injectable } from 'tsyringe';
import { TYPES } from '../../di/Types';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage'; // Added MessageTypes
import { BasicDeadLetterProcessor } from '../DeadLetterProcessor';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import winston from 'winston';
import { UserPreferences, PreferenceNode } from '../../types';
import { InputValidationSchema } from '../../types/agent-outputs';
import { z } from 'zod';
import { LLMService } from '../../services/LLMService'; // Keep LLMService import
import { PromptManager } from '../../services/PromptManager'; // Import PromptManager

export interface ValidationResult extends z.infer<typeof InputValidationSchema> {}

// Define the configuration interface for InputValidationAgent
export interface InputValidationAgentConfig {
  ingredientDatabasePath: string;
  dietaryRestrictions: string[];
  standardIngredients: Record<string, string>;
  maxIngredients: number;
}

@injectable()
export class InputValidationAgent extends CommunicatingAgent {
  constructor(
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: BasicDeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(TYPES.InputValidationAgentConfig) private readonly agentConfig: InputValidationAgentConfig,
    @inject(TYPES.LLMService) private readonly llmService: LLMService,
    @inject(TYPES.PromptManager) private readonly promptManager: PromptManager
  ) {
    const id = 'input-validation-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: agentConfig as any
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] InputValidationAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  getName(): string {
    return 'InputValidationAgent';
  }

  getCapabilities(): string[] {
    return ['input-validation', 'llm-integration', 'dead-letter-processing'];
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    
    // Register for validation requests
    this.communicationBus.registerMessageHandler(
      this.id, // Corrected to this.id
      MessageTypes.VALIDATE_INPUT,
      this.handleValidationRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  async handleValidationRequest(message: AgentMessage<{ userInput: { message: string; recommendationSource: string } }>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.debug(`[${correlationId}] InputValidationAgent: Received validation request. Payload: ${JSON.stringify(message.payload)}`);
    try {
      const inputMessage = message.payload.userInput.message; // Extract the message string
      const validationResult = await this.validateInput(inputMessage, message.correlationId);
      
      if (!validationResult.success) {
        await this.deadLetterProcessor.process(message.payload,
          validationResult.error, {
            source: this.id, // Corrected to this.id
            stage: 'validation',
            correlationId: correlationId
          });
        return { success: false, error: validationResult.error };
      }

      const resultPayload = validationResult.data;

      // Send validation result back
      const responseMessage = createAgentMessage(
        'validation-result',
        resultPayload,
        this.id,
        message.conversationId, // conversationId
        message.correlationId, // correlationId
        message.sourceAgent, // targetAgent
        message.userId // userId
      );
      // Removed direct call to this.communicationBus.sendResponse
      // The response will be sent by the EnhancedAgentCommunicationBus after this handler returns

      // If validation successful and contains preferences, notify UserPreferenceAgent
      if (resultPayload.isValid && resultPayload.extractedData?.preferences) {
        // Convert UserPreferences object to an array of PreferenceNode
        const preferencesAsNodes: PreferenceNode[] = Object.entries(resultPayload.extractedData.preferences).map(([type, value]) => ({
          type: type,
          value: String(value), // Ensure value is string or number
          source: this.id,
          confidence: 1, // Default confidence
          timestamp: new Date().toISOString(),
          active: true
        }));

        const preferenceUpdateMessage = createAgentMessage(
          'preference-update',
          {
            preferences: preferencesAsNodes, // Send as PreferenceNode[]
            context: 'from-validation'
          },
          this.id, // sourceAgent
          message.conversationId, // conversationId
          message.correlationId, // correlationId
          'user-preference-agent', // targetAgent
          message.userId // userId
        );
        this.communicationBus.publishToAgent('user-preference-agent', preferenceUpdateMessage);
        this.logger.info(`[${correlationId}] Queued preference update for UserPreferenceAgent (fire-and-forget)`, {
          agentId: this.id,
          operation: 'handleValidationRequest',
          correlationId: correlationId,
          targetAgent: 'UserPreferenceAgent'
        });
      }
      return { success: true, data: responseMessage }; // Ensure the response message is returned

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = new AgentError(
        `Error handling validation request: ${errorMessage}`,
        'VALIDATION_REQUEST_ERROR',
        this.id,
        correlationId,
        true,
        { originalError: errorMessage }
      );
      await this.deadLetterProcessor.process(message.payload,
        agentError, {
          source: this.id,
          stage: 'validation',
          correlationId: correlationId,
          agentId: this.id,
          operation: 'handleValidationRequest'
        });
      return { success: false, error: agentError };
    }
  }

  async handleMessage(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.warn(`[${correlationId}] InputValidationAgent received unhandled message type: ${message.type}`, {
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

  protected async validateInput(inputMessage: string, correlationId: string = ''): Promise<Result<ValidationResult, AgentError>> {
    try {
      const promptVariables = inputMessage; // Pass the string directly
      this.logger.debug(`[${correlationId}] InputValidationAgent: Preparing variables for LLMService.sendStructuredPrompt: ${JSON.stringify({ userInput: promptVariables })}`);

      const llmResponseResult = await this.llmService.sendStructuredPrompt<
        'inputValidation',
        ValidationResult
      >(
        'inputValidation',
        { userInput: promptVariables }, // Wrap in an object with the correct key
        { correlationId: correlationId }
      );
      // The existing log was already moved to the correct place in the previous step.
      // This line is now redundant as the new log above serves the same purpose.
      // this.logger.debug(`[${correlationId}] InputValidationAgent: Variables sent to LLMService.sendStructuredPrompt: ${JSON.stringify(promptVariables)}`);

      if (!llmResponseResult.success) {
        return { success: false, error: llmResponseResult.error };
      }

      const parsedResponse = llmResponseResult.data;

      // The parsedResponse is now guaranteed to be of type InputValidationResult due to Zod validation in LLMService
      const isValid = parsedResponse.isValid;
      // No need for typeof check, as Zod ensures it's boolean

      const cleanedInput = parsedResponse.cleanedInput || { ingredients: [], budget: null, occasion: null };
      const extractedData = parsedResponse.extractedData || { standardizedIngredients: {}, dietaryRestrictions: [], preferences: {} };
      const errors = parsedResponse.errors || [];

      const finalResult: ValidationResult = {
        isValid: isValid,
        errors: errors,
        cleanedInput: cleanedInput,
        extractedData: extractedData
      };
      return { success: true, data: finalResult };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error during LLM validation: ${errorMessage}`, {
        agentId: this.id,
        operation: 'validateInput',
        correlationId: correlationId,
        originalError: errorMessage
      });
      return { success: false, error: new AgentError(`Error during LLM validation: ${errorMessage}`, 'LLM_VALIDATION_ERROR', this.id, correlationId, true, { originalError: errorMessage }) };
    }
  }

  private buildValidationPrompt(inputMessage: string): string {
    // This method is no longer needed as the prompt is managed by PromptManager
    // and passed via LLMService.sendStructuredPrompt
    throw new Error("buildValidationPrompt should not be called. Prompts are managed by PromptManager.");
  }
}
