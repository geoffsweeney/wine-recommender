import { inject, injectable } from 'tsyringe';
import winston from 'winston';
import { z } from 'zod';
import { TYPES } from '../../di/Types';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { LLMService } from '../../services/LLMService';
import { WineNode } from '../../types';
import { ExplanationConfidenceSchema, RecommendationResult } from '../../types/agent-outputs';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';

interface Wine extends WineNode {}

interface RecommendationMessagePayload {
  input: {
    ingredients?: string[];
    preferences?: any;
    message?: string;
    priceRange?: { min?: number; max?: number };
    occasion?: string;
    wineStyle?: string[];
    bodyPreference?: 'light' | 'medium' | 'full';
    sweetness?: 'dry' | 'off-dry' | 'medium-dry' | 'medium-sweet' | 'sweet';
    wineCharacteristics?: { [key: string]: string[] }; // Added wineCharacteristics
  };
  conversationHistory?: { role: string; content: string }[];
  userId?: string;
  message?: string;
  requestId?: string;
  strategy?: 'knowledge_graph_first' | 'llm_first' | 'hybrid';
}

export interface RecommendationAgentConfig {
  defaultRecommendationCount: number;
  knowledgeGraphEnabled: boolean;
  hybridMode: boolean;
  fallbackToLLM: boolean;
  confidenceThreshold: number;
}

