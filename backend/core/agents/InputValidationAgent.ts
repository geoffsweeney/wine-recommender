import { inject, injectable } from 'tsyringe';
import { TYPES } from '../../di/Types';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage'; // Added MessageTypes
import { BasicDeadLetterProcessor } from '../BasicDeadLetterProcessor';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import winston from 'winston';
import { UserPreferences, PreferenceNode } from '../../types'; // Import UserPreferences, PreferenceNode
import { LLMService } from '../../services/LLMService'; // Import LLMService

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
    @inject(TYPES.InputValidationAgentConfig) private readonly agentConfig: InputValidationAgentConfig, // Inject the specific agent config
    @inject(LLMService) private readonly llmService: LLMService // Inject LLMService
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
      MessageTypes.VALIDATE_INPUT,
      this.handleValidationRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  async handleValidationRequest(message: AgentMessage<{ message: string; recommendationSource: string }>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    try {
      const inputMessage = message.payload.message;
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
      const prompt = this.buildValidationPrompt(inputMessage);
      const llmResponseResult = await this.llmService.sendStructuredPrompt<ValidationResult>(prompt, InputValidationSchema, null, correlationId);

      if (!llmResponseResult.success) {
        return { success: false, error: llmResponseResult.error };
      }

      const parsedResponse = llmResponseResult.data;

      // Basic structural validation of the parsed response (redundant if Zod is used, but good for safety)
      const isValid = typeof parsedResponse.isValid === 'boolean' ? parsedResponse.isValid : false;
      if (typeof parsedResponse.isValid !== 'boolean') {
        this.logger.warn(`[${correlationId}] LLM response missing or invalid 'isValid' field. Defaulting to ${isValid}.`, { agentId: this.id, operation: 'validateInput' });
      }

      const cleanedInput = parsedResponse.cleanedInput || { ingredients: [], budget: 0, occasion: undefined };
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
    // The schema is now passed directly to sendStructuredPrompt, so we just need the prompt text
    return `Analyze the following user input for wine pairing:
User Input: "${inputMessage}"

Tasks:
1. Extract ingredients, budget, and occasion from the user input.
2. Validate if the extracted ingredients are food items.
3. Standardize ingredient names (e.g., "salmon" -> "fish").
4. Check for dietary restrictions mentioned.
5. Return ONLY the JSON object, with no additional text or markdown formatting.`;
  }
}

export const InputValidationSchema = {
  type: "object",
  properties: {
    isValid: { type: "boolean" },
    errors: {
      type: "array",
      items: { type: "string" }
    },
    cleanedInput: {
      type: "object",
      properties: {
        ingredients: {
          type: "array",
          items: { type: "string" }
        },
        budget: { type: "number", nullable: true },
        occasion: { type: "string", nullable: true }
      },
      required: ["ingredients", "budget"]
    },
    extractedData: {
      type: "object",
      properties: {
        standardizedIngredients: {
          type: "object",
          additionalProperties: { type: "string" }
        },
        dietaryRestrictions: {
          type: "array",
          items: { type: "string" }
        },
        preferences: {
          type: "object",
          properties: {
            wineType: { type: "string" },
            body: { type: "string" },
            flavorProfile: { type: "string" },
            pairing: { type: "string" }
          },
          required: []
        }
      },
      required: ["standardizedIngredients", "dietaryRestrictions", "preferences"]
    }
  },
  required: ["isValid", "errors", "cleanedInput", "extractedData"]
};