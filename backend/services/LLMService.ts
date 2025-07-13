import { inject, injectable } from 'tsyringe';
import { AgentError } from '../core/agents/AgentError';
import { Result } from '../core/types/Result';
import { ILogger, TYPES } from '../di/Types';
import { LogContext } from '../types/LogContext';
import { failure, success } from '../utils/result-utils';
import { PromptManager, PromptTask, PromptTemplate, PromptVariables } from './PromptManager';
import { z } from 'zod'; // Added import for Zod

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}

// Assuming these types exist for LLM configuration
interface LLMServiceConfig {
  apiUrl: string;
  model: string;
  apiKey: string; // Ollama typically doesn't use an API key, but keeping it for consistency
}

export interface ILLMService {
  sendPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<string, AgentError>>;

  sendStructuredPrompt<T extends keyof PromptTemplate, U>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<U, AgentError>>;
}

@injectable()
export class LLMService implements ILLMService {
  private config: LLMServiceConfig;

  constructor(
    @inject(TYPES.PromptManager) private promptManager: PromptManager,
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.LlmApiUrl) private apiUrl: string,
    @inject(TYPES.LlmModel) private model: string,
    @inject(TYPES.LlmApiKey) private apiKey: string
  ) {
    this.config = { apiUrl, model, apiKey };
  }

  public async sendPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<string, AgentError>> {
    const startTime = Date.now();
    this.logger.info('Sending LLM prompt', { ...logContext, task: String(task) });

    try {
      await this.promptManager.ensureLoaded();

      const systemPromptResult = await this.promptManager.getSystemPrompt();
      const promptResult = await this.promptManager.getPrompt(task, variables);

      if (!promptResult.success) {
        this.logger.error('Failed to get prompt from PromptManager', {
          ...logContext,
          task: String(task),
          error: promptResult.error.message,
        });
        return failure(
          new AgentError(
            `Failed to get prompt for task ${String(task)}: ${promptResult.error.message}`,
            'LLM_PROMPT_ERROR',
            'LLMService',
            logContext.correlationId || 'unknown',
            true, // Recoverable
          ),
        );
      }

      const fullPrompt = promptResult.data;

      const llmResponse = await this.callLlmApi(systemPromptResult, fullPrompt, logContext);

      this.logger.info('LLM prompt sent successfully', {
        ...logContext,
        task: String(task),
        duration: Date.now() - startTime,
      });

      return success(llmResponse);
    } catch (error) {
      this.logger.error('Error sending LLM prompt', {
        ...logContext,
        task: String(task),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return failure(
        new AgentError(
          `Error sending LLM prompt for task ${String(task)}: ${error instanceof Error ? error.message : String(error)}`,
          'LLM_API_CALL_FAILED',
          'LLMService',
          logContext.correlationId || 'unknown',
          true, // Recoverable
          { originalError: error instanceof Error ? error.message : String(error) },
        ),
      );
    }
  }

  public async sendStructuredPrompt<T extends keyof PromptTemplate, U>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables,
    logContext: LogContext
  ): Promise<Result<U, AgentError>> {
    const startTime = Date.now();
    this.logger.debug(`LLMService: Entering sendStructuredPrompt. Task: ${String(task)}, Raw Variables: ${JSON.stringify(variables)}`);
    this.logger.info('Sending structured LLM prompt', { ...logContext, task: String(task) });
    this.logger.debug(`LLMService: sendStructuredPrompt called with task: ${String(task)}, variables: ${JSON.stringify(variables)}`); // Existing log

    await this.promptManager.ensureLoaded();

    const outputSchema = this.promptManager.getOutputSchemaForTask(task);
    if (!outputSchema) {
      this.logger.error(`No output schema found for task ${String(task)}`, { ...logContext, task: String(task) });
      return failure(
        new AgentError(
          `No output schema found for task ${String(task)}`,
          'LLM_STRUCTURED_PROMPT_ERROR',
          'LLMService',
          logContext.correlationId || 'unknown',
          false, // Not recoverable, as schema is missing
        ),
      );
    }

    try {
      await this.promptManager.ensureLoaded();

      const systemPromptResult = await this.promptManager.getSystemPrompt();
      const promptResult = await this.promptManager.getPrompt(task, variables);

      if (!promptResult.success) {
        this.logger.error('Failed to get prompt from PromptManager for structured output', {
          ...logContext,
          task: String(task),
          error: promptResult.error.message,
        });
        return failure(
          new AgentError(
            `Failed to get structured prompt for task ${String(task)}: ${promptResult.error.message}`,
            'LLM_STRUCTURED_PROMPT_ERROR',
            'LLMService',
            logContext.correlationId || 'unknown',
            true, // Recoverable
          ),
        );
      }

      const fullPrompt = promptResult.data;

      const llmResponse = await this.callStructuredLlmApi(systemPromptResult, fullPrompt, logContext);

      // Validate the LLM response against the provided outputSchema
      try {
        this.logger.debug(`LLMService: Raw LLM response before validation: ${JSON.stringify(llmResponse)}`, logContext);
        const parsedResponse = outputSchema.parse(llmResponse);
        this.logger.info('Structured LLM prompt sent successfully and response validated', {
          ...logContext,
          task: String(task),
          duration: Date.now() - startTime,
        });
        return success(parsedResponse as U);
      } catch (validationError) {
        this.logger.error('Invalid LLM response: Failed to validate against output schema', {
          ...logContext,
          task: String(task),
          error: validationError instanceof Error ? validationError.message : String(validationError),
          response: llmResponse,
        });
        return failure(
          new AgentError(
            `Invalid LLM response: Failed to validate against output schema: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
            'LLM_RESPONSE_VALIDATION_ERROR',
            'LLMService',
            logContext.correlationId || 'unknown',
            true, // Recoverable
            { originalError: validationError instanceof Error ? validationError.message : String(validationError) },
          ),
        );
      }
    } catch (error) {
      this.logger.error('Error sending structured LLM prompt', {
        ...logContext,
        task: String(task),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return failure(
        new AgentError(
          `Error sending structured LLM prompt for task ${String(task)}: ${error instanceof Error ? error.message : String(error)}`,
          'LLM_STRUCTURED_API_CALL_FAILED',
          'LLMService',
          logContext.correlationId || 'unknown',
          true, // Recoverable
          { originalError: error instanceof Error ? error.message : String(error) },
        ),
      );
    }
  }

  private async callLlmApi(systemPrompt: string, userPrompt: string, logContext: LogContext): Promise<string> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${this.config.apiKey}`, // Ollama typically doesn't use API keys
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false, // We want a single response
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API call failed with status ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      return data.message.content;
    } catch (error) {
      this.logger.error('Error during Ollama API call', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to be caught by the calling method
    }
  }

  private async callStructuredLlmApi(systemPrompt: string, userPrompt: string, logContext: LogContext): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          format: 'json', // Request JSON format
          stream: false,
          // Ollama doesn't directly support 'response_model' like some other LLMs,
          // but 'format: "json"' combined with a good system prompt usually suffices.
          // If a specific JSON schema validation is needed, it would be done client-side.
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama structured API call failed with status ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      // Ollama returns the JSON object directly in data.message.content if format: 'json' is used.
      // It might be a stringified JSON, so we need to parse it.
      try {
        return JSON.parse(data.message.content);
      } catch (parseError) {
        this.logger.error('Failed to parse structured LLM response as JSON', {
          ...logContext,
          responseContent: data.message.content,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
        throw new Error('Invalid JSON response from LLM');
      }
    } catch (error) {
      this.logger.error('Error during Ollama structured API call', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to be caught by the calling method
    }
  }
}
