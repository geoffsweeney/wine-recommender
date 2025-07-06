import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { LLMService } from '../../services/LLMService';
import { PromptManager } from '../../services/PromptManager'; // Import PromptManager
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';
import { RecommendationResult } from '../../types/agent-outputs';
import { z } from 'zod'; // Import z for schema definition
import { GrapeVariety } from '../../services/models/Wine'; // Import GrapeVariety
import { UserPreferences } from '../../types'; // Import UserPreferences

interface LLMRecommendationRequestPayload {
  preferences?: Record<string, any>;
  message?: string;
  ingredients?: string[];
  recommendationSource?: 'knowledgeGraph' | 'llm';
  conversationHistory: Array<{ role: string; content: string }>;
  priceRange?: { min?: number; max?: number };
  occasion?: string;
  wineStyle?: string[];
  bodyPreference?: 'light' | 'medium' | 'full';
  sweetness?: 'dry' | 'off-dry' | 'medium-dry' | 'medium-sweet' | 'sweet';
}

export interface WineRecommendationOutput {
  name: string;
  grapeVarieties?: GrapeVariety[];
}

interface LLMRecommendationResponsePayload {
  wines: WineRecommendationOutput[];
  confidenceScore?: number;
  alternatives?: WineRecommendationOutput[];
}

export interface LLMRecommendationAgentConfig {
  defaultConfidenceScore: number;
  maxRecommendations: number;
  includePairingAdvice: boolean;
  modelTemperature: number;
}

