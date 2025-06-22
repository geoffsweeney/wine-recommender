import { inject, injectable } from 'tsyringe';
import { TYPES } from '../../di/Types';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage'; // Added
import { BasicDeadLetterProcessor } from '../BasicDeadLetterProcessor';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import winston from 'winston';
import { UserPreferences } from '../../types'; // Import UserPreferences


export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  cleanedInput?: { // Renamed from sanitizedInput
    ingredients: string[];
    budget: number;
    occasion?: string;
  };
  extractedData?: { // Renamed from processedInput
    preferences?: UserPreferences;
    dietaryRestrictions?: string[];
    standardizedIngredients?: Record<string, string>;
  };
}

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
    @inject(TYPES.InputValidationAgentConfig) private readonly agentConfig: InputValidationAgentConfig // Inject the specific agent config
  ) {
    const id = 'input-validation-agent';
    // Pass the injected agentConfig to the super constructor as the agent's config
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies); // Pass agentConfig as the config for BaseAgent
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
      'validate-input',
      this.handleValidationRequest.bind(this)
    );
  }

  async handleValidationRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    try {
      const validationResult = await this.validateInput(message.payload, message.correlationId);
      
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
        correlationId,
        message.sourceAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);

      // If validation successful and contains preferences, notify UserPreferenceAgent
      if (resultPayload.isValid && resultPayload.extractedData?.preferences) {
        const preferenceUpdateMessage = createAgentMessage(
          'preference-update',
          {
            preferences: resultPayload.extractedData.preferences,
            context: 'from-validation'
          },
          this.id,
          correlationId,
          'UserPreferenceAgent' // Target agent
        );
        const sendResult = await this.communicationBus.sendMessageAndWaitForResponse('UserPreferenceAgent', preferenceUpdateMessage);
        if (!sendResult.success) {
          this.logger.error(`[${correlationId}] Failed to send preference update to UserPreferenceAgent: ${sendResult.error.message}`, {
            agentId: this.id,
            operation: 'handleValidationRequest',
            correlationId: correlationId,
            targetAgent: 'UserPreferenceAgent',
            originalError: sendResult.error.message
          });
          // Optionally, send to dead letter queue or return error
          // For now, we'll just log and continue, as preference update might not be critical for the main flow
        }
      }
      return { success: true, data: responseMessage };

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

  protected async validateInput(input: any, correlationId: string = ''): Promise<Result<ValidationResult, AgentError>> {
    // Basic validation
    if (!input || typeof input !== 'object') {
      return { success: false, error: new AgentError('Input must be an object', 'INVALID_INPUT_TYPE', this.id, correlationId) };
    }

    if (!input.ingredients || !Array.isArray(input.ingredients) || input.ingredients.length === 0) {
      return {
        success: false,
        error: new AgentError('At least one ingredient must be provided', 'MISSING_INGREDIENTS', this.id, correlationId)
      };
    }

    if (input.ingredients.length > this.config.maxIngredients) {
      return {
        success: false,
        error: new AgentError(
          `Maximum ${this.config.maxIngredients} ingredients allowed`,
          'TOO_MANY_INGREDIENTS',
          this.id,
          correlationId
        )
      };
    }

    if (typeof input.budget !== 'number' || input.budget <= 0) {
      return {
        success: false,
        error: new AgentError('Budget must be a positive number', 'INVALID_BUDGET', this.id, correlationId)
      };
    }

    try {
      const llmResponseResult = await this.communicationBus.sendLLMPrompt(this.buildValidationPrompt(input), correlationId);
      if (!llmResponseResult.success) {
        return { success: false, error: llmResponseResult.error };
      }
      const llmResponse = llmResponseResult.data;

      if (llmResponse === undefined || llmResponse === null) {
        return { success: false, error: new AgentError('LLM service not configured or returned no response', 'LLM_NO_RESPONSE', this.id, correlationId) };
      }
      return this.parseValidationResponse(llmResponse, correlationId);
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

  private buildValidationPrompt(input: any): string {
    return `Analyze these ingredients for wine pairing:
Ingredients: ${input.ingredients.join(', ')}
Budget: $${input.budget}
${input.occasion ? `Occasion: ${input.occasion}` : ''}

Tasks:
1. Validate ingredients exist and are food items
2. Standardize ingredient names (e.g. "salmon" → "fish")
3. Check for dietary restrictions
4. Return JSON with:
{
  "isValid": boolean,
  "errors": string[],
  "cleanedInput": { // Renamed from sanitizedInput
    "ingredients": string[],
    "budget": number,
    "occasion": string
  },
  "extractedData": { // Renamed from processedInput
    "standardizedIngredients": Record<string, string>,
    "dietaryRestrictions": string[]
  }
}`;
  }

  private parseValidationResponse(response: string, correlationId: string): Result<ValidationResult, AgentError> {
    try {
      const parsedResponse = JSON.parse(response);
      // Basic structural validation of the parsed response
      if (typeof parsedResponse.isValid !== 'boolean') {
        this.logger.error(`[${correlationId}] LLM response missing isValid field`, { agentId: this.id, operation: 'parseValidationResponse' });
        return { success: false, error: new AgentError('LLM response missing isValid field', 'LLM_PARSE_ERROR', this.id, correlationId) };
      }
      return { success: true, data: parsedResponse };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Failed to parse LLM validation response: ${errorMessage}`, { agentId: this.id, operation: 'parseValidationResponse', originalError: errorMessage });
      return { success: false, error: new AgentError(`Failed to parse LLM validation response: ${errorMessage}`, 'LLM_PARSE_ERROR', this.id, correlationId, true, { originalError: errorMessage }) };
    }
  }
}