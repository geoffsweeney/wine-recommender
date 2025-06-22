import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';

interface Wine {
  id: string;
  name: string;
  region: string;
  price?: number;
  type: string;
}

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
      'recommendation-request',
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
      if (!payload?.input) {
        const error = new AgentError('Invalid message: missing payload.input', 'MISSING_PAYLOAD_INPUT', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }

      let recommendedWines: Wine[] = [];
      let recommendationType: 'ingredients' | 'preferences' = 'preferences';
      
      if (payload.input.ingredients && payload.input.ingredients.length > 0) {
        this.logger.info(`[${correlationId}] Handling ingredient-based request`, { agentId: this.id, operation: 'handleRecommendationRequest' });
        recommendedWines = await this.knowledgeGraphService.findWinesByIngredients(payload.input.ingredients);
        recommendationType = 'ingredients';
      } else if (payload.input.preferences) {
        this.logger.info(`[${correlationId}] Handling preference-based request`, { agentId: this.id, operation: 'handleRecommendationRequest' });
        recommendedWines = await this.knowledgeGraphService.findWinesByPreferences(payload.input.preferences);
      }

      if (!recommendedWines || recommendedWines.length === 0) {
        await this.handleNoWinesFound(message, recommendationType, correlationId);
        return { success: true, data: null }; // No wines found, but handled
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
        correlationId,
        message.sourceAgent
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
    const llmPrompt = `Based on the user's input (${recommendationType}) and the provided wine recommendations, provide an enhanced list of recommendations and a brief explanation...`;
    
    try {
      const llmResponseResult = await this.llmService.sendPrompt(llmPrompt);
      if (!llmResponseResult.success) {
        this.logger.warn(`[${correlationId}] LLM enhancement failed: ${llmResponseResult.error.message}`, { agentId: this.id, operation: 'enhanceRecommendations' });
        return { recommendedWines }; // Return original recommendations if LLM fails
      }

      const llmResponse = llmResponseResult.data;

      const enhancedRecommendations = JSON.parse(llmResponse);
      if (enhancedRecommendations &&
          Array.isArray(enhancedRecommendations.recommendedWines) &&
          typeof enhancedRecommendations.llmEnhancement === 'string') {
        return enhancedRecommendations;
      }
      this.logger.warn(`[${correlationId}] LLM returned invalid format for enhanced recommendations`, { agentId: this.id, operation: 'enhanceRecommendations', llmResponse });
      return { recommendedWines }; // Return original if LLM response format is invalid
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error enhancing recommendations: ${errorMessage}`, { agentId: this.id, operation: 'enhanceRecommendations', originalError: errorMessage });
      return { recommendedWines };
    }
  }

  private async handleNoWinesFound(message: AgentMessage<unknown>, recommendationType: string, correlationId: string) {
    const responseMessage = createAgentMessage(
      'recommendation-response',
      {
        recommendedWines: [],
        error: `No wines found matching ${recommendationType} criteria`
      },
      this.id,
      correlationId,
      message.sourceAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
    this.logger.info(`[${correlationId}] No wines found for request`, { agentId: this.id, operation: 'handleNoWinesFound' });
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
      correlationId,
      message.sourceAgent
    );
    this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
    this.logger.error(`[${correlationId}] Error in RecommendationAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
  }
}