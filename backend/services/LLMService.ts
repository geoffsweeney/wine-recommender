import { injectable, inject } from 'tsyringe';
import { TYPES } from '../di/Types'; // Import the TYPES symbol
import { Result } from '../core/types/Result'; // Import Result type
import { AgentError } from '../core/agents/AgentError'; // Import AgentError
import winston from 'winston'; // Import winston for logger type

/**
 * Interface for logger dependency.
 */
export interface ILogger extends winston.Logger {} // Extend winston.Logger for consistency

/**
 * Service for interacting with the Language Model (LLM).
 * This service abstracts the specifics of the LLM provider.
 */
interface LLMResponse {
    response: string; // Ollama's generate API uses 'response' field for the output
}

@injectable()
export class LLMService {
    private apiUrl: string;
    private model: string;
    private apiKey?: string;
    private maxRetries: number;
    private retryDelayMs: number;

    constructor(
        @inject(TYPES.LlmApiUrl) apiUrl: string,
        @inject(TYPES.LlmModel) model: string,
        @inject(TYPES.LlmApiKey) apiKey: string = '',
        @inject(TYPES.Logger) public logger: ILogger,
        @inject(TYPES.LlmMaxRetries) maxRetries: number = 3, // Default to 3 retries
        @inject(TYPES.LlmRetryDelayMs) retryDelayMs: number = 1000 // Default to 1000ms delay
    ) {
        this.apiUrl = apiUrl;
        this.model = model;
        this.apiKey = apiKey;
        this.maxRetries = maxRetries;
        this.retryDelayMs = retryDelayMs;
        this.logger.info(`LLMService initialized for Ollama at ${this.apiUrl} with model: ${this.model}, maxRetries: ${this.maxRetries}, retryDelayMs: ${this.retryDelayMs}`);
    }

    /**
     * Sends a prompt to the LLM and returns the response.
     * Implements basic retry logic.
     * @param prompt The prompt to send to the LLM.
     * @param correlationId The correlation ID for tracing.
     * @returns A promise that resolves with a Result containing the LLM's response (string) or an AgentError.
     */
    async sendPrompt(prompt: string, correlationId: string = 'N/A'): Promise<Result<string, AgentError>> {
        this.logger.debug(`Sending prompt to LLM: ${prompt} (Correlation ID: ${correlationId})`);
        this.logger.info(`LLM Call: Model - ${this.model}, Prompt Length - ${prompt.length} characters. Correlation ID: ${correlationId}`);

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.apiUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt,
                        stream: false
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    this.logger.error(`Ollama API error: ${response.status} - ${errorText} (Correlation ID: ${correlationId}, Attempt: ${attempt + 1}/${this.maxRetries})`);
                    
                    // Only retry on specific transient errors (e.g., 5xx, 429 Too Many Requests)
                    if (response.status >= 500 || response.status === 429) {
                        if (attempt < this.maxRetries - 1) {
                            this.logger.warn(`Retrying LLM call in ${this.retryDelayMs}ms... (Attempt ${attempt + 1}/${this.maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
                            continue; // Continue to next attempt
                        }
                    }
                    // For non-retryable errors or last attempt, return failure
                    return { success: false, error: new AgentError(`Ollama API error: ${response.status} - ${errorText}`, 'LLM_API_ERROR', 'LLMService', correlationId, true, { statusCode: response.status, responseBody: errorText }) };
                }

                const data = await response.json() as LLMResponse;
                if (data && typeof data.response === 'string') {
                    this.logger.debug(`Received Ollama response: ${data.response}`);
                    this.logger.info(`LLM Response: Length - ${data.response.length} characters.`);
                    return { success: true, data: data.response };
                } else {
                    this.logger.error(`Invalid response format from Ollama API (Correlation ID: ${correlationId}, Attempt: ${attempt + 1}/${this.maxRetries})`);
                    return { success: false, error: new AgentError('Invalid response format from Ollama API', 'LLM_INVALID_RESPONSE_FORMAT', 'LLMService', correlationId, true, { responseBody: data }) };
                }

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.debug(`Caught error in sendPrompt (Correlation ID: ${correlationId}, Attempt: ${attempt + 1}/${this.maxRetries}).`);
                this.logger.error(`Error sending prompt to LLM: ${errorMessage}`);

                // Only retry on network errors (TypeError)
                if (error instanceof TypeError) {
                    if (attempt < this.maxRetries - 1) {
                        this.logger.warn(`Retrying LLM call due to network error in ${this.retryDelayMs}ms... (Attempt ${attempt + 1}/${this.maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
                        continue; // Continue to next attempt
                    }
                    return { success: false, error: new AgentError(`Network error communicating with LLM: ${errorMessage}`, 'LLM_NETWORK_ERROR', 'LLMService', correlationId, false, { originalError: errorMessage }) };
                }
                // For non-retryable errors or last attempt, return failure
                return { success: false, error: new AgentError(`Unexpected error in LLMService: ${errorMessage}`, 'LLM_UNEXPECTED_ERROR', 'LLMService', correlationId, false, { originalError: errorMessage }) };
            }
        }
        // Should not be reached if maxRetries is 0 or more, but for type safety
        return { success: false, error: new AgentError('Max retries reached for LLM call', 'LLM_MAX_RETRIES_REACHED', 'LLMService', correlationId, false) };
    }
}