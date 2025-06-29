import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { LLMService } from '../../services/LLMService';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';
import { RecommendationResult } from '../../types/agent-outputs';
import { z } from 'zod'; // Import z for schema definition

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

interface LLMRecommendationResponsePayload {
  wines: string[];
  confidenceScore?: number;
  alternatives?: string[];
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
    this.logger.info(`[${correlationId}] Processing recommendation request`, { 
      agentId: this.id, 
      operation: 'handleRecommendationRequest' 
    });

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

      const prompt = this.buildEnhancedPrompt(payload);
      
      // Log the prompt for debugging (consider removing in production)
      this.logger.debug(`[${correlationId}] Generated prompt for LLM`, { 
        agentId: this.id, 
        promptLength: prompt.length,
        hasPreferences: !!payload.preferences,
        hasIngredients: !!payload.ingredients,
        conversationLength: payload.conversationHistory?.length || 0
      });

      // Simulate an error for testing fallback
      if (prompt.includes('simulate_error')) {
        const error = new AgentError('Simulated LLM error for fallback test', 'SIMULATED_LLM_ERROR', this.id, correlationId, true);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-simulated-error', correlationId });
        return { success: false, error };
      }

      const llmResponseResult = await this.llmService.sendStructuredPrompt<RecommendationResult>(
        prompt,
        EnhancedRecommendationSchema,
        null, // zodSchema is null
        { // llmOptions
          temperature: this.agentConfig.modelTemperature || 0.7,
          num_predict: 2048 // Assuming a default num_predict if not specified in config
        },
        correlationId
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

  private buildEnhancedPrompt(payload: LLMRecommendationRequestPayload): string {
    // Build a comprehensive system prompt with better structure and examples
    const systemPrompt = this.buildSystemPrompt();
    const contextSection = this.buildContextSection(payload);
    const examplesSection = this.buildExamplesSection();
    const requestSection = this.buildRequestSection(payload);
    const outputInstructions = this.buildOutputInstructions();

    return [
      systemPrompt,
      examplesSection,
      contextSection,
      requestSection,
      outputInstructions
    ].filter(section => section.trim()).join('\n\n');
  }

  private buildSystemPrompt(): string {
    return `You are an expert sommelier with extensive knowledge of wines from around the world. Your role is to provide personalized wine recommendations based on user preferences, food pairings, budget constraints, and occasion requirements.

Key principles for recommendations:
- Always consider the user's stated preferences and constraints
- Match wine characteristics to food if ingredients are provided
- Respect budget limitations when specified
- Provide specific wine names and producers when possible
- Consider the occasion and setting
- Explain your reasoning clearly and concisely
- Be honest about confidence levels`;
  }

  private buildExamplesSection(): string {
    return `## Examples of Good Recommendations:

Example 1 - Food Pairing:
User: "I'm making grilled salmon with lemon and herbs for dinner tonight"
Response: {
  "recommendations": ["Sancerre Loire Valley", "Chablis Premier Cru", "Oregon Pinot Noir"],
  "confidence": 0.9,
  "reasoning": "Sancerre's mineral acidity complements salmon's richness, while Chablis adds citrus harmony. Oregon Pinot Noir offers a light red option that pairs beautifully with grilled salmon.",
  "pairingNotes": "The mineral notes in these wines enhance the fish while complementing the lemon and herbs.",
  "alternatives": ["Albariño", "Grüner Veltliner"]
}

Example 2 - Preference-based:
User: "I love bold, full-bodied red wines under $25"
Response: {
  "recommendations": ["Côtes du Rhône Villages", "Spanish Garnacha", "Portuguese Douro Red"],
  "confidence": 0.85,
  "reasoning": "These regions offer excellent value for bold, full-bodied reds with rich fruit and robust tannins within your budget.",
  "pairingNotes": "Perfect with grilled meats, hearty stews, or aged cheeses.",
  "alternatives": ["Montepulciano d'Abruzzo", "Côtes du Roussillon"]
}`;
  }

  private buildContextSection(payload: LLMRecommendationRequestPayload): string {
    let context = "## Current Request Context:";
    
    if (payload.conversationHistory && payload.conversationHistory.length > 0) {
      context += "\n### Previous Conversation:";
      payload.conversationHistory.slice(-3).forEach(turn => { // Only include last 3 turns
        context += `\n${turn.role}: ${turn.content}`;
      });
    }

    if (payload.preferences && Object.keys(payload.preferences).length > 0) {
      context += `\n### User Preferences: ${JSON.stringify(payload.preferences, null, 2)}`;
    }

    if (payload.priceRange) {
      context += `\n### Budget: $${payload.priceRange.min || 'any'} - $${payload.priceRange.max || 'any'}`;
    }

    if (payload.occasion) {
      context += `\n### Occasion: ${payload.occasion}`;
    }

    return context;
  }

  private buildRequestSection(payload: LLMRecommendationRequestPayload): string {
    let request = "## Current Request:";

    if (payload.message) {
      request += `\nUser Message: "${payload.message}"`;
    }

    if (payload.ingredients && payload.ingredients.length > 0) {
      request += `\nFood/Ingredients: ${payload.ingredients.join(', ')}`;
    }

    if (payload.wineStyle && payload.wineStyle.length > 0) {
      request += `\nPreferred Wine Styles: ${payload.wineStyle.join(', ')}`;
    }

    if (payload.bodyPreference) {
      request += `\nBody Preference: ${payload.bodyPreference}`;
    }

    if (payload.sweetness) {
      request += `\nSweetness Preference: ${payload.sweetness}`;
    }

    return request;
  }

  private buildOutputInstructions(): string {
    const maxRecs = this.agentConfig.maxRecommendations || 3;
    
    return `## Instructions:
Provide exactly ${maxRecs} specific wine recommendations in the JSON format below. 
- Use specific wine names and producers when possible (e.g., "Kendall-Jackson Vintner's Reserve Chardonnay" rather than just "Chardonnay")
- Confidence should be between 0.1 and 1.0 based on how well the recommendations match the request
- Reasoning should be 1-2 sentences explaining why these wines fit the request
- Include pairing notes if food/ingredients are mentioned
- Alternatives should be 2-3 backup options

## Required JSON Output Format:`;
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
    const hasGenericRecs = result.recommendations.some((rec: string) => 
      genericTerms.some(term => rec.toLowerCase().trim() === term)
    );

    if (hasGenericRecs) {
      this.logger.warn(`[${correlationId}] LLM provided generic recommendations`, {
        agentId: this.id,
        recommendations: result.recommendations
      });
    }

    return { isValid: true };
  }
}

// Enhanced schema with more specific requirements
export const EnhancedRecommendationSchema = z.object({
  recommendations: z.array(z.string().min(5, "Specific wine name required")).min(1, "At least one recommendation required").max(5, "Maximum 5 recommendations allowed"),
  confidence: z.number().min(0.1, "Confidence must be at least 0.1").max(1.0, "Confidence cannot exceed 1.0"),
  reasoning: z.string().min(20, "Reasoning must be at least 20 characters"),
  pairingNotes: z.string().optional(),
  alternatives: z.array(z.string()).max(3, "Maximum 3 alternatives allowed").optional()
});

// Keep the original schema for backward compatibility
export const RecommendationSchema = z.object({
  recommendations: z.array(z.string()),
  confidence: z.number(),
  reasoning: z.string()
});