@injectable()
export class LLMRecommendationAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(TYPES.PromptManager) private readonly promptManager: PromptManager, // Inject PromptManager
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.LLMRecommendationAgentConfig) private readonly agentConfig: LLMRecommendationAgentConfig
  ) {
    const id = 'llm-recommendation-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: agentConfig as any
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] LLMRecommendationAgent initialized`, { 
      agentId: this.id, 
      operation: 'initialization',
      config: {
        maxRecommendations: agentConfig.maxRecommendations,
        includePairingAdvice: agentConfig.includePairingAdvice
      }
    });
  }

  public getName(): string {
    return this.id;
  }

  public getCapabilities(): string[] {
    return [
      'llm-recommendation',
      'conversational-recommendation',
      'preference-analysis',
      'ingredient-matching',
      'confidence-scoring',
      'food-pairing',
      'budget-awareness',
      'style-matching'
    ];
  }

  public async handleMessage(message: AgentMessage<any>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    if (message.type === 'llm-recommendation-request') {
      return this.handleRecommendationRequest(message as AgentMessage<LLMRecommendationRequestPayload>);
    }
    this.logger.warn(`[${correlationId}] LLMRecommendationAgent received unhandled message type: ${message.type}`, {
      agentId: this.id,
      operation: 'handleMessage',
      correlationId: correlationId,
      messageType: message.type
    });
    return { success: false, error: new AgentError('Unhandled message type', 'UNHANDLED_MESSAGE_TYPE', this.id, message.correlationId) };
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      'llm-recommendation-request',
      this.handleRecommendationRequest.bind(this)
    );
  }

  private async handleRecommendationRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    const logContext: LogContext = { correlationId, agentId: this.id, operation: 'handleRecommendationRequest' };
    this.logger.info(`[${correlationId}] Processing recommendation request`, logContext);

    try {
      const payload = message.payload as LLMRecommendationRequestPayload;

      if (!payload) {
        const error = new AgentError('Missing payload in recommendation request', 'MISSING_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }

      // Validate that we have enough information to make a recommendation
      if (!payload.message && !payload.preferences && !payload.ingredients) {
        const error = new AgentError('Insufficient information for recommendation', 'INSUFFICIENT_DATA', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }

      const promptVariables = {
        userPreferences: payload.preferences as UserPreferences || {},
        conversationHistory: payload.conversationHistory || [],
        priceRange: payload.priceRange,
        occasion: payload.occasion,
        wineStyle: payload.wineStyle,
        bodyPreference: payload.bodyPreference,
        sweetness: payload.sweetness,
        // availableWines: payload.availableWines // Assuming availableWines might be passed in payload
      };

      // Log the prompt variables for debugging
      this.logger.debug(`[${correlationId}] Prompt variables for LLM recommendation`, {
        agentId: this.id,
        promptVariables: promptVariables,
        hasPreferences: !!payload.preferences,
        hasIngredients: !!payload.ingredients,
        conversationLength: payload.conversationHistory?.length || 0
      });

      // Simulate an error for testing fallback
      if (payload.message && payload.message.includes('simulate_error')) { // Check message payload for error simulation
        const error = new AgentError('Simulated LLM error for fallback test', 'SIMULATED_LLM_ERROR', this.id, correlationId, true);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-simulated-error', correlationId });
        return { success: false, error };
      }


const llmResponseResult = await this.llmService.sendStructuredPrompt<"recommendWines", RecommendationResult>(
  'recommendWines',
  promptVariables,
  logContext // Pass logContext
);

      if (!llmResponseResult.success) {
        const error = new AgentError(
          `LLM service failed: ${llmResponseResult.error.message}`, 
          'LLM_SERVICE_ERROR', 
          this.id, 
          correlationId, 
          true, 
          { originalError: llmResponseResult.error.message }
        );
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-llm-failure', correlationId });
        return { success: false, error };
      }

      const parsedRecommendation = llmResponseResult.data;
      
      // Validate the LLM response
      const validationResult = this.validateRecommendationResult(parsedRecommendation, correlationId);
      if (!validationResult.isValid) {
        const error = new AgentError(
          `Invalid LLM response: ${validationResult.error}`, 
          'INVALID_LLM_RESPONSE', 
          this.id, 
          correlationId
        );
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }

      // Ensure grape percentages are present, estimating if necessary
      parsedRecommendation.recommendations = this.ensureGrapePercentages(parsedRecommendation.recommendations as WineRecommendationOutput[] || []);
      if (parsedRecommendation.alternatives) {
        parsedRecommendation.alternatives = this.ensureGrapePercentages(parsedRecommendation.alternatives as WineRecommendationOutput[]);
      }

      this.logger.debug(`[${correlationId}] Successfully parsed and validated LLM response`, {
        agentId: this.id,
        recommendationCount: parsedRecommendation.recommendations?.length || 0,
        confidence: parsedRecommendation.confidence
      });

      const responseMessage = createAgentMessage(
        'llm-recommendation-response',
        {
          recommendation: parsedRecommendation,
          confidenceScore: parsedRecommendation.confidence || this.agentConfig.defaultConfidenceScore
        },
        this.id, // sourceAgent
        message.conversationId, // conversationId
        correlationId, // correlationId
        message.sourceAgent // targetAgent
      );

      this.logger.info(`[${correlationId}] Recommendation request processed successfully`, {
        agentId: this.id,
        operation: 'handleRecommendationRequest',
        confidence: parsedRecommendation.confidence
      });
      
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(
        errorMessage, 
        'LLM_RECOMMENDATION_EXCEPTION', 
        this.id, 
        correlationId, 
        true, 
        { originalError: errorMessage }
      );
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'recommendation-exception', correlationId });
      this.logger.error(`[${correlationId}] Failed to process LLM recommendation request: ${errorMessage}`, { 
        agentId: this.id, 
        operation: 'handleRecommendationRequest', 
        originalError: errorMessage 
      });
      return { success: false, error: agentError };
    }
  }


  private validateRecommendationResult(result: any, correlationId: string): { isValid: boolean; error?: string } {
    if (!result) {
      return { isValid: false, error: "No result provided" };
    }

    if (!Array.isArray(result.recommendations) || result.recommendations.length === 0) {
      return { isValid: false, error: "Missing or empty recommendations array" };
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      return { isValid: false, error: "Invalid confidence score (must be number between 0 and 1)" };
    }

    if (!result.reasoning || typeof result.reasoning !== 'string' || result.reasoning.trim().length === 0) {
      return { isValid: false, error: "Missing or empty reasoning" };
    }

    // Check for generic recommendations that suggest poor LLM performance
    const genericTerms = ['red wine', 'white wine', 'wine', 'bottle'];
    const hasGenericRecs = result.recommendations.some((rec: WineRecommendationOutput) =>
      genericTerms.some(term => rec.name.toLowerCase().trim() === term)
    );

    if (hasGenericRecs) {
      this.logger.warn(`[${correlationId}] LLM provided generic recommendations`, {
        agentId: this.id,
        recommendations: result.recommendations
      });
    }

    return { isValid: true };
  }

  private ensureGrapePercentages(recommendations: WineRecommendationOutput[]): WineRecommendationOutput[] {
    return recommendations.map(rec => {
      if (rec.grapeVarieties && rec.grapeVarieties.length > 0) {
        const hasPercentages = rec.grapeVarieties.every(gv => typeof gv.percentage === 'number');
        if (!hasPercentages) {
          const estimatedPercentage = 100 / rec.grapeVarieties.length;
          rec.grapeVarieties = rec.grapeVarieties.map(gv => ({
            ...gv,
            percentage: gv.percentage || estimatedPercentage
          }));
        }
      }
      return rec;
    });
  }
}

// Enhanced schema with more specific requirements
export const EnhancedRecommendationSchema = z.object({
  recommendations: z.array(z.object({
    name: z.string().min(5, "Specific wine name required"),
    grapeVarieties: z.array(z.object({
      name: z.string(),
      percentage: z.number().optional()
    })).optional()
  })).min(1, "At least one recommendation required").max(5, "Maximum 5 recommendations allowed"),
  confidence: z.number().min(0.1, "Confidence must be at least 0.1").max(1.0, "Confidence cannot exceed 1.0"),
  reasoning: z.string().min(20, "Reasoning must be at least 20 characters"),
  pairingNotes: z.string().optional(),
  alternatives: z.array(z.object({
    name: z.string(),
    grapeVarieties: z.array(z.object({
      name: z.string(),
      percentage: z.number().optional()
    })).optional()
  })).max(3, "Maximum 3 alternatives allowed").optional()
});

// Keep the original schema for backward compatibility
// The original RecommendationSchema is no longer needed as we are using the schema from PromptManager
// export const RecommendationSchema = z.object({
//   recommendations: z.array(z.string()),
//   confidence: z.number(),
//   reasoning: z.string()
// });
