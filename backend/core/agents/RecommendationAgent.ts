import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';
import { z } from 'zod';
import { WineNode } from '../../types';

interface Wine extends WineNode {}

interface RecommendationMessagePayload {
  input: {
    ingredients?: string[];
    preferences?: any;
  };
  conversationHistory?: { role: string; content: string }[];
  userId?: string;
}

// Define the configuration interface for RecommendationAgent
export interface RecommendationAgentConfig {
  defaultRecommendationCount: number;
}

@injectable()
export class RecommendationAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.RecommendationAgentConfig) private readonly agentConfig: RecommendationAgentConfig // Inject agent config
  ) {
    const id = 'recommendation-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] RecommendationAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'RecommendationAgent';
  }

  getCapabilities(): string[] {
    return [
      'wine-recommendation',
      'ingredient-matching',
      'preference-matching',
      'llm-enhancement',
      'knowledge-graph-integration'
    ];
  }

  public async handleMessage(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    switch (message.type) {
      case 'recommendation-request':
        return this.handleRecommendationRequest(message as AgentMessage<RecommendationMessagePayload>);
      case 'preference-response': // Handle old preference update format
      case 'preference-update-result': // Handle new preference update format
        return this.handlePreferenceUpdate(message);
      default:
        this.logger.warn(`[${correlationId}] RecommendationAgent received unhandled message type: ${message.type}`, {
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
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.GENERATE_RECOMMENDATIONS, // Use MessageTypes.GENERATE_RECOMMENDATIONS
      this.handleRecommendationRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.REFINE_RECOMMENDATIONS, // Use MessageTypes.REFINE_RECOMMENDATIONS
      this.handleRecommendationRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );

    // Handle both old and new preference update formats
    this.communicationBus.registerMessageHandler(
      this.id,
      'preference-response',
      this.handlePreferenceUpdate.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      'preference-update-result',
      this.handlePreferenceUpdate.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handlePreferenceUpdate(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.debug(`[${correlationId}] Received preference update`, { agentId: this.id, operation: 'handlePreferenceUpdate' });
    
    const payload = message.payload as { success: boolean; error?: string; }; // Assuming payload has success and error

    if (payload.success === false) {
      this.logger.warn(`[${correlationId}] Preference update failed: ${payload.error}`, { agentId: this.id, operation: 'handlePreferenceUpdate' });
      return { success: false, error: new AgentError(`Preference update failed: ${payload.error}`, 'PREFERENCE_UPDATE_FAILED', this.id, correlationId) };
    }

    // Process preferences as before
    this.logger.info(`[${correlationId}] Processing updated preferences`, { agentId: this.id, operation: 'handlePreferenceUpdate' });
    return { success: true, data: null }; // Indicate successful handling of the update
  }

  private async handleRecommendationRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] RecommendationAgent.handleRecommendationRequest entered`, { agentId: this.id, operation: 'handleRecommendationRequest' });

    try {
      const payload = message.payload as RecommendationMessagePayload;
      this.logger.debug(`[${correlationId}] RecommendationAgent received payload: ${JSON.stringify(payload)}`, { agentId: this.id, operation: 'handleRecommendationRequest' });
      if (!payload?.input) {
        const error = new AgentError('Invalid message: missing payload.input', 'MISSING_PAYLOAD_INPUT', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }

      let recommendedWines: Wine[] = [];
      let recommendationType: 'ingredients' | 'preferences' = 'preferences';
      
      if (payload.input.ingredients && payload.input.ingredients.length > 0) {
        this.logger.info(`[${correlationId}] Handling ingredient-based request`, { agentId: this.id, operation: 'handleRecommendationRequest' });
        this.logger.debug(`[${correlationId}] Searching wines by ingredients: ${JSON.stringify(payload.input.ingredients)}`, { agentId: this.id, operation: 'findWinesByIngredients' });
        recommendedWines = await this.knowledgeGraphService.findWinesByIngredients(payload.input.ingredients);
        this.logger.debug(`[${correlationId}] Wines found by ingredients: ${JSON.stringify(recommendedWines)}`, { agentId: this.id, operation: 'findWinesByIngredients' });
        recommendationType = 'ingredients';
      } else if (payload.input.preferences) {
        this.logger.info(`[${correlationId}] Handling preference-based request`, { agentId: this.id, operation: 'handleRecommendationRequest' });
        this.logger.debug(`[${correlationId}] Searching wines by preferences: ${JSON.stringify(payload.input.preferences)}`, { agentId: this.id, operation: 'findWinesByPreferences' });
        recommendedWines = await this.knowledgeGraphService.findWinesByPreferences(payload.input.preferences);
        this.logger.debug(`[${correlationId}] Wines found by preferences: ${JSON.stringify(recommendedWines)}`, { agentId: this.id, operation: 'findWinesByPreferences' });
      }

      if (!recommendedWines || recommendedWines.length === 0) {
        this.logger.info(`[${correlationId}] No wines found in KnowledgeGraphService. Generating fallback recommendation.`, { agentId: this.id, operation: 'handleRecommendationRequest' });
        const fallbackRecommendations = await this.generateFallbackRecommendation(payload, correlationId);
        if (fallbackRecommendations) {
          const responseMessage = createAgentMessage(
            'recommendation-response',
            fallbackRecommendations,
            this.id,
            message.conversationId,
            correlationId,
            message.sourceAgent
          );
          this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
          this.logger.info(`[${correlationId}] Fallback recommendation processed successfully`, { agentId: this.id, operation: 'handleRecommendationRequest' });
          return { success: true, data: responseMessage };
        } else {
          await this.handleNoWinesFound(message, recommendationType, correlationId);
          return { success: true, data: null }; // No wines found, and fallback also failed
        }
      }

      const enhancedRecommendations = await this.enhanceRecommendations(
        recommendedWines,
        payload,
        recommendationType,
        correlationId
      );

      const responseMessage = createAgentMessage(
        'recommendation-response',
        enhancedRecommendations,
        this.id,
        message.conversationId, // Corrected: conversationId
        correlationId, // Corrected: correlationId
        message.sourceAgent // Corrected: targetAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
      this.logger.info(`[${correlationId}] Recommendation request processed successfully`, { agentId: this.id, operation: 'handleRecommendationRequest' });
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'RECOMMENDATION_PROCESSING_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'RecommendationProcessing', correlationId });
      this.logger.error(`[${correlationId}] Error processing recommendation request: ${errorMessage}`, { agentId: this.id, operation: 'handleRecommendationRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private async enhanceRecommendations(recommendedWines: Wine[], payload: RecommendationMessagePayload, recommendationType: string, correlationId: string) {
    const wineList = recommendedWines.map(wine => `- ${wine.name} (Type: ${wine.type}, Region: ${wine.region}, Price: $${wine.price || 'N/A'})`).join('\n');
    const llmPrompt = `Based on the user's input (${recommendationType}) and the following EXACT list of wines available in our database:\n${wineList}\n\nYour task is to provide an enhanced list of recommendations and a brief explanation. CRITICAL: You MUST ONLY recommend wines that are PRESENT in the provided "available_wines" list. Do NOT invent new wines. The output must be a JSON object with 'recommendedWines' (an array of wine objects, each with 'id', 'name', 'region', 'price', 'type' fields) and 'llmEnhancement' (a string explanation).`;

    const enhancedRecommendationsSchema = z.object({
      recommendedWines: z.array(z.object({
        id: z.string(),
        name: z.string(),
        region: z.string(),
        price: z.number().optional(),
        type: z.string(),
      })),
      llmEnhancement: z.string(),
    });
    
    try {
      const llmResponseResult = await this.llmService.sendStructuredPrompt<{ recommendedWines: Wine[], llmEnhancement: string }>(llmPrompt, enhancedRecommendationsSchema, enhancedRecommendationsSchema, correlationId);
      if (!llmResponseResult.success) {
        this.logger.warn(`[${correlationId}] LLM enhancement failed: ${llmResponseResult.error.message}`, { agentId: this.id, operation: 'enhanceRecommendations' });
        return { recommendedWines }; // Return original recommendations if LLM fails
      }

      const enhancedRecommendations = llmResponseResult.data;

      if (enhancedRecommendations &&
          Array.isArray(enhancedRecommendations.recommendedWines) &&
          typeof enhancedRecommendations.llmEnhancement === 'string') {
        return enhancedRecommendations;
      }
      this.logger.warn(`[${correlationId}] LLM returned invalid format for enhanced recommendations`, { agentId: this.id, operation: 'enhanceRecommendations', llmResponse: enhancedRecommendations });
      return { recommendedWines }; // Return original if LLM response format is invalid
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error enhancing recommendations: ${errorMessage}`, { agentId: this.id, operation: 'enhanceRecommendations', originalError: errorMessage });
      return { recommendedWines };
    }
  }

  private async generateFallbackRecommendation(payload: RecommendationMessagePayload, correlationId: string): Promise<{ recommendedWines: Wine[], llmEnhancement: string } | null> {
    const llmPrompt = `Based on the user's input (ingredients: ${JSON.stringify(payload.input.ingredients)}, preferences: ${JSON.stringify(payload.input.preferences)}), provide a general wine recommendation and a brief explanation. Do NOT assume any specific wines are available in a database. Focus on general knowledge. The output must be a JSON object with 'recommendedWines' (an array of wine objects) and 'llmEnhancement' (a string explanation).`;

    const fallbackRecommendationSchema = z.object({
      recommendedWines: z.array(z.object({
        id: z.string(),
        name: z.string(),
        region: z.string(),
        price: z.number().optional(),
        type: z.string(),
      })),
      llmEnhancement: z.string(),
    });

    try {
      const llmResponseResult = await this.llmService.sendStructuredPrompt<{ recommendedWines: Wine[], llmEnhancement: string }>(llmPrompt, fallbackRecommendationSchema, fallbackRecommendationSchema, correlationId);
      if (!llmResponseResult.success) {
        this.logger.warn(`[${correlationId}] LLM fallback recommendation failed: ${llmResponseResult.error.message}`, { agentId: this.id, operation: 'generateFallbackRecommendation' });
        return null;
      }

      const fallbackRecommendations = llmResponseResult.data;

      if (fallbackRecommendations &&
          Array.isArray(fallbackRecommendations.recommendedWines) &&
          typeof fallbackRecommendations.llmEnhancement === 'string') {
        return fallbackRecommendations;
      }
      this.logger.warn(`[${correlationId}] LLM returned invalid format for fallback recommendations`, { agentId: this.id, operation: 'generateFallbackRecommendation', llmResponse: fallbackRecommendations });
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error generating fallback recommendations: ${errorMessage}`, { agentId: this.id, operation: 'generateFallbackRecommendation', originalError: errorMessage });
      return null;
    }
  }

  private async handleNoWinesFound(message: AgentMessage<unknown>, recommendationType: string, correlationId: string) {
    const responseMessage = createAgentMessage(
      'recommendation-response',
      {
        recommendedWines: [],
        error: `No wines found matching ${recommendationType} criteria and no fallback could be generated.`
      },
      this.id,
      message.conversationId,
      correlationId,
      message.sourceAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
    this.logger.info(`[${correlationId}] No wines found for request and no fallback`, { agentId: this.id, operation: 'handleNoWinesFound' });
  }

  private async handleError(message: AgentMessage<unknown>, error: AgentError, correlationId: string) {
    await this.deadLetterProcessor.process(
      message.payload,
      error,
      { source: this.id, stage: 'RecommendationProcessing', correlationId }
    );

    const errorMessage = createAgentMessage(
      'error-response',
      {
        error: error.message,
        code: error.code,
        userId: message.userId ?? 'unknown_user' // Provide a fallback for userId
      },
      this.id,
      message.conversationId, // Corrected: conversationId
      correlationId, // Corrected: correlationId
      message.sourceAgent // Corrected: targetAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
    this.logger.error(`[${correlationId}] Error in RecommendationAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
  }
}