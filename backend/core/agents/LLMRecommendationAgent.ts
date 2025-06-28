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
import { RecommendationResult } from '../../types/agent-outputs'; // Import RecommendationResult

interface LLMRecommendationRequestPayload {
  preferences?: Record<string, any>;
  message?: string;
  ingredients?: string[];
  recommendationSource?: 'knowledgeGraph' | 'llm';
  conversationHistory: Array<{ role: string; content: string }>;
}

interface LLMRecommendationResponsePayload {
  wines: string[];
  confidenceScore?: number;
  alternatives?: string[];
}

// Define the configuration interface for LLMRecommendationAgent
export interface LLMRecommendationAgentConfig {
  // Add any specific configuration for LLMRecommendationAgent here
  // For example, default confidence score, LLM model parameters, etc.
  defaultConfidenceScore: number;
}

@injectable()
export class LLMRecommendationAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.LLMRecommendationAgentConfig) private readonly agentConfig: LLMRecommendationAgentConfig // Inject agent config
  ) {
    const id = 'llm-recommendation';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies); // Pass agentConfig as the config for BaseAgent
    this.registerHandlers();
    this.logger.info(`[${this.id}] LLMRecommendationAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'LLMRecommendationAgent';
  }

  public getCapabilities(): string[] {
    return [
      'llm-recommendation',
      'conversational-recommendation',
      'preference-analysis',
      'ingredient-matching',
      'confidence-scoring'
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
    this.logger.info(`[${correlationId}] Processing recommendation request`, { agentId: this.id, operation: 'handleRecommendationRequest' });

    try {
      const payload = message.payload as LLMRecommendationRequestPayload; // Cast payload here

      if (!payload) {
        const error = new AgentError('Missing payload in recommendation request', 'MISSING_PAYLOAD', this.id, correlationId);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-validation', correlationId });
        return { success: false, error };
      }
      const prompt = this.buildPrompt(payload);
      // Simulate an error for testing fallback
      if (prompt.includes('simulate_error')) { // Use a specific prompt to trigger error
        const error = new AgentError('Simulated LLM error for fallback test', 'SIMULATED_LLM_ERROR', this.id, correlationId, true);
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-simulated-error', correlationId });
        return { success: false, error };
      }

      const llmResponseResult = await this.llmService.sendStructuredPrompt<RecommendationResult>(prompt, RecommendationSchema, null, correlationId);
      if (!llmResponseResult.success) {
        const error = new AgentError(`LLM service failed: ${llmResponseResult.error.message}`, 'LLM_SERVICE_ERROR', this.id, correlationId, true, { originalError: llmResponseResult.error.message });
        await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'recommendation-llm-failure', correlationId });
        return { success: false, error };
      }
      const parsedRecommendation = llmResponseResult.data;
      this.logger.debug(`[${correlationId}] Successfully parsed LLM response into RecommendationResult: ${JSON.stringify(parsedRecommendation)}`);

      const responseMessage = createAgentMessage(
        'llm-recommendation-response',
        {
          recommendation: parsedRecommendation, // Send the parsed object
          confidenceScore: this.agentConfig.defaultConfidenceScore // Use injected config
        },
        this.id,
        correlationId,
        message.sourceAgent
      );
      this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
      this.logger.info(`[${correlationId}] Recommendation request processed successfully`, { agentId: this.id, operation: 'handleRecommendationRequest' });
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = error instanceof AgentError ? error : new AgentError(errorMessage, 'LLM_RECOMMENDATION_EXCEPTION', this.id, correlationId, true, { originalError: errorMessage });
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'recommendation-exception', correlationId });
      this.logger.error(`[${correlationId}] Failed to process LLM recommendation request: ${errorMessage}`, { agentId: this.id, operation: 'handleRecommendationRequest', originalError: errorMessage });
      return { success: false, error: agentError };
    }
  }

  private buildPrompt(payload: LLMRecommendationRequestPayload): string {
    const examples = [
      'Example 1:',
      'Input: "I want a bold red wine for steak"',
      'Output: { "recommendations": ["Cabernet Sauvignon", "Malbec"], "confidence": 0.9, "reasoning": "These full-bodied reds pair well with red meat" }',
      '\nExample 2:',
      'Input: "Light white wine for seafood"',
      'Output: { "recommendations": ["Sauvignon Blanc", "Pinot Grigio"], "confidence": 0.85, "reasoning": "These crisp whites complement seafood" }'
    ].join('\n');

    let prompt = `You are a wine expert. Analyze the request and provide recommendations in JSON format:\n${examples}\n\nCurrent request:`;

    if (payload.message) {
      prompt += `\nInput: "${payload.message}"`;
    }

    if (payload.preferences && Object.keys(payload.preferences).length > 0) {
      prompt += `\nPreferences: ${JSON.stringify(payload.preferences)}`;
    }

    if (payload.ingredients && payload.ingredients.length > 0) {
      prompt += `\nIngredients: ${payload.ingredients.join(', ')}`;
    }

    if (payload.conversationHistory && payload.conversationHistory.length > 0) {
      prompt += "\nConversation context:";
      payload.conversationHistory.forEach(turn => {
        prompt += `\n${turn.role}: ${turn.content}`;
      });
    }

    prompt += '\nOutput JSON:';
    return prompt;
  }
}

export const RecommendationSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: { type: "string" }
    },
    confidence: { type: "number" },
    reasoning: { type: "string" }
  },
  required: ["recommendations", "confidence", "reasoning"]
};