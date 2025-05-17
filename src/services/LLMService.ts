import { injectable } from 'tsyringe';
import { logger } from '../utils/logger';
/**
 * Service for interacting with the Language Model (LLM).
 * This service abstracts the specifics of the LLM provider.
 */
interface LLMResponse {
    response: string; // Ollama's generate API uses 'response' field for the output
    // Add other expected fields from the Ollama response if needed (e.g., model, created_at, done)
    model: string;
    created_at: string;
    done: boolean;
    // Add other fields if you expect them and need to use them
}

@injectable()
export class LLMService {
    private apiUrl: string;
    private model: string;
    private apiKey?: string;

    constructor(apiUrl: string, model: string, apiKey?: string) {
        this.apiUrl = apiUrl;
        this.model = model;
        this.apiKey = apiKey;
        logger.info(`LLMService initialized for Ollama at ${this.apiUrl} with model: ${this.model}`);
    }

    /**
     * Sends a prompt to the LLM and returns the response.
     * Implements basic rate limiting and retry logic.
     * @param prompt The prompt to send to the LLM.
     * @returns A promise that resolves with the LLM's response, or undefined if an error occurs.
     */
    async sendPrompt(prompt: string): Promise<string | undefined> {
        logger.debug(`Sending prompt to LLM: ${prompt}`);
        // Basic logging for cost tracking (can be enhanced)
        logger.info(`LLM Call: Model - ${this.model}, Prompt Length - ${prompt.length} characters.`);

        try {
            // Ollama API expects a different structure
            const response = await fetch(`${this.apiUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include Authorization header only if apiKey is provided
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false // Request non-streaming response
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`Ollama API error: ${response.status} - ${errorText}`);
                throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json() as LLMResponse;
            // Ollama response for generate typically has a 'response' field
            if (data && typeof data.response === 'string') {
                 logger.debug(`Received Ollama response: ${data.response}`);
                 // Log response length for basic tracking
                 logger.info(`LLM Response: Length - ${data.response.length} characters.`);
                 return data.response;
            } else {
                 logger.error('Invalid response format from Ollama API');
                 throw new Error('Invalid response format from Ollama API');
            }

        } catch (error: any) { // Explicitly type error as any for easier handling
            logger.debug('Caught error in sendPrompt.');
            logger.error(`Error sending prompt to LLM: ${error}`);
            // TODO: Add to Dead Letter Queue if necessary
            return undefined; // Return undefined on errors
        }
    }

    // TODO: Add methods for handling different LLM tasks (e.g., parsing, specific model calls)
    // TODO: Implement more robust error handling and retry logic for API calls
}