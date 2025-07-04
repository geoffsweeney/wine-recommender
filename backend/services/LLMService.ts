import { injectable, inject } from 'tsyringe';
import { TYPES } from '../di/Types'; // Import the TYPES symbol
import { Result } from '../core/types/Result'; // Import Result type
import { AgentError } from '../core/agents/AgentError'; // Import AgentError
import winston from 'winston'; // Import winston for logger type
import { OllamaStructuredClient } from '../utils/ollama_structured_output'; // Import the new client
import { z } from 'zod'; // Import Zod
import { zodToJsonSchema } from 'zod-to-json-schema'; // Import zodToJsonSchema

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
    private ollamaClient: OllamaStructuredClient; // Use the new structured client
    private model: string;
    private maxRetries: number;
    private retryDelayMs: number;

    constructor(
        @inject(TYPES.LlmApiUrl) private apiUrl: string, // Keep apiUrl for OllamaStructuredClient
        @inject(TYPES.LlmModel) model: string,
        @inject(TYPES.LlmApiKey) apiKey: string = '',
        @inject(TYPES.Logger) public logger: ILogger,
        @inject(TYPES.LlmMaxRetries) maxRetries: number = 3, // Default to 3 retries
        @inject(TYPES.LlmRetryDelayMs) retryDelayMs: number = 1000 // Default to 1000ms delay
    ) {
        this.model = model;
        this.maxRetries = maxRetries;
        this.retryDelayMs = retryDelayMs;
        this.ollamaClient = new OllamaStructuredClient({
            host: apiUrl,
            model: model,
            apiKey: apiKey,
            temperature: 0.7, // Default temperature for structured output
            numPredict: 2048, // Default num_predict
            defaultOptions: {
                top_p: 0.9,
                repeat_penalty: 1.1
            }
        });
        this.logger.info(`LLMService initialized for Ollama at ${this.apiUrl} with model: ${this.model}, maxRetries: ${this.maxRetries}, retryDelayMs: ${this.retryDelayMs}`);
    }

    /**
     * Sends a prompt to the LLM and returns the response.
     * Implements basic retry logic.
     * @param prompt The prompt to send to the LLM.
     * @param correlationId The correlation ID for tracing.
     * @returns A promise that resolves with a Result containing the LLM's response (string) or an AgentError.
     */
    /**
     * Sends an unstructured prompt to the LLM and returns the raw string response.
     * This method is for general text generation, not structured output.
     * @param prompt The prompt to send to the LLM.
     * @param correlationId The correlation ID for tracing.
     * @returns A promise that resolves with a Result containing the LLM's response (string) or an AgentError.
     */
    async sendPrompt(prompt: string, correlationId: string = 'N/A'): Promise<Result<string, AgentError>> {
        this.logger.debug(`Sending unstructured prompt to LLM: ${prompt} (Correlation ID: ${correlationId})`);
        this.logger.info(`LLM Call (unstructured): Model - ${this.model}, Prompt Length - ${prompt.length} characters. Correlation ID: ${correlationId}`);
 
        try {
            const response = await this.ollamaClient.ollama.generate({
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: this.ollamaClient.defaultOptions.temperature,
                    num_predict: this.ollamaClient.defaultOptions.num_predict
                }
            });
 
            if (response && response.response) {
                this.logger.debug(`Received unstructured Ollama response: ${response.response}`);
                this.logger.info(`LLM Response (unstructured): Length - ${response.response.length} characters.`);
                return { success: true, data: response.response };
            } else {
                this.logger.error(`Invalid unstructured response format from Ollama API (Correlation ID: ${correlationId})`);
                return { success: false, error: new AgentError('Invalid unstructured response format from Ollama API', 'LLM_INVALID_RESPONSE_FORMAT', 'LLMService', correlationId, true, { responseBody: response }) };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error sending unstructured prompt to LLM: ${errorMessage} (Correlation ID: ${correlationId})`);
            return { success: false, error: new AgentError(`Error in LLMService (unstructured): ${errorMessage}`, 'LLM_UNEXPECTED_ERROR', 'LLMService', correlationId, false, { originalError: errorMessage }) };
        }
    }
 
    /**
     * Sends a structured prompt to the LLM with a JSON schema and returns the parsed object.
     * @param prompt The prompt to send to the LLM.
     * @param schema The JSON schema for the expected output.
     * @param zodSchema Optional Zod schema for additional validation.
     * @param correlationId The correlation ID for tracing.
     * @returns A promise that resolves with a Result containing the parsed LLM's response (object) or an AgentError.
     */
    async sendStructuredPrompt<T>(prompt: string, schema: object | z.ZodObject<any, any, any>, zodSchema: z.ZodObject<any, any, any> | null = null, llmOptions: { temperature?: number; num_predict?: number } = {}, correlationId: string = 'N/A'): Promise<Result<T, AgentError>> {
        let jsonSchema: object;
        let validationSchema: z.ZodObject<any, any, any> | null;

        if (schema instanceof z.ZodObject) {
            jsonSchema = zodToJsonSchema(schema); // Convert Zod schema to JSON schema
            validationSchema = schema;
        } else {
            jsonSchema = schema;
            validationSchema = zodSchema;
        }

        this.logger.debug(`Sending structured prompt to LLM: ${prompt} (Correlation ID: ${correlationId}) with schema: ${JSON.stringify(jsonSchema)}`);
        this.logger.info(`LLM Call (structured): Model - ${this.model}, Prompt Length - ${prompt.length} characters. Correlation ID: ${correlationId}`);
 
        try {
            const parsedResponse = await this.ollamaClient.generateStructured(prompt, jsonSchema, validationSchema, {
                options: {
                    temperature: llmOptions.temperature !== undefined ? llmOptions.temperature : this.ollamaClient.defaultOptions.temperature,
                    num_predict: llmOptions.num_predict !== undefined ? llmOptions.num_predict : 4096 // Increased num_predict
                }
            });
            this.logger.debug(`Received structured Ollama response: ${JSON.stringify(parsedResponse)}`);
            this.logger.info(`LLM Response (structured): Length - ${JSON.stringify(parsedResponse).length} characters.`);
            // Create a new object to ensure type safety and add missing fields
            const finalResponse: any = {
                recommendations: parsedResponse.recommendations || [],
                confidence: parsedResponse.confidence === undefined || parsedResponse.confidence === null ? 0 : parsedResponse.confidence,
                reasoning: parsedResponse.reasoning || "No reasoning provided.",
                pairingNotes: parsedResponse.pairingNotes || "",
                alternatives: parsedResponse.alternatives || [],
                primaryRecommendation: null // Default to null
            };

            if (finalResponse.recommendations && finalResponse.recommendations.length > 0) {
                finalResponse.primaryRecommendation = finalResponse.recommendations[0];
            }

            // Now, cast to the expected type T
            return { success: true, data: finalResponse as T };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error sending structured prompt to LLM: ${errorMessage} (Correlation ID: ${correlationId})`);
            
            // Check for JSON parsing errors specifically
            if (errorMessage.includes('JSON') && (errorMessage.includes('Unterminated string') || errorMessage.includes('Expected'))) {
                return { success: false, error: new AgentError(`LLM returned malformed JSON: ${errorMessage}`, 'LLM_MALFORMED_JSON', 'LLMService', correlationId, true, { originalError: errorMessage }) };
            }

            return { success: false, error: new AgentError(`Error in LLMService (structured): ${errorMessage}`, 'LLM_UNEXPECTED_ERROR', 'LLMService', correlationId, false, { originalError: errorMessage }) };
        }
    }
}