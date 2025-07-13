import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService';
import { UserProfileService } from '../../services/UserProfileService'; // Import UserProfileService
import { ICommunicatingAgentDependencies, TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { LogContext } from '../../types/LogContext';
import { PreferenceExtractionResultPayload, PreferenceExtractionResultPayloadSchema } from '../../types/agent-outputs'; // Import schema
import { ExtractPreferencesVars } from '../../services/PromptManager'; // Import ExtractPreferencesVars

interface LLMPreferenceExtractorMessagePayload {
  input: string;
  conversationHistory?: { role: string; content: string }[];
  userId: string;
  originalSourceAgent?: string; // Added to pass the original source agent
}

// Define the configuration interface for LLMPreferenceExtractorAgent
export interface LLMPreferenceExtractorAgentConfig {
  maxRetries: number;
}

@injectable()
export class LLMPreferenceExtractorAgent extends CommunicatingAgent {
  constructor(
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(TYPES.KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(PreferenceNormalizationService) private readonly preferenceNormalizationService: PreferenceNormalizationService,
    @inject(UserProfileService) private readonly userProfileService: UserProfileService, // Inject UserProfileService
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.LLMPreferenceExtractorAgentConfig) private readonly agentConfig: LLMPreferenceExtractorAgentConfig, // Inject agent config
    @inject(TYPES.CommunicatingAgentDependencies) dependencies: ICommunicatingAgentDependencies // Inject dependencies for base class
  ) {
    const id = 'llm-preference-extractor';
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
      MessageTypes.PREFERENCE_EXTRACTION_REQUEST,
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
      const { input, conversationHistory, userId } = payload;
      const currentPreferences = await this.userProfileService.getPreferences(userId);

      const llmVariables: ExtractPreferencesVars = {
        userInput: input,
        conversationContext: conversationHistory ? conversationHistory.slice(-5) : [],
      };

      let lastError: AgentError | undefined;
       
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          this.logger.debug(`[${correlationId}] LLMPreferenceExtractorAgent: Calling LLMService.sendStructuredPrompt for attempt ${attempt + 1}`);
          const llmResponseResult = await this.llmService.sendStructuredPrompt<'extractPreferences', PreferenceExtractionResultPayload>(
            'extractPreferences',
            llmVariables as ExtractPreferencesVars, // Cast to ExtractPreferencesVars
            { correlationId, agentId: this.id, operation: 'sendStructuredPrompt:extractPreferences' } // Pass LogContext
          );
          this.logger.debug(`[${correlationId}] LLMPreferenceExtractorAgent: LLMService.sendStructuredPrompt result success: ${llmResponseResult.success}`);
          if (!llmResponseResult.success) {
            this.logger.debug(`[${correlationId}] LLMPreferenceExtractorAgent: LLMService.sendStructuredPrompt failed with error: ${llmResponseResult.error?.message}`);
            throw llmResponseResult.error;
          }
          const extractedPreferences = llmResponseResult.data;
          this.logger.debug(`[${correlationId}] LLMPreferenceExtractorAgent: Extracted preferences: ${JSON.stringify(extractedPreferences)}`);
           
           const responseMessage = createAgentMessage(
             'preference-extraction-response',
             { ...extractedPreferences, originalSourceAgent: payload.originalSourceAgent }, // Include originalSourceAgent in the response payload
             this.id,
             message.conversationId, // Corrected: conversationId
             correlationId, // Corrected: correlationId
             message.sourceAgent // Corrected: targetAgent
           );
           this.logger.info(`[${correlationId}] Preference extraction successful on attempt ${attempt + 1}`, { agentId: this.id, operation: 'handleExtractionRequestWithRetry' });
           return { success: true, data: responseMessage }; // Return the message, don't send it via sendResponse
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
       message.conversationId, // Corrected: conversationId
       correlationId, // Corrected: correlationId
       message.sourceAgent // Corrected: targetAgent
     );
     this.logger.error(`[${correlationId}] Error in LLMPreferenceExtractorAgent: ${error.message}`, { agentId: this.id, operation: 'handleError', originalError: error.message });
     // The error message should be returned, not sent via sendResponse
   }
 
   
}
