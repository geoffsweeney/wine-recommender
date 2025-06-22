import { inject, injectable } from 'tsyringe';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
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
    @inject(TYPES.KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
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

  getName(): string {
    return 'UserPreferenceAgent';
  }

  getCapabilities(): string[] {
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
    if (message.type === 'preference-request') {
      return this.handlePreferenceRequest(message as AgentMessage<PreferenceMessagePayload>);
    }
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

  protected registerHandlers(): void {
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      'preference-request',
      this.handlePreferenceRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>> // Cast to expected type
    );
  }

  private async handlePreferenceRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling preference request`, { agentId: this.id, operation: 'handlePreferenceRequest' });

    try {
      // Validate and cast payload
      const payload = message.payload as PreferenceMessagePayload;
      if (!payload || typeof payload.input !== 'string') { // Basic validation
        const error = new AgentError('Invalid or missing payload in preference request', 'INVALID_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'preference-validation', correlationId });
        return { success: false, error };
      }
      
      const { input, conversationHistory, userId, initialPreferences } = payload;
      const currentUserId = userId; // userId is now required

      let persistedPreferences: PreferenceNode[] = [];
      if (initialPreferences) {
        persistedPreferences = initialPreferences;
      } else if (currentUserId) {
        persistedPreferences = await this.knowledgeGraphService.getPreferences(currentUserId, false);
      }

      const fastPreferencesResult = await this.preferenceExtractionService.attemptFastExtraction(input);

      // Check if fastPreferencesResult is not null and is successful
      if (fastPreferencesResult && fastPreferencesResult.success && fastPreferencesResult.data) {
        const fastPreferences = fastPreferencesResult.data;
        const extractedPreferences = Object.entries(fastPreferences).map(([type, value]) => ({
          type,
          value: String(value), // Explicitly cast value to string or appropriate type
          source: 'fast-extraction',
          confidence: 1,
          timestamp: new Date().toISOString(),
          active: true
        }));

        const normalizedExtractedPreferences =
          this.preferenceNormalizationService.normalizePreferences(extractedPreferences);
        
        await this.persistPreferences(normalizedExtractedPreferences, currentUserId);

        const mergedPreferences = this.mergePreferences(
          persistedPreferences,
          normalizedExtractedPreferences
        );

        // Broadcast updated preferences to all interested agents
        const broadcastMessage = createAgentMessage(
          'preferences-updated',
          {
            userId: currentUserId,
            preferences: mergedPreferences,
            source: 'preference-agent'
          },
          this.id,
          correlationId,
          '*' // Broadcast to all
        );
        this.broadcast(broadcastMessage.type, broadcastMessage.payload, broadcastMessage.correlationId); // Corrected broadcast call

        const responseMessage = createAgentMessage(
          'preference-update-result',
          {
            success: true,
            preferences: mergedPreferences
          },
          this.id,
          correlationId,
          message.sourceAgent
        );
        this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
        this.logger.info(`[${correlationId}] Preference request processed successfully (fast extraction)`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        return { success: true, data: responseMessage };
      } else {
        // If fast extraction fails or returns no data, queue async LLM extraction
        await this.queueAsyncLLMExtraction(input, currentUserId, conversationHistory, correlationId);
        const responseMessage = createAgentMessage(
          'preference-update-result',
          {
            success: false,
            preferences: [],
            error: 'Analyzing your input for preferences asynchronously.'
          },
          this.id,
          correlationId,
          message.sourceAgent
        );
        this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
        this.logger.info(`[${correlationId}] Preference request queued for async LLM extraction`, { agentId: this.id, operation: 'handlePreferenceRequest' });
        return { success: true, data: responseMessage }; // Still success from this agent's perspective, as it queued the task
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

  private async persistPreferences(preferences: PreferenceNode[], userId: string): Promise<void> {
    const persistenceUserId = userId; // userId is now required
    for (const preferenceNode of preferences) {
      await this.knowledgeGraphService.addOrUpdatePreference(persistenceUserId, preferenceNode);
    }
  }

  private async queueAsyncLLMExtraction(
    userInput: string,
    userId: string, // userId is now required
    conversationHistory?: ConversationTurn[],
    correlationId?: string // Add correlationId
  ): Promise<void> {
    const messageUserId = userId; // userId is now required
    const llmExtractionMessage = createAgentMessage(
      'llm-preference-extraction',
      {
        input: userInput,
        userId: messageUserId,
        history: conversationHistory,
      },
      this.id, // sourceAgent
      correlationId || this.generateCorrelationId(), // conversationId
      correlationId || this.generateCorrelationId(), // correlationId
      'LLMPreferenceExtractorAgent' // targetAgent
    );
    this.communicationBus.publishToAgent('LLMPreferenceExtractorAgent', llmExtractionMessage);
    this.logger.info(`[${correlationId}] Queued async LLM preference extraction for user: ${messageUserId}`, { agentId: this.id, operation: 'queueAsyncLLMExtraction' });
  }
}