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
  recommendations: any | null; // TODO: Define Recommendation type
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
  primaryRecommendation: any; // TODO: Define Wine type
  alternatives: any[]; // TODO: Define Wine type
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
    const agentsToMonitor = ['InputValidation', 'Preference', 'Recommendation', 'Shopper', 'Fallback'];
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
      'InputValidation': () => ({ validIngredients: [], invalidIngredients: [], success: true }),
      'Preference': () => ({ preferences: {}, success: true }),
      'Recommendation': () => ({ wines: [], success: true }),
      'Shopper': () => ({ availableOptions: [], success: true }),
      'Fallback': () => ({ suggestions: [], success: true })
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
  ): Promise<Result<AgentMessage<any> | null, AgentError>> {
    const { correlationId, type, payload, conversationId, sourceAgent } = message; // Added conversationId, sourceAgent
    const logContext = { correlationId, agentId: this.id, operation: `handleMessage:${type}` };

    this.logger.info(`[${correlationId}] SommelierCoordinator received message of type: ${type}`, logContext);

    try {
      switch (type) {
        case MessageTypes.ORCHESTRATE_RECOMMENDATION_REQUEST:
          const orchestrationInput = payload as OrchestrationInput;
          const result = await this.orchestrateRecommendation(orchestrationInput.userInput, orchestrationInput.conversationId, orchestrationInput.correlationId);
          return { success: true, data: createAgentMessage(MessageTypes.FINAL_RECOMMENDATION, result, this.id, orchestrationInput.conversationId, correlationId, sourceAgent) }; // Corrected argument order
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
          'SOMMELIER_MESSAGE_HANDLE_ERROR',
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
  private async handleOrchestrationRequest(message: AgentMessage<OrchestrationInput>): Promise<Result<AgentMessage<any> | null, AgentError>> { // Changed return type
    const { payload, conversationId, correlationId, sourceAgent } = message; // Added sourceAgent
    const logContext = { correlationId, agentId: this.id, conversationId, operation: 'handleOrchestrationRequest' };

    this.logger.info(`[${correlationId}] Starting orchestration for conversation: ${conversationId}`, logContext);

    try {
      const finalRecommendation = await this.orchestrateRecommendation(payload.userInput, conversationId, correlationId);
      // Send the final recommendation back to the original requester or a central bus
      this.communicationBus.publishToAgent( // Changed to publishToAgent
        sourceAgent, // Target agent is the source of the request
        createAgentMessage(MessageTypes.FINAL_RECOMMENDATION, finalRecommendation, this.id, conversationId, correlationId, sourceAgent)
      );
      this.logger.info(`[${correlationId}] Orchestration completed for conversation: ${conversationId}`, logContext);
      return { success: true, data: null }; // Return success
    } catch (error: any) {
      this.logger.error(`[${correlationId}] Orchestration failed for conversation ${conversationId}: ${error.message}`, { ...logContext, error: error.message, stack: error.stack });
      // Send an error message back
      this.communicationBus.publishToAgent( // Changed to publishToAgent
        sourceAgent, // Target agent is the source of the request
        createAgentMessage(MessageTypes.ERROR,
          new AgentError(`Orchestration failed: ${error.message}`, 'ORCHESTRATION_FAILURE', this.id, correlationId),
          this.id, conversationId, correlationId, sourceAgent
        )
      );
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
      state.phase = 'VALIDATION_COMPLETE'; // Update phase after parallel operations are conceptually complete

      const validationPromise = this.sendMessageToAgentWithCircuitBreaker(
        'InputValidation',
        createAgentMessage(MessageTypes.VALIDATE_INPUT, userInput, this.id, conversationId, correlationId, 'InputValidation')
      );
      const preferencePromise = this.sendMessageToAgentWithCircuitBreaker(
        'Preference',
        createAgentMessage(MessageTypes.GET_PREFERENCES, userInput, this.id, conversationId, correlationId, 'Preference')
      );

      const [validationResult, preferenceResult] = await Promise.all([
        validationPromise,
        preferencePromise
      ]);

      if (!validationResult.success) {
        state.errors.push(validationResult.error);
        this.logger.error(`[${correlationId}] InputValidation failed: ${validationResult.error.message}`, logContext);
        // Potentially trigger fallback or throw
        throw validationResult.error;
      }
      if (!preferenceResult.success) {
        state.errors.push(preferenceResult.error);
        this.logger.error(`[${correlationId}] PreferenceAgent failed: ${preferenceResult.error.message}`, logContext);
        // Potentially trigger fallback or throw
        throw preferenceResult.error;
      }

      state.validatedIngredients = validationResult.data.validIngredients;
      state.userPreferences = preferenceResult.data.preferences;
      state.decisions.push({
        timestamp: Date.now(),
        decision: 'Initial information gathered',
        reasoning: 'Input validated and preferences retrieved.',
        agent: this.id,
        phase: state.phase
      });

      // Phase 2: Conditional Logic & Decision Making
      this.logger.info(`[${correlationId}] Phase 2: Making decisions based on gathered data...`, logContext);

      if (validationResult.data.hasInvalidIngredients) {
        this.logger.warn(`[${correlationId}] Invalid ingredients detected, consulting Fallback Agent...`, logContext);
        const fallbackMessage = createAgentMessage(MessageTypes.FALLBACK_REQUEST, {
          invalidIngredients: validationResult.data.invalidIngredients,
          validIngredients: validationResult.data.validIngredients
        }, this.id, conversationId, correlationId, 'Fallback');

        const fallbackResult = await this.sendMessageToAgentWithCircuitBreaker('Fallback', fallbackMessage);

        if (fallbackResult.success && fallbackResult.data.confidence < 0.7) {
          // Decision: Should we proceed or ask user for clarification?
          // For now, we'll throw to indicate a need for clarification or a more robust fallback
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

      // Budget validation (simplified for now)
      if (userInput.budget && !this.isBudgetRealistic(state.ingredients, userInput.budget)) {
        this.logger.warn(`[${correlationId}] Budget mismatch detected, adjusting expectations...`, logContext);
        const budgetAdjustmentMessage = createAgentMessage(MessageTypes.ADJUST_BUDGET_EXPECTATIONS, {
          ingredients: state.ingredients,
          budget: userInput.budget
        }, this.id, conversationId, correlationId, 'Preference');

        const budgetAdjustmentResult = await this.sendMessageToAgentWithCircuitBreaker('Preference', budgetAdjustmentMessage);

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

      // Phase 3: Recommendation Generation (Sequential with Feedback Loop)
      this.logger.info(`[${correlationId}] Phase 3: Generating recommendations...`, logContext);
      state.phase = 'RECOMMENDATIONS_READY';

      let recommendationsResult: Result<any, AgentError> = { success: false, error: new AgentError('No recommendations generated', 'NO_RECOMMENDATIONS', this.id, correlationId) };

      for (let attempt = 0; attempt < this.config.maxRecommendationAttempts; attempt++) {
        state.refinementAttempts = attempt;
        this.logger.info(`[${correlationId}] Recommendation attempt ${attempt + 1}`, logContext);

        const recommendationRequest = {
          validatedIngredients: state.ingredients,
          userPreferences: state.userPreferences,
          budget: state.budget,
          budgetStrategy: state.budgetStrategy,
          previousAttempts: state.previousRecommendations
        };

        const recommendationMessage = createAgentMessage(MessageTypes.GENERATE_RECOMMENDATIONS, recommendationRequest, this.id, conversationId, correlationId, 'Recommendation');
        recommendationsResult = await this.sendMessageToAgentWithCircuitBreaker('Recommendation', recommendationMessage);

        if (recommendationsResult.success) {
          const qualityScore = this.evaluateRecommendationQuality(recommendationsResult.data, state);
          state.qualityScore = qualityScore;

          if (qualityScore > 0.8) {
            this.logger.info(`[${correlationId}] High quality recommendations generated.`, logContext);
            break;
          } else if (qualityScore > 0.6) {
            this.logger.warn(`[${correlationId}] Moderate quality, attempting to refine recommendations...`, logContext);
            const refinementMessage = createAgentMessage(MessageTypes.REFINE_RECOMMENDATIONS, {
              currentRecommendations: recommendationsResult.data,
              qualityIssues: this.identifyQualityIssues(recommendationsResult.data, state)
            }, this.id, conversationId, correlationId, 'Recommendation');

            const refinementResult = await this.sendMessageToAgentWithCircuitBreaker('Recommendation', refinementMessage);
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
          // Continue to next attempt or break if critical failure
        }
      }

      if (!recommendationsResult.success) {
        this.logger.error(`[${correlationId}] All recommendation attempts failed. Using emergency fallback.`, logContext);
        const emergencyFallbackMessage = createAgentMessage(MessageTypes.EMERGENCY_RECOMMENDATIONS, state, this.id, conversationId, correlationId, 'Fallback');
        const fallbackResult = await this.sendMessageToAgentWithCircuitBreaker('Fallback', emergencyFallbackMessage);
        if (fallbackResult.success) {
          state.recommendations = fallbackResult.data;
        } else {
          state.errors.push(fallbackResult.error);
          this.logger.error(`[${correlationId}] Emergency fallback failed: ${fallbackResult.error.message}`, logContext);
          throw fallbackResult.error;
        }
      } else {
        state.recommendations = recommendationsResult.data;
      }

      // Phase 4: Shopping & Availability (Parallel with Prioritization)
      this.logger.info(`[${correlationId}] Phase 4: Finding available wines...`, logContext);
      state.phase = 'SHOPPING_COMPLETE';

      const wineRecommendations = state.recommendations.wines || [];
      const shoppingPromises = wineRecommendations.map((wine: any, index: number) =>
        this.sendMessageToAgentWithCircuitBreaker(
          'Shopper',
          createAgentMessage(MessageTypes.FIND_WINES, {
            wine: wine,
            budget: state.budget,
            priority: index,
            maxResults: index === 0 ? 10 : 5
          }, this.id, conversationId, correlationId, 'Shopper')
        )
      );

      const shoppingResults = await Promise.all(shoppingPromises);
      const availableOptions = this.processShoppingResults(shoppingResults, state);

      if (availableOptions.length === 0) {
        this.logger.warn(`[${correlationId}] No wines available! Expanding search...`, logContext);
        const expandedSearchMessage = createAgentMessage(MessageTypes.EXPANDED_SEARCH, {
          originalCriteria: state.recommendations,
          budget: state.budget * 1.2,
          alternativeVarietals: true
        }, this.id, conversationId, correlationId, 'Shopper');

        const expandedSearchResult = await this.sendMessageToAgentWithCircuitBreaker('Shopper', expandedSearchMessage);
        if (expandedSearchResult.success) {
          availableOptions.push(...expandedSearchResult.data.wines);
        } else {
          state.errors.push(expandedSearchResult.error);
          this.logger.error(`[${correlationId}] Expanded search failed: ${expandedSearchResult.error.message}`, logContext);
          // Decide if this is a critical failure or if we can proceed with no wines
        }
      }
      state.availableWines = availableOptions;

      // Phase 5: Final Assembly & Presentation
      this.logger.info(`[${correlationId}] Phase 5: Assembling final recommendation...`, logContext);
      state.phase = 'FINALIZED';

      const finalRecommendation = await this.finalizeRecommendation(state, correlationId);

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
        const result = await this.communicationBus.sendMessageAndWaitForResponse(message.targetAgent || '', message);
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

  private evaluateRecommendationQuality(recommendations: any, state: ConversationState): number {
    // TODO: Implement logic to evaluate the quality of recommendations
    // Factors: relevance to ingredients, user preferences, budget, diversity, etc.
    this.logger.debug(`Evaluating recommendation quality for conversation: ${state.conversationId}`);
    return 0.9; // Placeholder
  }

  private identifyQualityIssues(recommendations: any, state: ConversationState): string[] {
    // TODO: Implement logic to identify specific quality issues
    this.logger.debug(`Identifying quality issues for conversation: ${state.conversationId}`);
    return []; // Placeholder
  }

  private processShoppingResults(shoppingResults: Result<any, AgentError>[], state: ConversationState): any[] {
    // TODO: Implement logic to process shopping results, filter, and consolidate
    this.logger.debug(`Processing shopping results for conversation: ${state.conversationId}`);
    const available: any[] = [];
    shoppingResults.forEach(result => {
      if (result.success && result.data.availableOptions) {
        available.push(...result.data.availableOptions);
      } else if (!result.success) { // Corrected type narrowing
        state.errors.push(result.error);
        this.logger.error(`Error in shopping result: ${result.error.message}`);
      }
    });
    return available; // Placeholder
  }

  private async finalizeRecommendation(state: ConversationState, correlationId: string): Promise<FinalRecommendation> {
    // TODO: Implement final ranking, explanation generation, and confidence scoring
    this.logger.info(`[${correlationId}] Finalizing recommendation for conversation: ${state.conversationId}`);

    const primaryRecommendation = state.availableWines && state.availableWines.length > 0 ? state.availableWines[0] : null;
    const alternatives = state.availableWines ? state.availableWines.slice(1, 4) : [];

    const explanation = await this.generateExplanation(primaryRecommendation, state.ingredients, state.userPreferences, correlationId, state); // Pass state to generateExplanation
    const confidence = this.calculateConfidence(state);

    // Learning: Update preferences based on recommendation (fire and forget message)
    this.communicationBus.publishToAgent( // Changed to publishToAgent
      'Preference', // Target agent
      createAgentMessage(MessageTypes.UPDATE_RECOMMENDATION_HISTORY, {
        userId: state.userId,
        recommendation: primaryRecommendation,
        context: state
      }, this.id, state.conversationId, correlationId, 'Preference')
    );

    return {
      primaryRecommendation,
      alternatives,
      explanation,
      confidence,
      conversationId: state.conversationId,
      canRefine: confidence < 0.9 // Offer refinement if not highly confident
    };
  }

  private async generateExplanation(wine: any, ingredients: string[], preferences: any, correlationId: string, state: ConversationState): Promise<string> { // Added state parameter
    // TODO: Call ExplanationAgent to generate a natural language explanation
    this.logger.debug(`[${correlationId}] Generating explanation for wine: ${wine?.name}`);
    const explanationMessage = createAgentMessage(MessageTypes.GENERATE_EXPLANATION, {
      wine, ingredients, preferences
    }, this.id, state.conversationId, correlationId, 'Explanation');

    const explanationResult = await this.sendMessageToAgentWithCircuitBreaker('Explanation', explanationMessage);
    if (explanationResult.success) {
      return explanationResult.data.explanation;
    } else {
      this.logger.error(`[${correlationId}] Failed to generate explanation: ${explanationResult.error.message}`);
      return `Could not generate a detailed explanation for this wine.`;
    }
  }

  private calculateConfidence(state: ConversationState): number {
    // TODO: Implement logic to calculate overall confidence based on quality score, errors, etc.
    this.logger.debug(`Calculating confidence for conversation: ${state.conversationId}`);
    return state.qualityScore; // Placeholder
  }
}