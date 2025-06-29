import { inject, injectable } from 'tsyringe';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { PreferenceExtractionService } from '../../services/PreferenceExtractionService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService';
import { PreferenceNode } from '../../types';
import { TYPES } from '../../di/Types';
import { ConversationTurn } from '../ConversationHistoryService';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import winston from 'winston';
import { PreferenceExtractionResultPayload } from '../../types/agent-outputs'; // Import the new payload type

interface PreferenceMessagePayload {
  input: string;
  conversationHistory?: ConversationTurn[];
  userId: string; // Make userId required
  initialPreferences?: PreferenceNode[];
}

// Define the configuration interface for UserPreferenceAgent
export interface UserPreferenceAgentConfig {
  defaultConfidenceThreshold: number;
}

@injectable()
export class UserPreferenceAgent extends CommunicatingAgent {
  constructor(
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.PreferenceExtractionService) private readonly preferenceExtractionService: PreferenceExtractionService,
    @inject(TYPES.PreferenceNormalizationService) private readonly preferenceNormalizationService: PreferenceNormalizationService,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger, // Inject logger
    @inject(TYPES.UserPreferenceAgentConfig) private readonly agentConfig: UserPreferenceAgentConfig // Inject agent config
  ) {
    const id = 'user-preference-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers(); // Corrected method name
    this.logger.info(`[${this.id}] UserPreferenceAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'UserPreferenceAgent';
  }

  public getCapabilities(): string[] {
    return [
      'preference-extraction',
      'preference-normalization',
      'preference-persistence',
      'fast-extraction',
      'async-llm-extraction',
      'preference-broadcasting'
    ];
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    switch (message.type) {
      case MessageTypes.GET_PREFERENCES:
        return this.handlePreferenceRequest(message as AgentMessage<PreferenceMessagePayload>);
      case MessageTypes.PREFERENCE_UPDATE:
        return this.handlePreferenceUpdate(message as AgentMessage<{ preferences: PreferenceNode[]; context: string; }>);
      case MessageTypes.UPDATE_RECOMMENDATION_HISTORY:
        return this.handleUpdateRecommendationHistory(message as AgentMessage<any>);
      default:
        this.logger.warn(`[${correlationId}] UserPreferenceAgent received unhandled message type: ${message.type}`, {
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
      MessageTypes.GET_PREFERENCES,
      this.handlePreferenceRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.PREFERENCE_UPDATE,
      this.handlePreferenceUpdate.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.UPDATE_RECOMMENDATION_HISTORY,
      this.handleUpdateRecommendationHistory.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handlePreferenceRequest(message: AgentMessage<{ input: string; userId: string; conversationHistory?: ConversationTurn[]; initialPreferences?: PreferenceNode[]; }>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling preference request`, { agentId: this.id, operation: 'handlePreferenceRequest' });

    try {
      const { input, conversationHistory, userId, initialPreferences } = message.payload;
      if (!input || typeof input !== 'string') { // Basic validation
        const error = new AgentError('Invalid or missing payload in preference request', 'INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'preference-validation', correlationId });
        return { success: false, error };
      }
      
      const currentUserId = userId; // userId is now required

      let persistedPreferences: PreferenceNode[] = [];
      if (initialPreferences) {
        persistedPreferences = initialPreferences;
      } else if (currentUserId) {
      }

      const fastPreferencesResult = await this.preferenceExtractionService.attemptFastExtraction(input);
      this.logger.info(`[${correlationId}] UserPreferenceAgent fastPreferencesResult: ${JSON.stringify(fastPreferencesResult)}`, { agentId: this.id, operation: 'handlePreferenceRequest' });

      // Check if fastPreferencesResult is not null and is successful
      if (fastPreferencesResult) { // Add this check
        this.logger.info(`[${correlationId}] UserPreferenceAgent fastPreferencesResult.success: ${fastPreferencesResult.success}`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        this.logger.info(`[${correlationId}] UserPreferenceAgent fastPreferencesResult.data: ${fastPreferencesResult.success ? !!fastPreferencesResult.data : 'N/A'}`, { agentId: this.id, operation: 'handlePreferenceRequest' });
      }
      if (fastPreferencesResult.success && fastPreferencesResult.data) { // Simplified condition
        const fastPreferences = fastPreferencesResult.data;
        this.logger.debug(`[${correlationId}] UserPreferenceAgent fastPreferences: ${JSON.stringify(fastPreferences)}`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        const extractedPreferences = Object.entries(fastPreferences).map(([type, value]) => {
          this.logger.debug(`[${correlationId}] Mapping preference - type: ${type}, value: ${value}`, { agentId: this.id, operation: 'handlePreferenceRequest' });
          return {
            type,
            value: this.mapPreferenceValue(type, value), // Use helper to map value to appropriate type
            source: 'fast-extraction',
            confidence: 1,
            timestamp: new Date().toISOString(),
            active: true
          };
        });
        this.logger.debug(`[${correlationId}] UserPreferenceAgent extractedPreferences: ${JSON.stringify(extractedPreferences)}`, { agentId: this.id, operation: 'handlePreferenceRequest' });

        const normalizedExtractedPreferences =
          await this.preferenceNormalizationService.normalizePreferences(extractedPreferences);
        
        
        const mergedPreferences = this.mergePreferences(
          persistedPreferences,
          normalizedExtractedPreferences
        );

        // Broadcast updated preferences to all interested agents
        const broadcastMessage = createAgentMessage(
          MessageTypes.PREFERENCE_UPDATE, // Use the new message type
          {
            userId: currentUserId,
            preferences: mergedPreferences,
            context: 'from-preference-agent' // More specific context
          },
          this.id,
          message.conversationId, // conversationId
          this.generateCorrelationId(), // Generate a new correlationId for this broadcast
          '*', // Broadcast to all
          message.userId // userId
        );
        this.broadcast(broadcastMessage.type, broadcastMessage.payload, broadcastMessage.correlationId);

        const responseMessage = createAgentMessage(
          'preference-update-result',
          {
            success: true,
            preferences: mergedPreferences
          },
          this.id,
          message.conversationId, // conversationId
          message.correlationId, // correlationId
          message.sourceAgent, // targetAgent
          message.userId // userId
        );
        this.logger.info(`[${correlationId}] Preference request processed successfully (fast extraction)`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        return { success: true, data: responseMessage };
      } else {
        // If fast extraction fails or returns no data, perform LLM extraction directly
        this.logger.info(`[${correlationId}] Fast extraction failed or returned no data. Attempting LLM extraction.`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        const llmExtractionResult = await this.preferenceExtractionService.extractPreferencesWithLLM(input, conversationHistory, userId, correlationId);

        if (!llmExtractionResult.success) {
          const error = new AgentError(
            `LLM preference extraction failed: ${llmExtractionResult.error?.message}`,
            'LLM_EXTRACTION_FAILED',
            this.id,
            correlationId,
            true,
            { originalError: llmExtractionResult.error?.message }
          );
          await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'llm-extraction-failure', correlationId });
          return { success: false, error };
        }

        const llmExtractedData = llmExtractionResult.data;
        const extractedPreferences: PreferenceNode[] = [];

        // Process preferences from llmExtractedData.preferences
        if (llmExtractedData.preferences) {
          for (const key in llmExtractedData.preferences) {
            if (Object.prototype.hasOwnProperty.call(llmExtractedData.preferences, key)) {
              const rawValue = (llmExtractedData.preferences as any)[key];

              // Skip empty strings for style and color
              if ((key === 'style' || key === 'color') && typeof rawValue === 'string' && rawValue.trim() === '') {
                continue;
              }

              // Skip [0,0] for priceRange
              if (key === 'priceRange' && Array.isArray(rawValue) && rawValue.length === 2 && rawValue[0] === 0 && rawValue[1] === 0) {
                continue;
              }

              // Skip ingredients if it's an empty array or if we prefer the top-level ingredients
              // Assuming top-level ingredients is the canonical source for ingredients
              if (key === 'ingredients' && Array.isArray(rawValue) && rawValue.length === 0) {
                continue;
              }

              // Add other preferences
              extractedPreferences.push({
                type: key,
                value: this.mapPreferenceValue(key, rawValue), // Use helper to map value to appropriate type
                source: 'llm-extraction',
                confidence: 0.8,
                timestamp: new Date().toISOString(),
                active: true
              });
            }
          }
        }

        // Process top-level ingredients separately to avoid duplication and ensure it's handled
        if (llmExtractedData.ingredients && llmExtractedData.ingredients.length > 0) {
          // Check if 'ingredients' was already added from 'preferences' and if its value is the same
          const newIngredientValue = llmExtractedData.ingredients.join(',');
          const existingIngredientPref = extractedPreferences.find(p => p.type === 'ingredients' && p.value === newIngredientValue);

          if (!existingIngredientPref) { // Only add if not already present with the same value
            extractedPreferences.push({
              type: 'ingredients',
              value: newIngredientValue,
              source: 'llm-extraction',
              confidence: 0.8,
              timestamp: new Date().toISOString(),
              active: true
            });
          }
        }

        const normalizedExtractedPreferences = await this.preferenceNormalizationService.normalizePreferences(extractedPreferences);
        const mergedPreferences = this.mergePreferences(persistedPreferences, normalizedExtractedPreferences);

        const responseMessage = createAgentMessage(
          'preference-update-result',
          {
            success: true,
            preferences: mergedPreferences
          },
          this.id,
          message.conversationId,
          message.correlationId,
          message.sourceAgent,
          message.userId
        );
        this.logger.info(`[${correlationId}] Preference request processed successfully (LLM extraction)`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        return { success: true, data: responseMessage };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'PREFERENCE_PROCESSING_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'PreferenceProcessing', correlationId });
      this.logger.error(`[${correlationId}] Error processing preference request: ${errorMessage}`, { agentId: this.id, operation: 'handlePreferenceRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private mergePreferences(existing: PreferenceNode[], incoming: PreferenceNode[]): PreferenceNode[] {
    const merged: { [key: string]: PreferenceNode } = {};
    existing.forEach(pref => merged[pref.type] = pref);
    incoming.forEach(pref => merged[pref.type] = pref);
    return Object.values(merged);
  }

  private async handlePreferenceUpdate(message: AgentMessage<{ preferences: PreferenceNode[]; context: string; }>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling preference update`, { agentId: this.id, operation: 'handlePreferenceUpdate' });

    try {
      const { preferences } = message.payload;
      const userId = message.userId; // Get userId from the message itself
      if (!preferences || !Array.isArray(preferences)) {
        const error = new AgentError('Invalid or missing preferences in update payload', 'INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'preference-update-validation', correlationId });
        return { success: false, error };
      }

      // Preferences are no longer persisted in Neo4j.
      // The preference data is now handled in-memory or by other agents.
      this.logger.info(`[${correlationId}] User preferences received for update. Persistence to Neo4j is disabled.`, { agentId: this.id, operation: 'handlePreferenceUpdate' });

      // No acknowledgment needed as preferences are no longer persisted to Neo4j.
      return { success: true, data: null }; // Return success with null data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'PREFERENCE_UPDATE_ERROR', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'PreferenceUpdateProcessing', correlationId });
      this.logger.error(`[${correlationId}] Error processing preference update: ${errorMessage}`, { agentId: this.id, operation: 'handlePreferenceUpdate', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }



  private async handleUpdateRecommendationHistory(message: AgentMessage<any>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling update recommendation history request`, { agentId: this.id, operation: 'handleUpdateRecommendationHistory' });

    // For now, just acknowledge receipt. Actual logic for updating history will go here.
    const responseMessage = createAgentMessage(
      'recommendation-history-update-ack',
      { success: true, message: 'Recommendation history update received' },
      this.id,
      message.conversationId,
      message.correlationId,
      message.sourceAgent,
      message.userId
    );
    return { success: true, data: null };
  }
  private mapPreferenceValue(type: string, rawValue: any): PreferenceNode['value'] {
    switch (type) {
        case 'priceRange':
            // Ensure it's an array of two numbers
            return Array.isArray(rawValue) && rawValue.length === 2 && typeof rawValue[0] === 'number' && typeof rawValue[1] === 'number'
                ? rawValue as [number, number]
                : String(rawValue); // Fallback to string if malformed
        case 'pairingConfidence':
            return rawValue; // Now expected to be a number from PreferenceExtractionService
        case 'foodPairingActive':
            return rawValue; // Now expected to be a boolean from PreferenceExtractionService
        case 'regions':
        case 'grapes':
        case 'detectedFoods':
        case 'suggestedPairings':
        case 'style':
        case 'bodyWeight':
        case 'tannins':
        case 'acidity':
        case 'sweetness':
        case 'color':
            return rawValue; // Now expected to be an array from PreferenceExtractionService
        default:
            return String(rawValue); // Default to string for all others
    }
  }
}