@injectable()
export class RecommendationAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.RecommendationAgentConfig) private readonly agentConfig: RecommendationAgentConfig
  ) {
    const id = 'recommendation-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: agentConfig as any
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] RecommendationAgent initialized`, { 
      agentId: this.id, 
      operation: 'initialization',
      config: {
        knowledgeGraphEnabled: agentConfig.knowledgeGraphEnabled,
        hybridMode: agentConfig.hybridMode,
        fallbackToLLM: agentConfig.fallbackToLLM
      }
    });
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
      'knowledge-graph-integration',
      'hybrid-recommendation',
      'contextual-recommendation'
    ];
  }

  public async handleMessage(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    switch (message.type) {
      case 'recommendation-request':
      case MessageTypes.GENERATE_RECOMMENDATIONS:
      case MessageTypes.REFINE_RECOMMENDATIONS:
        return this.handleRecommendationRequest(message as AgentMessage<RecommendationMessagePayload>);
      case 'preference-response':
      case 'preference-update-result':
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
            false,
            { messageType: message.type }
          )
        };
    }
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    
    // Register all supported message types
    const messageTypes = [
      'recommendation-request',
      MessageTypes.GENERATE_RECOMMENDATIONS,
      MessageTypes.REFINE_RECOMMENDATIONS
    ];

    messageTypes.forEach(messageType => {
      this.communicationBus.registerMessageHandler(
        this.id,
        messageType,
        this.handleRecommendationRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
      );
    });

    // Handle preference updates
    ['preference-response', 'preference-update-result'].forEach(messageType => {
      this.communicationBus.registerMessageHandler(
        this.id,
        messageType,
        this.handlePreferenceUpdate.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
      );
    });
  }

  private async handlePreferenceUpdate(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.debug(`[${correlationId}] Received preference update`, { 
      agentId: this.id, 
      operation: 'handlePreferenceUpdate' 
    });
    
    const payload = message.payload as { success: boolean; error?: string; };

    if (payload.success === false) {
      this.logger.warn(`[${correlationId}] Preference update failed: ${payload.error}`, { 
        agentId: this.id, 
        operation: 'handlePreferenceUpdate' 
      });
      return { 
        success: false, 
        error: new AgentError(`Preference update failed: ${payload.error}`, 'PREFERENCE_UPDATE_FAILED', this.id, correlationId) 
      };
    }

    this.logger.info(`[${correlationId}] Processing updated preferences`, { 
      agentId: this.id, 
      operation: 'handlePreferenceUpdate' 
    });
    return { success: true, data: null };
  }

  private async handleRecommendationRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Processing recommendation request`, { 
      agentId: this.id, 
      operation: 'handleRecommendationRequest' 
    });

    try {
      const payload = message.payload as RecommendationMessagePayload;
      
      if (!payload?.input) {
        const error = new AgentError('Invalid message: missing payload.input', 'MISSING_PAYLOAD_INPUT', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { 
          source: this.id, 
          stage: 'recommendation-validation', 
          correlationId 
        });
        return { success: false, error };
      }

      const strategy = this.determineRecommendationStrategy(payload);
      this.logger.debug(`[${correlationId}] Recommendation strategy determined: ${strategy}`, {
        agentId: this.id,
        operation: 'handleRecommendationRequest',
        strategy
      });

      let recommendationResult: RecommendationResult | null = null;

      // Always use LLM for core recommendations as per new strategy
      recommendationResult = await this.getLLMRecommendation(payload, correlationId, message.conversationId);

      if (!recommendationResult) {
        return await this.handleNoRecommendations(message, correlationId);
      }

      // Implement iterative self-improvement if confidence is below threshold
      if (recommendationResult.confidence < this.agentConfig.confidenceThreshold) {
        this.logger.info(`[${correlationId}] Initial recommendation confidence (${recommendationResult.confidence}) below threshold (${this.agentConfig.confidenceThreshold}). Attempting refinement.`, {
          agentId: this.id,
          operation: 'handleRecommendationRequest'
        });
        recommendationResult = await this.refineRecommendations(recommendationResult, payload, correlationId);
      }

      // Send successful response
      const responseMessage = createAgentMessage(
        'recommendation-response',
        recommendationResult,
        this.id,
        message.conversationId,
        correlationId,
        message.sourceAgent
      );

      
      this.logger.info(`[${message.correlationId}] Recommendation request processed successfully`, { // Use message.correlationId here
        agentId: this.id,
        operation: 'handleRecommendationRequest',
        recommendationCount: recommendationResult.recommendations?.length || 0,
        confidence: recommendationResult.confidence,
        strategy
      });

      return { success: true, data: responseMessage };

    } catch (error: unknown) {
      return await this.handleRequestError(message, error, correlationId);
    }
  }

  private determineRecommendationStrategy(payload: RecommendationMessagePayload): 'knowledge_graph_first' | 'llm_first' | 'hybrid' {
    // As per the new strategy, always use LLM for core recommendations.
    // Explicit strategy from payload still takes precedence.
    if (payload.strategy) {
      return payload.strategy;
    }
    return 'llm_first';
  }

  private async getLLMRecommendation(payload: RecommendationMessagePayload, parentCorrelationId: string, conversationId: string): Promise<RecommendationResult | null> {
    this.logger.info(`[${parentCorrelationId}] Requesting LLM recommendation`, {
      agentId: this.id, 
      operation: 'getLLMRecommendation' 
    });

    const llmRequestPayload = {
      message: payload.input.message || payload.message,
      ingredients: payload.input.ingredients,
      preferences: {
        ...payload.input.preferences,
        ...payload.input.wineCharacteristics // Include wineCharacteristics from PreferenceExtractionResultPayload
      },
      priceRange: payload.input.priceRange,
      occasion: payload.input.occasion,
      wineStyle: payload.input.wineStyle,
      bodyPreference: payload.input.bodyPreference,
      sweetness: payload.input.sweetness,
      conversationHistory: payload.conversationHistory || [],
      recommendationSource: 'llm' as const
    };

    const llmRequestMessage = createAgentMessage(
      'llm-recommendation-request',
      llmRequestPayload,
      this.id, // sourceAgent
      conversationId, // conversationId
      this.generateCorrelationId(), // NEW correlationId for this specific request
      'llm-recommendation-agent', // targetAgent
      undefined, // userId (optional, not used here)
      'NORMAL', // priority (default)
      { parentCorrelationId } // metadata
    );

    try {
      const llmResponseResult = await this.communicationBus.sendMessageAndWaitForResponse<{
        recommendation: RecommendationResult;
        confidenceScore: number;
      }>(
        'llm-recommendation-agent',
        llmRequestMessage
      );

      if (!llmResponseResult.success || !llmResponseResult.data?.payload) {
        this.logger.warn(`[${parentCorrelationId}] LLM recommendation failed`, { // Use parentCorrelationId here
          agentId: this.id,
          operation: 'getLLMRecommendation',
          error: llmResponseResult.success ? undefined : llmResponseResult.error?.message
        });
        return null;
      }

      const llmPayload = llmResponseResult.data.payload;
      
      // Transform LLM response to match RecommendationResult format
      if (llmPayload.recommendation) {
        return {
          recommendations: llmPayload.recommendation.recommendations || [],
          reasoning: llmPayload.recommendation.reasoning || '',
          confidence: llmPayload.recommendation.confidence || llmPayload.confidenceScore || 0.5,
          pairingNotes: llmPayload.recommendation.pairingNotes,
          alternatives: llmPayload.recommendation.alternatives
        };
      }

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${parentCorrelationId}] Error getting LLM recommendation: ${errorMessage}`, { // Use parentCorrelationId here
        agentId: this.id,
        operation: 'getLLMRecommendation',
        originalError: errorMessage
      });
      return null;
    }
  }

  private async getKnowledgeGraphRecommendation(payload: RecommendationMessagePayload, correlationId: string): Promise<RecommendationResult | null> {
    this.logger.info(`[${correlationId}] Knowledge graph recommendation is currently bypassed for core matching.`, { 
      agentId: this.id, 
      operation: 'getKnowledgeGraphRecommendation' 
    });
    // Return null or an empty recommendation as it's not part of the primary flow
    return null;
  }

  private async getHybridRecommendation(payload: RecommendationMessagePayload, correlationId: string, conversationId: string): Promise<RecommendationResult | null> {
    this.logger.info(`[${correlationId}] Using hybrid recommendation approach`, { 
      agentId: this.id, 
      operation: 'getHybridRecommendation' 
    });

    // Get both recommendations in parallel
    const [llmResult, kgResult] = await Promise.allSettled([
      this.getLLMRecommendation(payload, correlationId, conversationId), // Pass original correlationId as parentCorrelationId
      this.getKnowledgeGraphRecommendation(payload, correlationId)
    ]);

    const llmRecommendation = llmResult.status === 'fulfilled' ? llmResult.value : null;
    const kgRecommendation = kgResult.status === 'fulfilled' ? kgResult.value : null;

    // If both failed, return null
    if (!llmRecommendation && !kgRecommendation) {
      this.logger.warn(`[${correlationId}] Both LLM and knowledge graph recommendations failed`, { 
        agentId: this.id, 
        operation: 'getHybridRecommendation' 
      });
      return null;
    }

    // Use the one with higher confidence, or LLM if confidence is similar
    if (llmRecommendation && kgRecommendation) {
      const confidenceDiff = Math.abs((llmRecommendation.confidence || 0) - (kgRecommendation.confidence || 0));
      
      if (confidenceDiff < 0.1) {
        // Similar confidence, prefer LLM for better explanations
        this.logger.debug(`[${correlationId}] Similar confidence, preferring LLM recommendation`, { 
          agentId: this.id, 
          operation: 'getHybridRecommendation',
          llmConfidence: llmRecommendation.confidence,
          kgConfidence: kgRecommendation.confidence 
        });
        return llmRecommendation;
      } else if ((llmRecommendation.confidence || 0) > (kgRecommendation.confidence || 0)) {
        return llmRecommendation;
      } else {
        return kgRecommendation;
      }
    }

    // Return whichever one succeeded
    return llmRecommendation || kgRecommendation;
  }

  private async enhanceKnowledgeGraphResults(wineNames: string[], payload: RecommendationMessagePayload, correlationId: string): Promise<{ explanation: string; confidence: number }> {
    const wineList = wineNames.map(name => `- ${name}`).join('\n');
    const contextInfo = this.buildContextForEnhancement(payload);
    
    try {
      const enhancementResult = await this.llmService.sendStructuredPrompt<
        'enhanceKnowledgeGraph', // New prompt task name
        z.infer<typeof ExplanationConfidenceSchema>
      >(
        'enhanceKnowledgeGraph', // New prompt task name
        {
          wineList: wineList,
          contextInfo: contextInfo
        },
        { correlationId: correlationId } // Pass logContext
      );
 
      if (enhancementResult.success && enhancementResult.data) {
        return enhancementResult.data;
      }
    } catch (error) {
      this.logger.debug(`[${correlationId}] Failed to enhance knowledge graph results with LLM`, { 
        agentId: this.id, 
        operation: 'enhanceKnowledgeGraphResults' 
      });
    }
 
    // Fallback enhancement
    return {
      explanation: `These wines were selected from our database based on your ${payload.input.ingredients ? 'ingredient preferences' : 'stated preferences'}.`,
      confidence: 0.6
    };
  }
 
  private buildContextForEnhancement(payload: RecommendationMessagePayload): string {
    const parts: string[] = [];
    
    if (payload.input.message) {
      parts.push(`User request: "${payload.input.message}"`);
    }
    
    if (payload.input.ingredients?.length) {
      parts.push(`Ingredients: ${payload.input.ingredients.join(', ')}`);
    }
    
    if (payload.input.preferences && Object.keys(payload.input.preferences).length > 0) {
      parts.push(`Preferences: ${JSON.stringify(payload.input.preferences)}`);
    }
    
    return parts.join('. ') || 'General wine recommendation request';
  }
 
  protected async handleNoRecommendations(message: AgentMessage<unknown>, correlationId: string): Promise<Result<AgentMessage | null, AgentError>> {
    const responsePayload = {
      recommendations: [],
      reasoning: 'Sorry, no suitable wine recommendations could be generated for your request.',
      confidence: 0.0,
      error: 'No recommendations could be generated'
    };

    const responseMessage = createAgentMessage(
      'recommendation-response',
      responsePayload,
      this.id, // sourceAgent
      message.conversationId,
      correlationId,
      message.sourceAgent // targetAgent
    );

    // Send the response to the source agent
    this.communicationBus.sendResponse( // Removed await and sendResult check
      message.sourceAgent,
      responseMessage
    );

    // Cast message.payload to RecommendationMessagePayload for safe access
    const requestPayload = message.payload as RecommendationMessagePayload;

    // Log a warning with the expected message
    this.logger.warn(
      `[${correlationId}] No recommendations could be generated`,
      { userId: requestPayload.userId, input: requestPayload.input } // Access properties safely
    );

    return { success: true, data: responseMessage };
  }
 
  private async handleRequestError(message: AgentMessage<unknown>, error: unknown, correlationId: string): Promise<Result<AgentMessage | null, AgentError>> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const agentError = error instanceof AgentError ? error : new AgentError(
      errorMessage, 
      'RECOMMENDATION_PROCESSING_ERROR', 
      this.id, 
      correlationId, 
      true, 
      { originalError: errorMessage }
    );
 
    await this.deadLetterProcessor.process(message.payload, agentError, { 
      source: this.id, 
      stage: 'RecommendationProcessing', 
      correlationId 
    });
 
    this.logger.error(`[${message.correlationId}] Error processing recommendation request: ${errorMessage}`, { // Use message.correlationId here
      agentId: this.id,
      operation: 'handleRecommendationRequest',
      originalError: errorMessage
    });
 
    return { success: false, error: agentError };
  }
  private async refineRecommendations(
    currentRecommendations: RecommendationResult,
    payload: RecommendationMessagePayload,
    correlationId: string
  ): Promise<RecommendationResult> {
    this.logger.info(`[${correlationId}] Attempting to refine recommendations`, {
      agentId: this.id,
      operation: 'refineRecommendations'
    });

    try {
      const llmVariables = {
        currentRecommendations: currentRecommendations.recommendations,
        reasoning: currentRecommendations.reasoning,
        userInput: payload.input.message,
        conversationHistory: payload.conversationHistory,
        preferences: payload.input.preferences,
        ingredients: payload.input.ingredients
      };

      const refinementResult = await this.llmService.sendStructuredPrompt<
        'refineSuggestions', // Corrected prompt task name
        RecommendationResult
      >(
        'refineSuggestions', // Corrected prompt task name
        llmVariables,
        { correlationId: correlationId } // Pass logContext
      );

      if (refinementResult.success) {
        this.logger.info(`[${correlationId}] Recommendations refined successfully`, {
          agentId: this.id,
          operation: 'refineRecommendations'
        });
        return refinementResult.data;
      } else {
        const errorMessage = refinementResult.error?.message || 'Unknown error';
        this.logger.warn(`[${correlationId}] Failed to refine recommendations: ${errorMessage}`, {
          agentId: this.id,
          operation: 'refineRecommendations',
          error: errorMessage
        });
        return currentRecommendations; // Return original if refinement fails
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error during recommendation refinement: ${errorMessage}`, {
        agentId: this.id,
        operation: 'refineRecommendations',
        originalError: errorMessage
      });
      return currentRecommendations; // Return original on error
    }
  }
  
}
