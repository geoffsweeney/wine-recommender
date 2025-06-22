import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';

interface LLMPreferenceExtractorMessagePayload {
  input: string;
  conversationHistory?: { role: string; content: string }[];
  userId: string;
}

// Define the configuration interface for LLMPreferenceExtractorAgent
export interface LLMPreferenceExtractorAgentConfig {
  maxRetries: number;
}

@injectable()
export class LLMPreferenceExtractorAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(PreferenceNormalizationService) private readonly preferenceNormalizationService: PreferenceNormalizationService,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.LLMPreferenceExtractorAgentConfig) private readonly agentConfig: LLMPreferenceExtractorAgentConfig // Inject agent config
  ) {
    const id = 'llm-preference-extractor';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] LLMPreferenceExtractorAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'LLMPreferenceExtractorAgent';
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    if (message.type === 'preference-extraction-request') {
      return this.handleExtractionRequest(message as AgentMessage<LLMPreferenceExtractorMessagePayload>);
    }
    this.logger.warn(`[${correlationId}] LLMPreferenceExtractorAgent received unhandled message type: ${message.type}`, {
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
      'preference-extraction-request',
      this.handleExtractionRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handleExtractionRequest(message: AgentMessage<unknown>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] Handling preference extraction request`, { agentId: this.id, operation: 'handleExtractionRequest' });

    const payload = message.payload as LLMPreferenceExtractorMessagePayload;
    if (!payload) {
      const error = new AgentError('Invalid message payload', 'INVALID_PAYLOAD', this.id, correlationId);
      await this.deadLetterProcessor.process(message.payload, error, { source: this.id, stage: 'extraction-validation', correlationId });
      return { success: false, error };
    }
    return this.handleExtractionRequestWithRetry(message, this.agentConfig.maxRetries);
  }

  private async handleExtractionRequestWithRetry(
    message: AgentMessage<unknown>, // Changed to unknown
    retries: number // Use injected maxRetries
  ): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    try {
      const payload = message.payload as LLMPreferenceExtractorMessagePayload; // Cast payload here
      const { input, conversationHistory } = payload;
 
       const examples = [
         'Example 1:',
         'Input: "I prefer bold red wines under $30"',
         'Output: { "isValid": true, "preferences": { "style": "bold", "color": "red", "priceRange": [0,30] }, "ingredients": [] }',
         '\nExample 2:',
         'Input: "Looking for a wine to pair with chicken and mushrooms"',
         'Output: { "isValid": true, "ingredients": ["chicken", "mushrooms"], "preferences": {} }'
       ].join('\n');
 
       const llmPrompt = `Analyze this wine request and extract structured preferences:\n${examples}\n\nCurrent request: "${input}"\n\n${
         conversationHistory ? 'Conversation context:\n' + conversationHistory.map(turn => `${turn.role}: ${turn.content}`).join('\n') : ''
       }\n\nOutput JSON matching the examples exactly:`;
 
       let lastError: AgentError | undefined;
       
       for (let attempt = 0; attempt < retries; attempt++) {
         try {
           const llmResponseResult = await this.llmService.sendPrompt(llmPrompt);
           if (!llmResponseResult.success) {
             throw llmResponseResult.error;
           }
           const llmResponse = llmResponseResult.data;
 
           const extractedPreferencesResult = await this.parseLLMResponse(llmResponse, input);
           if (!extractedPreferencesResult.success) {
             throw extractedPreferencesResult.error;
           }
           const extractedPreferences = extractedPreferencesResult.data;
           
           const responseMessage = createAgentMessage(
             'preference-extraction-response',
             extractedPreferences,
             this.id,
             correlationId,
             message.sourceAgent
           );
           this.communicationBus.sendResponse(message.sourceAgent, responseMessage);
           this.logger.info(`[${correlationId}] Preference extraction successful on attempt ${attempt + 1}`, { agentId: this.id, operation: 'handleExtractionRequestWithRetry' });
           return { success: true, data: responseMessage };
         } catch (error: unknown) {
           if (error instanceof AgentError) {
             lastError = error; // Rethrow if already an AgentError
           } else {
             lastError = new AgentError(String(error), 'LLM_RESPONSE_PARSE_ERROR', this.id, correlationId);
           }
           this.logger.warn(`[${correlationId}] Preference extraction attempt ${attempt + 1} failed: ${lastError.message}`, { error: lastError.message, correlationId: correlationId, agentId: this.id, operation: 'handleExtractionRequestWithRetry' });
           
           // Exponential backoff
           if (attempt < retries - 1) {
             await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
           }
         }
       }
       
       const finalError = lastError || new AgentError('Preference extraction failed after retries', 'EXTRACTION_RETRIES_EXCEEDED', this.id, correlationId);
       await this.handleError(message, finalError, correlationId);
       return { success: false, error: finalError };
     } catch (error: unknown) {
       const agentError = error instanceof AgentError ? error : new AgentError(String(error), 'UNEXPECTED_ERROR', this.id, correlationId);
       await this.handleError(message, agentError, correlationId);
       return { success: false, error: agentError };
     }
   }
 
   private async parseLLMResponse(response: string | undefined, input: string): Promise<Result<any, AgentError>> {
     if (!response) {
       return { success: false, error: new AgentError('No response from LLM', 'LLM_NO_RESPONSE', this.id, '') };
     }
 
     try {
       const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
       const jsonString = jsonMatch?.[1] || response;
       const result = JSON.parse(jsonString);
       
       // Calculate confidence score based on response quality
       const confidence = this.calculateConfidenceScore(result, input);
       return { success: true, data: { ...result, confidence } };
     } catch (error: unknown) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       return { success: false, error: new AgentError(`Failed to parse LLM response: ${errorMessage}`, 'LLM_PARSE_ERROR', this.id, '', true, { originalError: errorMessage }) };
     }
   }
 
   private calculateConfidenceScore(result: any, input: string): number {
     // Basic confidence scoring based on:
     // 1. Presence of key fields
     // 2. Input length vs extracted content
     // 3. Specificity of preferences
     
     let score = 0.5; // Base score
     
     if (result.isValid) {
       score += 0.2;
     }
     
     if (result.preferences && Object.keys(result.preferences).length > 0) {
       score += 0.15;
     }
     
     if (result.ingredients && result.ingredients.length > 0) {
       score += 0.15;
     }
     
     // Normalize to 0-1 range
     return Math.min(Math.max(score, 0), 1);
   }
 
   private async handleError(message: AgentMessage<unknown>, error: AgentError, correlationId: string): Promise<void> {
     await this.deadLetterProcessor.process(
       message.payload,
       error,
       { source: this.id, stage: 'PreferenceExtraction', correlationId }
     );
 
     const errorMessage = createAgentMessage(
       'error-response',
       { error: error.message, code: error.code },
       this.id,
       correlationId,
       message.sourceAgent
     );
     await this.communicationBus.sendResponse(message.sourceAgent, errorMessage);
     this.logger.error(`[${correlationId}] Error in LLMPreferenceExtractorAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
   }
 }