import { mock } from 'jest-mock-extended';
import 'reflect-metadata'; // Required for tsyringe
import { DependencyContainer, container } from 'tsyringe';
import { z } from 'zod'; // Added Zod import
import { AgentError } from '../../core/agents/AgentError';
import { ILogger, TYPES } from '../../di/Types';
import { failure, success } from '../../utils/result-utils'; // Removed Result from import
import { LLMService } from '../LLMService';
import { PromptManager, PromptTemplate, PromptVariables } from '../PromptManager';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('LLMService', () => {
  let llmService: LLMService;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockLogger: jest.Mocked<ILogger>;
  let testContainer: DependencyContainer;

  const mockLlmApiUrl = 'http://mock-ollama.com';
  const mockLlmModel = 'mock-model';
  const mockLlmApiKey = 'mock-api-key'; // Not used by Ollama, but for consistency

  const mockLogContext = {
    correlationId: 'test-correlation-id',
    operation: 'test-operation',
    agentId: 'test-agent',
  };

  beforeEach(() => {
    // Clear and reset the container for each test to ensure isolation
    container.clearInstances();
    container.reset();
    testContainer = container.createChildContainer();

    mockPromptManager = mock<PromptManager>();
    mockLogger = mock<ILogger>();

    // Register mocks with the container
    testContainer.registerInstance(TYPES.PromptManager, mockPromptManager);
    testContainer.registerInstance(TYPES.Logger, mockLogger);
    testContainer.registerInstance(TYPES.LlmApiUrl, mockLlmApiUrl);
    testContainer.registerInstance(TYPES.LlmModel, mockLlmModel);
    testContainer.registerInstance(TYPES.LlmApiKey, mockLlmApiKey);

    // Resolve LLMService from the container
    llmService = testContainer.resolve(LLMService);

    // Reset mocks for fetch
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPrompt', () => {
    const mockTask = 'recommendWines' as keyof PromptTemplate;
    const mockVariables: PromptVariables = { wineType: 'red' };
    const mockSystemPrompt = 'You are a helpful assistant.';
    const mockUserPrompt = 'Recommend a red wine.';
    const mockLlmResponseContent = 'Here is a great red wine.';

    beforeEach(() => {
      mockPromptManager.ensureLoaded.mockResolvedValue(undefined);
      mockPromptManager.getSystemPrompt.mockResolvedValue(mockSystemPrompt);
      mockPromptManager.getPrompt.mockResolvedValue(success(mockUserPrompt));
    });

    it('should send a prompt to Ollama and return success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: mockLlmResponseContent } }),
      });

      const result = await llmService.sendPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(true);
      if (result.success) { // Type guard
        expect(result.data).toBe(mockLlmResponseContent);
      } else {
        fail('Expected success, but got failure');
      }
      expect(mockPromptManager.ensureLoaded).toHaveBeenCalledTimes(1);
      expect(mockPromptManager.getSystemPrompt).toHaveBeenCalledTimes(1);
      expect(mockPromptManager.getPrompt).toHaveBeenCalledWith(mockTask, mockVariables);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(`${mockLlmApiUrl}/api/chat`, expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Sending LLM prompt', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('LLM prompt sent successfully', expect.any(Object));
    });

    it('should return failure if PromptManager.getPrompt fails', async () => {
      const promptError = new Error('Prompt not found');
      mockPromptManager.getPrompt.mockResolvedValue(failure(promptError));

      const result = await llmService.sendPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Failed to get prompt');
        expect(result.error.code).toBe('LLM_PROMPT_ERROR');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get prompt from PromptManager', expect.any(Object));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure if Ollama API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await llmService.sendPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Ollama API call failed');
        expect(result.error.code).toBe('LLM_API_CALL_FAILED');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Error sending LLM prompt', expect.any(Object));
    });

    it('should return failure if fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await llmService.sendPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Network error');
        expect(result.error.code).toBe('LLM_API_CALL_FAILED');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Error sending LLM prompt', expect.any(Object));
    });
  });

  describe('sendStructuredPrompt', () => {
    const mockTask = 'extractPreferences' as keyof PromptTemplate;
    const mockVariables: PromptVariables = { userInput: 'I like red wine' };
    const mockOutputSchema = z.object({ wineType: z.string() });
    const mockSystemPrompt = 'You are a helpful assistant.';
    const mockUserPrompt = 'Extract preferences from: I like red wine.';
    const mockLlmResponseObject = { wineType: 'red' };
    const mockLlmResponseContent = JSON.stringify(mockLlmResponseObject);

    beforeEach(() => {
      mockPromptManager.ensureLoaded.mockResolvedValue(undefined);
      mockPromptManager.getSystemPrompt.mockResolvedValue(mockSystemPrompt);
      mockPromptManager.getPrompt.mockResolvedValue(success(mockUserPrompt));
      mockPromptManager.getOutputSchemaForTask.mockReturnValue(mockOutputSchema);
    });

    it('should send a structured prompt to Ollama and return success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: mockLlmResponseContent } }),
      });

      const result = await llmService.sendStructuredPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(true);
      if (result.success) { // Type guard
        expect(result.data).toEqual(mockLlmResponseObject);
      } else {
        fail('Expected success, but got failure');
      }
      expect(mockPromptManager.getSystemPrompt).toHaveBeenCalledTimes(1);
      expect(mockPromptManager.getPrompt).toHaveBeenCalledWith(mockTask, mockVariables);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(`${mockLlmApiUrl}/api/chat`, expect.objectContaining({
        body: expect.stringContaining('"format":"json"')
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Sending structured LLM prompt', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Structured LLM prompt sent successfully and response validated', expect.any(Object));
    });

    it('should return failure if PromptManager.getPrompt fails', async () => {
      const promptError = new Error('Structured prompt not found');
      mockPromptManager.getPrompt.mockResolvedValue(failure(promptError));

      const result = await llmService.sendStructuredPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Failed to get structured prompt');
        expect(result.error.code).toBe('LLM_STRUCTURED_PROMPT_ERROR');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get prompt from PromptManager for structured output', expect.any(Object));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure if Ollama API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await llmService.sendStructuredPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Ollama structured API call failed');
        expect(result.error.code).toBe('LLM_STRUCTURED_API_CALL_FAILED');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Error sending structured LLM prompt', expect.any(Object));
    });

    it('should return failure if fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await llmService.sendStructuredPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Network error');
        expect(result.error.code).toBe('LLM_STRUCTURED_API_CALL_FAILED');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Error sending structured LLM prompt', expect.any(Object));
    });

    it('should return failure if Ollama response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'This is not JSON' } }),
      });

      const result = await llmService.sendStructuredPrompt(mockTask, mockVariables, mockLogContext);

      expect(result.success).toBe(false);
      if (!result.success) { // Type guard
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Invalid JSON response from LLM');
        expect(result.error.code).toBe('LLM_STRUCTURED_API_CALL_FAILED');
      } else {
        fail('Expected failure, but got success');
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to parse structured LLM response as JSON', expect.any(Object));
    });
  });
});
