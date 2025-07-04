import { FinalRecommendationPayload } from '../../types/agent-outputs';
import { WineRecommendationOutput } from './LLMRecommendationAgent';
import { singleton, inject } from 'tsyringe'; // Import singleton and inject decorator
import { BaseAgent } from './BaseAgent';
import { AgentMessage, MessageTypes, createAgentMessage } from './communication/AgentMessage';
import { Result } from '../types/Result';
import { AgentError } from '../agents/AgentError'; // Corrected import path for AgentError
import { AgentDependencies, SommelierCoordinatorDependencies, TYPES } from '../../di/Types'; // Import SommelierCoordinatorDependencies and TYPES
import { ILogger } from '../../di/Types'; // Import ILogger from Types.ts
import { logger } from '../../utils/logger'; // Import the logger instance
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { CircuitBreaker } from '../CircuitBreaker';
import { Agent } from './Agent'; // Import Agent interface
import { PreferenceExtractionResultPayload, RecommendationResult } from '../../types/agent-outputs'; // Import RecommendationResult and PreferenceExtractionResultPayload
import { WineNode } from '../../types'; // Import WineNode

// --- Type Definitions for SommelierCoordinator ---

/**
 * Configuration for the SommelierCoordinator Agent.
 */
interface SommelierCoordinatorConfig {
  maxRecommendationAttempts: number;
  agentTimeoutMs: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerSuccessThreshold: number; // Added successThreshold
}

/**
 * Represents the current state of a wine recommendation conversation.
 */
interface ConversationState {
  conversationId: string;
  userId: string;
  timestamp: number;
  phase: 'INITIALIZED' | 'VALIDATION_COMPLETE' | 'RECOMMENDATIONS_READY' | 'SHOPPING_COMPLETE' | 'FINALIZED';
  originalInput: any; // TODO: Define a more specific input type
  ingredients: string[];
  budget: number;
  agentResponses: Map<string, any>; // Stores responses from other agents
  validatedIngredients: string[] | null;
  userPreferences: any | null; // TODO: Define UserPreferences type
  recommendations: RecommendationResult | null; // Now typed as RecommendationResult
  availableWines: any[] | null; // TODO: Define AvailableWine type
  decisions: { timestamp: number; decision: string; reasoning: string; agent: string; phase: string }[];
  errors: AgentError[];
  refinementAttempts: number;
  confidence: number;
  qualityScore: number;
  previousRecommendations: any[]; // Stores failed recommendation attempts
  budgetStrategy?: 'value_focused' | 'premium_alternatives';
}

/**
 * Represents the input for the SommelierCoordinator's orchestration process.
 */
interface OrchestrationInput {
  userInput: any; // TODO: Define a more specific input type
  conversationId: string;
  correlationId: string;
  sourceAgent: string; // Added sourceAgent
}

/**
 * Represents the final recommendation output.
 */
interface FinalRecommendation {
  primaryRecommendation: WineRecommendationOutput | null;
  alternatives: WineRecommendationOutput[];
  explanation: string;
  confidence: number;
  conversationId: string;
  canRefine: boolean;
}

// --- SommelierCoordinator Agent Implementation ---

@singleton() // Mark SommelierCoordinator as a singleton
export class SommelierCoordinator extends BaseAgent<SommelierCoordinatorConfig, ConversationState> implements Agent {
  private readonly logger: ILogger; // Keep ILogger type
  private readonly communicationBus: EnhancedAgentCommunicationBus;
  private readonly circuitBreakers: Map<string, CircuitBreaker>;

  getName(): string {
    return this.id; // Or a more descriptive name if needed
  }

  getCapabilities(): string[] {
    return ['orchestration', 'recommendation', 'validation', 'preference', 'shopping', 'explanation', 'fallback'];
  }

  constructor(
    @inject(TYPES.SommelierCoordinatorId) id: string,
    @inject(TYPES.SommelierCoordinatorConfig) config: SommelierCoordinatorConfig,
    @inject(TYPES.SommelierCoordinatorDependencies) dependencies: SommelierCoordinatorDependencies // Changed to SommelierCoordinatorDependencies
  ) {
    super(id, config, dependencies);
    this.logger = dependencies.logger;
    this.communicationBus = dependencies.communicationBus; // No need for cast now
    this.logger.info(`[${this.id}] SommelierCoordinator logger level: ${this.logger.level}`, { agentId: this.id, operation: 'constructor' });

    this.circuitBreakers = new Map();
    this.initializeCircuitBreakers();

    this.registerMessageHandlers();
  }

  protected validateConfig(config: SommelierCoordinatorConfig): void {
    if (config.maxRecommendationAttempts <= 0) {
      throw new Error('maxRecommendationAttempts must be a positive number');
    }
    if (config.agentTimeoutMs <= 0) {
      throw new Error('agentTimeoutMs must be a positive number');
    }
    if (config.circuitBreakerFailureThreshold <= 0) {
      throw new Error('circuitBreakerFailureThreshold must be a positive number');
    }
  }

  protected getInitialState(): ConversationState {
    // This will be initialized per conversation, not as a global agent state.
    // The actual conversation state will be managed in a Map or a dedicated service.
    return {} as ConversationState;
  }

  private initializeCircuitBreakers(): void {
    const agentsToMonitor = ['input-validation-agent', 'user-preference-agent', 'recommendation-agent', 'shopper-agent', 'fallback-agent', 'user-preference-agent', 'explanation-agent'];
    agentsToMonitor.forEach(agentName => {
      this.circuitBreakers.set(agentName, new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerFailureThreshold,
        successThreshold: this.config.circuitBreakerSuccessThreshold, // Added successThreshold
        timeoutMs: this.config.agentTimeoutMs,
        fallback: this.getAgentFallback(agentName) // Changed to fallback
      }));
    });
  }

  private getAgentFallback(agentName: string): () => any {
    // TODO: Implement more sophisticated fallbacks based on agent type
    const fallbacks: { [key: string]: () => any } = {
      'input-validation-agent': () => ({ validIngredients: [], invalidIngredients: [], success: true }),
      'user-preference-agent': () => ({ preferences: {}, success: true }),
      'recommendation-agent': () => ({ wines: [], success: true }),
      'shopper-agent': () => ({ availableOptions: [], success: true }),
      'fallback-agent': () => ({ suggestions: [], success: true })
    };
    return fallbacks[agentName] || (() => ({ success: false, error: 'Unknown fallback' }));
  }

  private registerMessageHandlers(): void {
    // Register handlers for messages this coordinator expects to receive
    this.communicationBus.registerMessageHandler(this.id, MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST, this.handleOrchestrationRequest.bind(this) as any); // Cast to any for type compatibility
    // Add other specific message handlers as needed for agent responses
  }

  public async handleMessage<T>( // Changed to public
    message: AgentMessage<T>
  ): Promise<Result<AgentMessage<any> | null, AgentError>> { // Revert to original return type
    const { correlationId, type, payload, conversationId, sourceAgent } = message; // Added conversationId, sourceAgent
    const logContext = { correlationId, agentId: this.id, operation: `handleMessage:${type}` };

    this.logger.info(`[${correlationId}] SommelierCoordinator received message of type: ${type}`, logContext);

    try {
      switch (type) {
        case MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST:
          const orchestrationInput = payload as OrchestrationInput;
          const result = await this.orchestrateRecommendation(orchestrationInput.userInput, orchestrationInput.conversationId, orchestrationInput.correlationId);
          return { success: true, data: createAgentMessage(MessageTypes.FINAL_RECOMMENDATION, result, this.id, orchestrationInput.conversationId, correlationId, sourceAgent) }; // Create AgentMessage
        // Add cases for handling responses from other agents if they send direct replies
        default:
          this.logger.warn(`[${correlationId}] SommelierCoordinator received unhandled message type: ${type}`, logContext);
          return { success: true, data: null };
      }
    } catch (error: any) {
      this.logger.error(`[${correlationId}] Error handling message: ${error.message}`, { ...logContext, error: error.message, stack: error.stack });
      return {
        success: false,
        error: new AgentError(
          `Failed to handle message of type ${type}: ${error.message}`,
          'SOMELIER_MESSAGE_HANDLE_ERROR',
          this.id,
          correlationId,
          false, // Assuming non-recoverable for now, can be refined
          { originalError: error.message }
        )
      };
    }
  }

  /**
   * Handles the initial request to orchestrate a wine recommendation.
   * This method is registered as a message handler for ORCHESTRATE_RECOMMENDATION_REQUEST.
   */
  private async handleOrchestrationRequest(message: AgentMessage<OrchestrationInput>): Promise<Result<AgentMessage<FinalRecommendation> | null, AgentError>> { // Changed return type
    const { payload, conversationId, correlationId, sourceAgent } = message; // Added sourceAgent
    const logContext = { correlationId, agentId: this.id, conversationId, operation: 'handleOrchestrationRequest' };

    this.logger.info(`[${correlationId}] Starting orchestration for conversation: ${conversationId}`, logContext);

    try {
      const finalRecommendation = await this.orchestrateRecommendation(payload.userInput, conversationId, correlationId);
      this.logger.info(`[${correlationId}] Orchestration completed for conversation: ${conversationId}`, logContext);
      return { success: true, data: createAgentMessage(MessageTypes.FINAL_RECOMMENDATION, finalRecommendation, this.id, conversationId, correlationId, sourceAgent) }; // Wrap finalRecommendation in an AgentMessage
    } catch (error: any) {
      this.logger.error(`[${correlationId}] Orchestration failed for conversation ${conversationId}: ${error.message}`, { ...logContext, error: error.message, stack: error.stack });
      return {
        success: false,
        error: new AgentError(
          `Orchestration failed: ${error.message}`,
          'ORCHESTRATION_FAILURE',
          this.id,
          correlationId,
          false,
          { originalError: error.message }
        )
      };
    }
  }

  /**
   * Orchestrates the entire wine recommendation process.
   * This is the core logic of the SommelierCoordinator.
   */
  public async orchestrateRecommendation(
    userInput: any, // TODO: Stronger typing
    conversationId: string,
    correlationId: string
  ): Promise<FinalRecommendation> {
    const logContext = { correlationId, agentId: this.id, conversationId, operation: 'orchestrateRecommendation' };
    this.logger.info(`[${correlationId}] Starting wine recommendation orchestration.`, logContext);
    this.logger.info(`[${correlationId}] Initial userInput: ${JSON.stringify(userInput)}`, logContext);

    let state: ConversationState = {
      conversationId,
      userId: userInput.userId || 'anonymous', // Assuming userId is part of userInput
      timestamp: Date.now(),
      phase: 'INITIALIZED',
      originalInput: userInput,
      ingredients: userInput.ingredients || [],
      budget: userInput.budget || 0,
      agentResponses: new Map(),
      validatedIngredients: null,
      userPreferences: null,
      recommendations: null,
      availableWines: null,
      decisions: [],
      errors: [],
      refinementAttempts: 0,
      confidence: 0,
      qualityScore: 0,
      previousRecommendations: [],
    };

    try {
      // Phase 1: Information Gathering (Parallel Execution)
      this.logger.info(`[${correlationId}] Phase 1: Gathering information in parallel...`, logContext);
      this.logger.debug(`[${correlationId}] Sending validation and preference messages.`, logContext);
      state.phase = 'VALIDATION_COMPLETE'; // Update phase after parallel operations are conceptually complete

      const validationResult = await this.sendMessageToAgentWithCircuitBreaker(
        'input-validation-agent',
        createAgentMessage(MessageTypes.VALIDATE_INPUT, userInput.input, this.id, conversationId, this.generateCorrelationId(), 'input-validation-agent', userInput.userId)
      );

      if (!validationResult.success) {
        state.errors.push(validationResult.error);
        this.logger.error(`[${correlationId}] InputValidation failed: ${validationResult.error.message}`, logContext);
        throw validationResult.error;
      }

      state.validatedIngredients = validationResult.data.payload.cleanedInput.ingredients;

      // Handle preference extraction, which might be asynchronous
      const preferenceMessageCorrelationId = this.generateCorrelationId();
      // Limit conversation history to the last 3 turns for preference extraction to reduce prompt length
      const limitedConversationHistory = userInput.conversationHistory ? userInput.conversationHistory.slice(-3) : [];
      const preferenceRequestMessage = createAgentMessage(
        MessageTypes.GET_PREFERENCES,
        { input: userInput.input.message, userId: userInput.userId, conversationHistory: limitedConversationHistory },
        this.id,
        conversationId,
        preferenceMessageCorrelationId,
        'user-preference-agent',
        userInput.userId
      );

      this.logger.debug(`[${correlationId}] Sending preference request.`, logContext);
      let preferenceResult = await this.sendMessageToAgentWithCircuitBreaker('user-preference-agent', preferenceRequestMessage);
      this.logger.info(`[${correlationId}] Received preference result: ${preferenceResult.success ? JSON.stringify(preferenceResult.data) : preferenceResult.error.message}`, logContext);

      // Check if preference extraction is asynchronous
      if (!preferenceResult.success && preferenceResult.error?.message === 'Analyzing your input for preferences asynchronously.') {
        this.logger.info(`[${correlationId}] Preference extraction is asynchronous. Waiting for LLMPreferenceExtractorAgent response.`, logContext);
        // Wait for the actual preference extraction response from LLMPreferenceExtractorAgent
        const llmPreferenceResult = await this.communicationBus.sendMessageAndWaitForResponse<PreferenceExtractionResultPayload>(
          'llm-preference-extractor',
          createAgentMessage(
            MessageTypes.PREFERENCE_EXTRACTION_REQUEST, // This message type is what LLMPreferenceExtractorAgent expects
            { input: userInput.input.message, userId: userInput.userId, history: limitedConversationHistory }, // Use limited history
            this.id,
            conversationId,
            preferenceMessageCorrelationId, // Use the same correlation ID
            'llm-preference-extractor',
            userInput.userId
          )
        );

        if (!llmPreferenceResult.success || !llmPreferenceResult.data) {
          state.errors.push(llmPreferenceResult.success ? new AgentError('LLMPreferenceExtractorAgent returned no data', 'NO_LLM_PREFERENCE_DATA', this.id, correlationId) : llmPreferenceResult.error);
          this.logger.error(`[${correlationId}] LLMPreferenceExtractorAgent failed: ${llmPreferenceResult.success ? 'No data' : llmPreferenceResult.error?.message}`, logContext);
          throw llmPreferenceResult.success ? new AgentError('LLMPreferenceExtractorAgent returned no data', 'NO_LLM_PREFERENCE_DATA', this.id, correlationId) : llmPreferenceResult.error;
        }
        state.userPreferences = llmPreferenceResult.data.payload.preferences;
      } else if (!preferenceResult.success) {
        state.errors.push(preferenceResult.error);
        this.logger.error(`[${correlationId}] PreferenceAgent failed: ${preferenceResult.error.message}`, logContext);
        throw preferenceResult.error;
      } else {
        state.userPreferences = preferenceResult.data.payload.preferences;
      }
      this.logger.info(`[${correlationId}] State updated: validatedIngredients=${JSON.stringify(state.validatedIngredients)}, userPreferences=${JSON.stringify(state.userPreferences)}`, logContext);
      state.decisions.push({
        timestamp: Date.now(),
        decision: 'Initial information gathered',
        reasoning: 'Input validated and preferences retrieved.',
        agent: this.id,
        phase: state.phase
      });
      this.logger.debug(`[${correlationId}] Phase 1 complete.`, logContext);

      // Phase 2: Conditional Logic & Decision Making
      this.logger.info(`[${correlationId}] Phase 2: Making decisions based on gathered data...`, logContext);
      this.logger.debug(`[${correlationId}] Checking for invalid ingredients.`, logContext);

      if (validationResult.data.hasInvalidIngredients) {
        this.logger.warn(`[${correlationId}] Invalid ingredients detected, consulting Fallback Agent...`, logContext);
        const fallbackMessage = createAgentMessage(MessageTypes.FALLBACK_REQUEST, {
          invalidIngredients: validationResult.data.invalidIngredients,
          validIngredients: validationResult.data.validIngredients
        }, this.id, conversationId, this.generateCorrelationId(), 'fallback-agent', userInput.userId); // Added userId
        this.logger.debug(`[${correlationId}] Sending fallback request.`, logContext);
        const fallbackResult = await this.sendMessageToAgentWithCircuitBreaker('fallback-agent', fallbackMessage);
        this.logger.debug(`[${correlationId}] Received fallback result.`, logContext);

        if (fallbackResult.success && fallbackResult.data.confidence < 0.7) {
          throw new AgentError('Low confidence from Fallback Agent, user clarification needed.', 'LOW_FALLBACK_CONFIDENCE', this.id, correlationId, true);
        }
        if (fallbackResult.success) {
          state.ingredients = [...validationResult.data.validIngredients, ...fallbackResult.data.suggestedIngredients];
          state.decisions.push({
            timestamp: Date.now(),
            decision: 'Ingredients adjusted via Fallback Agent',
            reasoning: 'Invalid ingredients handled by suggesting alternatives.',
            agent: this.id,
            phase: state.phase
          });
        } else {
          state.errors.push(fallbackResult.error);
          this.logger.error(`[${correlationId}] FallbackAgent failed during invalid ingredient handling: ${fallbackResult.error.message}`, logContext);
          throw fallbackResult.error;
        }
      }
      this.logger.debug(`[${correlationId}] Checking budget realism.`, logContext);
      // Budget validation (simplified for now)
      if (userInput.budget && !this.isBudgetRealistic(state.ingredients, userInput.budget)) {
        this.logger.warn(`[${correlationId}] Budget mismatch detected, adjusting expectations...`, logContext);
        const budgetAdjustmentMessage = createAgentMessage(MessageTypes.ADJUST_BUDGET_EXPECTATIONS, {
          ingredients: state.ingredients,
          budget: userInput.budget
        }, this.id, conversationId, this.generateCorrelationId(), 'Preference', userInput.userId); // Added userId
        this.logger.debug(`[${correlationId}] Sending budget adjustment request.`, logContext);
        const budgetAdjustmentResult = await this.sendMessageToAgentWithCircuitBreaker('user-preference-agent', budgetAdjustmentMessage);
        this.logger.debug(`[${correlationId}] Received budget adjustment result.`, logContext);

        if (budgetAdjustmentResult.success) {
          state.budgetStrategy = budgetAdjustmentResult.data.strategy;
          state.decisions.push({
            timestamp: Date.now(),
            decision: 'Budget strategy adjusted',
            reasoning: `Budget adjusted to ${state.budgetStrategy}.`,
            agent: this.id,
            phase: state.phase
          });
        } else {
          state.errors.push(budgetAdjustmentResult.error);
          this.logger.error(`[${correlationId}] PreferenceAgent failed during budget adjustment: ${budgetAdjustmentResult.error.message}`, logContext);
          throw budgetAdjustmentResult.error;
        }
      }
      this.logger.debug(`[${correlationId}] Phase 2 complete.`, logContext);

      // Phase 3: Recommendation Generation (Sequential with Feedback Loop)
      this.logger.info(`[${correlationId}] Phase 3: Generating recommendations...`, logContext);
      state.phase = 'RECOMMENDATIONS_READY';

      let recommendationsResult: Result<any, AgentError> = { success: false, error: new AgentError('No recommendations generated', 'NO_RECOMMENDATIONS', this.id, correlationId) };

      for (let attempt = 0; attempt < this.config.maxRecommendationAttempts; attempt++) {
        state.refinementAttempts = attempt;
        this.logger.info(`[${correlationId}] Recommendation attempt ${attempt + 1}`, logContext);

        this.logger.info(`[${correlationId}] SommelierCoordinator preparing recommendation request.`, logContext);
        const recommendationMessage = createAgentMessage(
          MessageTypes.GENERATE_RECOMMENDATIONS,
          {
            input: {
              ingredients: state.ingredients,
              preferences: state.userPreferences,
              message: userInput.input.message, // Pass the original user message
            },
            conversationHistory: userInput.conversationHistory, // Pass conversation history if available
            userId: userInput.userId,
          },
          this.id,
          conversationId,
          this.generateCorrelationId(),
          'Recommendation',
          userInput.userId
        );
        this.logger.debug(`[${correlationId}] Sending recommendation request.`, logContext);
        recommendationsResult = await this.sendMessageToAgentWithCircuitBreaker('recommendation-agent', recommendationMessage);
        this.logger.info(`[${correlationId}] Received recommendation result: ${recommendationsResult.success ? JSON.stringify(recommendationsResult.data) : recommendationsResult.error.message}`, logContext);

        if (recommendationsResult.success) {
          const qualityScore = this.evaluateRecommendationQuality(recommendationsResult.data, state);
          state.qualityScore = qualityScore;

          if (qualityScore >= 0.8) {
            this.logger.info(`[${correlationId}] High quality recommendations generated.`, logContext);
            break;
          } else if (qualityScore > 0.6) {
            this.logger.warn(`[${correlationId}] Moderate quality, attempting to refine recommendations...`, logContext);
            const refinementMessage = createAgentMessage(MessageTypes.REFINE_RECOMMENDATIONS, {
              input: {
                currentRecommendations: recommendationsResult.data,
                qualityIssues: this.identifyQualityIssues(recommendationsResult.data, state)
              }
            }, this.id, conversationId, this.generateCorrelationId(), 'Recommendation', userInput.userId);
            this.logger.debug(`[${correlationId}] Sending refinement request.`, logContext);
            const refinementResult = await this.sendMessageToAgentWithCircuitBreaker('recommendation-agent', refinementMessage);
            this.logger.debug(`[${correlationId}] Received refinement result.`, logContext);
            if (refinementResult.success) {
              recommendationsResult = refinementResult; // Use refined recommendations
              this.logger.info(`[${correlationId}] Recommendations refined successfully.`, logContext);
              break;
            } else {
              state.errors.push(refinementResult.error);
              this.logger.error(`[${correlationId}] Recommendation refinement failed: ${refinementResult.error.message}`, logContext);
            }
          } else {
            this.logger.warn(`[${correlationId}] Low quality recommendations, trying different approach...`, logContext);
            state.previousRecommendations.push(recommendationsResult.data);
          }
        } else {
          state.errors.push(recommendationsResult.error);
          this.logger.error(`[${correlationId}] RecommendationAgent failed: ${recommendationsResult.error.message}`, logContext);
        }
      }

      if (!recommendationsResult.success) {
        this.logger.error(`[${correlationId}] All recommendation attempts failed. Using emergency fallback.`, logContext);
        const emergencyFallbackMessage = createAgentMessage(MessageTypes.EMERGENCY_RECOMMENDATIONS, { error: state }, this.id, conversationId, this.generateCorrelationId(), 'Fallback', userInput.userId);
        this.logger.debug(`[${correlationId}] Sending emergency fallback request.`, logContext);
        const fallbackResult = await this.sendMessageToAgentWithCircuitBreaker('fallback-agent', emergencyFallbackMessage);
        this.logger.debug(`[${correlationId}] Received emergency fallback result.`, logContext);
        if (fallbackResult.success) {
          state.recommendations = fallbackResult.data;
        } else {
          state.errors.push(fallbackResult.error);
          this.logger.error(`[${correlationId}] Emergency fallback failed: ${fallbackResult.error.message}`, logContext);
          throw fallbackResult.error;
        }
      } else {
        state.recommendations = recommendationsResult.data.payload; // The payload contains the RecommendationResult
      }
      this.logger.debug(`[${correlationId}] Phase 3 complete.`, logContext);

      // Phase 4: Shopping & Availability (Parallel with Prioritization)
      this.logger.info(`[${correlationId}] Phase 4: Finding available wines...`, logContext);
      state.phase = 'SHOPPING_COMPLETE';
      this.logger.debug(`[${correlationId}] Preparing shopping promises.`, logContext);

      // Ensure recommendations exist and have the 'recommendations' array
      const wineRecommendations = state.recommendations?.recommendations || [];
      const shoppingPromises = wineRecommendations.map((wine: WineRecommendationOutput, index: number) =>
        this.sendMessageToAgentWithCircuitBreaker(
          'shopper-agent',
          createAgentMessage(MessageTypes.FIND_WINES, {
            wine: wine.name, // Pass the wine name as a string
            budget: state.budget,
            priority: index,
            maxResults: index === 0 ? 10 : 5
          }, this.id, conversationId, this.generateCorrelationId(), 'shopper-agent', userInput.userId) // Added userId
        )
      );
      this.logger.debug(`[${correlationId}] Awaiting shopping results.`, logContext);
      const shoppingResults = await Promise.all(shoppingPromises);
      this.logger.debug(`[${correlationId}] Received shopping results.`, logContext);
      const availableOptions = this.processShoppingResults(shoppingResults, state);

      if (availableOptions.length === 0) {
        this.logger.warn(`[${correlationId}] No wines available! Expanding search...`, logContext);
        const expandedSearchMessage = createAgentMessage(MessageTypes.EXPANDED_SEARCH, {
          originalCriteria: state.recommendations,
          budget: state.budget * 1.2,
          alternativeVarietals: true
        }, this.id, conversationId, this.generateCorrelationId(), 'Shopper', userInput.userId); // Added userId
        this.logger.debug(`[${correlationId}] Sending expanded search request.`, logContext);
        const expandedSearchResult = await this.sendMessageToAgentWithCircuitBreaker('shopper-agent', expandedSearchMessage);
        this.logger.debug(`[${correlationId}] Received expanded search result.`, logContext);
        if (expandedSearchResult.success) {
          availableOptions.push(...expandedSearchResult.data.payload.wines);
        } else {
          state.errors.push(expandedSearchResult.error);
          this.logger.error(`[${correlationId}] Expanded search failed: ${expandedSearchResult.error.message}`, logContext);
        }
      }
      this.logger.debug(`[${correlationId}] availableOptions before assigning to state: ${JSON.stringify(availableOptions)}`, logContext);
      state.availableWines = availableOptions;
      this.logger.debug(`[${correlationId}] Phase 4 complete.`, logContext);

      // Phase 5: Final Assembly & Presentation
      this.logger.info(`[${correlationId}] Phase 5: Assembling final recommendation...`, logContext);
      state.phase = 'FINALIZED';
      this.logger.debug(`[${correlationId}] Finalizing recommendation.`, logContext);
      const finalRecommendation = await this.finalizeRecommendation(state, correlationId);
      this.logger.debug(`[${correlationId}] Final recommendation assembled.`, logContext);

      this.logger.info(`[${correlationId}] Wine recommendation orchestration completed successfully.`, logContext);
      return finalRecommendation;

    } catch (error: any) {
      this.logger.error(`[${correlationId}] Orchestration failed: ${error.message}`, { ...logContext, error: error.message, stack: error.stack });
      state.errors.push(new AgentError(error.message, 'ORCHESTRATION_ERROR', this.id, correlationId, false, { originalError: error.message }));
      // Attempt to send a final error message or a simplified fallback
      const finalError: FinalRecommendation = {
        primaryRecommendation: null,
        alternatives: [],
        explanation: `An error occurred during the recommendation process: ${error.message}. Please try again.`,
        confidence: 0,
        conversationId: conversationId,
        canRefine: false
      };
      return finalError;
    }
  }

  /**
   * Helper to send messages to other agents, wrapped with circuit breaker logic.
   */
  private async sendMessageToAgentWithCircuitBreaker(
    agentName: string,
    message: AgentMessage<any>
  ): Promise<Result<any, AgentError>> {
    const circuitBreaker = this.circuitBreakers.get(agentName);
    if (!circuitBreaker) {
      return { success: false, error: new AgentError(`Circuit breaker not found for agent: ${agentName}`, 'CIRCUIT_BREAKER_NOT_FOUND', this.id, message.correlationId) };
    }

    const logContext = { correlationId: message.correlationId, agentId: this.id, targetAgent: agentName, messageType: message.type };
    this.logger.info(`[${message.correlationId}] Sending message to ${agentName} (type: ${message.type})`, logContext);

    try {
      const response = await circuitBreaker.execute(async () => {
        const result = await this.communicationBus.sendMessageAndWaitForResponse(agentName, message);
        if (result.success) {
          return result.data;
        } else {
          throw result.error; // Throw the AgentError to trigger circuit breaker failure
        }
      });
      this.logger.info(`[${message.correlationId}] Received response from ${agentName}`, logContext);
      return { success: true, data: response };
    } catch (error: any) {
      this.logger.error(`[${message.correlationId}] Failed to get response from ${agentName}: ${error.message}`, { ...logContext, error: error.message, stack: error.stack });
      this.logger.debug(`[${message.correlationId}] Caught error in sendMessageToAgentWithCircuitBreaker: ${JSON.stringify(error)}`);
      return {
        success: false,
        error: new AgentError(
          `Communication with ${agentName} failed: ${error.message}`,
          'AGENT_COMMUNICATION_ERROR',
          this.id,
          message.correlationId,
          true, // Assuming recoverable for now, can be refined
          { originalError: error.message, agentName: agentName }
        )
      };
    }
  }

  // --- Private Helper Methods (to be implemented) ---

  private isBudgetRealistic(ingredients: string[], budget: number): boolean {
    // TODO: Implement logic to check if the budget is realistic for the given ingredients
    // This might involve calling a service or having some internal knowledge
    this.logger.debug(`Checking if budget ${budget} is realistic for ingredients: ${ingredients.join(', ')}`);
    return true; // Placeholder
  }

  private evaluateRecommendationQuality(recommendations: RecommendationResult, state: ConversationState): number {
    // TODO: Implement logic to evaluate the quality of recommendations
    // Factors: relevance to ingredients, user preferences, budget, diversity, etc.
    this.logger.debug(`Evaluating recommendation quality for conversation: ${state.conversationId}`);
    // Placeholder: Use confidence from the recommendation result
    return recommendations.confidence;
  }

  private identifyQualityIssues(recommendations: RecommendationResult, state: ConversationState): string[] {
    // TODO: Implement logic to identify specific quality issues
    this.logger.debug(`Identifying quality issues for conversation: ${state.conversationId}`);
    // Placeholder: Example of identifying an issue if confidence is low
    if (recommendations.confidence < 0.7) {
      return ['Low confidence in recommendation.'];
    }
    return []; // Placeholder
  }

  private processShoppingResults(shoppingResults: Result<any, AgentError>[], state: ConversationState): any[] {
    // TODO: Implement logic to process shopping results, filter, and consolidate
    this.logger.debug(`Processing shopping results for conversation: ${state.conversationId}`);
    const available: any[] = [];
    shoppingResults.forEach(result => {
      if (result.success) {
        if (result.data.payload.availableOptions) {
          available.push(...result.data.payload.availableOptions);
        } else if (result.data.payload.wines) { // Check for 'wines' property
          available.push(...result.data.payload.wines);
        }
      } else if (!result.success) { // Corrected type narrowing
        state.errors.push(result.error);
        this.logger.error(`Error in shopping result: ${result.error.message}`);
      }
    });
    this.logger.debug(`[${state.conversationId}] processShoppingResults returning available: ${JSON.stringify(available)}`, { agentId: this.id, operation: 'processShoppingResults' });
    return available; // Placeholder
  }

  private async finalizeRecommendation(state: ConversationState, correlationId: string): Promise<FinalRecommendationPayload> {
    // TODO: Implement final ranking, explanation generation, and confidence scoring
    this.logger.info(`[${correlationId}] Finalizing recommendation for conversation: ${state.conversationId}`);

    let primaryRecommendation: WineRecommendationOutput | null = null;
    let alternatives: WineRecommendationOutput[] = [];
    let explanation = '';
    let confidence = 0;

    if (state.availableWines && state.availableWines.length > 0) {
      // Assuming availableWines are already WineNode objects or can be converted
      // For now, let's assume they are strings or have a 'name' property
      primaryRecommendation = state.availableWines[0] ? { name: state.availableWines[0].name, grapeVarieties: state.availableWines[0].grapeVarieties || [] } : null;
      alternatives = state.availableWines.slice(1, 4).map((wine: any) => ({ name: wine.name, grapeVarieties: wine.grapeVarieties || [] }));
      // If wines are available, generate explanation based on them
      explanation = await this.generateExplanation(primaryRecommendation?.name || null, state.ingredients, state.userPreferences, correlationId, state);
      confidence = this.calculateConfidence(state); // Calculate confidence based on available wines
    } else if (state.recommendations && state.recommendations.recommendations && state.recommendations.recommendations.length > 0) {
      // If no available wines, but LLM provided recommendations, use them (which are strings)
      primaryRecommendation = state.recommendations.recommendations[0];
      alternatives = state.recommendations.recommendations.slice(1, 4);
      explanation = state.recommendations.reasoning || ''; // Use LLM's explanation, default to empty string
      confidence = state.recommendations.confidence; // Use LLM's confidence
    } else {
      // Fallback if no recommendations at all
      explanation = `No specific wine recommendations could be generated at this time. Please try rephrasing your request.`;
      confidence = 0;
    }

    // Learning: Update preferences based on recommendation (fire and forget message)
    if (primaryRecommendation) { // Only update history if a recommendation was made
      this.communicationBus.publishToAgent(
        'user-preference-agent',
        createAgentMessage(MessageTypes.UPDATE_RECOMMENDATION_HISTORY, {
          userId: state.userId,
          recommendation: primaryRecommendation?.name || null,
          context: state
        }, this.id, state.conversationId, this.generateCorrelationId(), 'user-preference-agent')
      );
    }

    return {
      primaryRecommendation,
      alternatives,
      explanation,
      confidence,
      conversationId: state.conversationId,
      canRefine: confidence < 0.9 // Offer refinement if not highly confident
    };
  }

  private async generateExplanation(wineName: string | null, ingredients: string[], preferences: any, correlationId: string, state: ConversationState): Promise<string> {
    // Only call ExplanationAgent if there's a primary recommendation to explain
    if (!wineName) {
      return `No specific wine was recommended to generate a detailed explanation.`;
    }
 
    this.logger.debug(`[${correlationId}] Generating explanation for wine: ${wineName}`);
    const explanationMessage = createAgentMessage(MessageTypes.GENERATE_EXPLANATION, {
      recommendedWines: wineName ? [wineName] : [], // Pass wine name as string
      recommendationContext: {
        ingredients: ingredients,
        preferences: preferences
      }
    }, this.id, state.conversationId, this.generateCorrelationId(), 'Explanation');

    const explanationResult = await this.sendMessageToAgentWithCircuitBreaker('explanation-agent', explanationMessage);
    if (explanationResult.success) {
      return explanationResult.data.explanation;
    } else {
      this.logger.error(`[${correlationId}] Failed to generate explanation: ${explanationResult.error.message}`);
      return `Could not generate a detailed explanation for this wine.`;
    }
  }

  private calculateConfidence(state: ConversationState): number {
    // If there are available wines, confidence is based on quality score.
    // Otherwise, if LLM recommendations were used, confidence comes directly from LLM.
    // If no recommendations at all, confidence is 0.
    if (state.availableWines && state.availableWines.length > 0) {
      return state.qualityScore;
    } else if (state.recommendations && state.recommendations.confidence !== undefined) {
      return state.recommendations.confidence;
    }
    return 0;
  }
  protected generateCorrelationId(): string {
    return `${this.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
