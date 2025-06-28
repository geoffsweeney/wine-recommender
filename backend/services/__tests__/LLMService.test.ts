import 'reflect-metadata';
import { LLMService } from '../LLMService';
import { mock, instance, when, verify, anything } from 'ts-mockito';
import { ILogger } from '../LLMService';
import { OllamaStructuredClient } from '../../utils/ollama_structured_output';
import { GenerateResponse } from 'ollama';
import { AgentError } from '../../core/agents/AgentError'; // Re-import AgentError explicitly
 
// Mock the entire OllamaStructuredClient module
jest.mock('../../utils/ollama_structured_output', () => {
  const mockOllamaInstance = {
    generate: jest.fn(),
    chat: jest.fn(), // Add chat method for structured calls
    list: jest.fn(),
    pull: jest.fn(),
  };

  const MockOllamaStructuredClient = jest.fn().mockImplementation(() => {
    return {
      ollama: mockOllamaInstance,
      defaultOptions: {
        temperature: 0.1,
        num_predict: 2048,
      },
      generateStructured: jest.fn(),
      generateWithRetry: jest.fn(),
      isModelAvailable: jest.fn(),
      ensureModel: jest.fn(),
    };
  });
  return { OllamaStructuredClient: MockOllamaStructuredClient };
});

describe('LLMService', () => {
  let service: LLMService;
  let mockLogger: ILogger;
  let mockOllamaStructuredClientInstance: jest.Mocked<OllamaStructuredClient>;
 
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
 
    mockLogger = mock<ILogger>(); // Initialize mockLogger here
 
    // Get the mocked instance of OllamaStructuredClient
    mockOllamaStructuredClientInstance = new (OllamaStructuredClient as jest.Mock)();
 
    // Manually inject the mocked OllamaStructuredClient instance into the service
    // This bypasses the constructor's new OllamaStructuredClient() call
    service = new LLMService(
      'http://test-api',
      'test-model',
      'test-key',
      instance(mockLogger),
      3, // maxRetries
      10 // retryDelayMs (reduced for faster tests)
    );
    // @ts-ignore - Overwrite the private property with the mock instance
    service['ollamaClient'] = mockOllamaStructuredClientInstance;
  });

  describe('sendPrompt (unstructured)', () => {
    it('should successfully send unstructured prompt and return response', async () => {
      mockOllamaStructuredClientInstance.ollama.generate.mockResolvedValueOnce({
        response: 'test-unstructured-response',
        model: 'test-model',
        created_at: new Date(),
        done: true,
        total_duration: 1000,
        load_duration: 500,
        prompt_eval_count: 10,
        eval_count: 20,
        eval_duration: 500,
        done_reason: 'stop',
        context: [],
        prompt_eval_duration: 100
      } as GenerateResponse);

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test-unstructured-response');
      }
      expect(mockOllamaStructuredClientInstance.ollama.generate).toHaveBeenCalledTimes(1);
      expect(mockOllamaStructuredClientInstance.ollama.generate).toHaveBeenCalledWith(expect.objectContaining({
        prompt: 'test-prompt',
        model: 'test-model'
      }));
    });

    it('should handle errors during unstructured prompt generation', async () => {
      mockOllamaStructuredClientInstance.ollama.generate.mockRejectedValueOnce(new Error('LLM generation error'));

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('LLM generation error');
      }
      expect(mockOllamaStructuredClientInstance.ollama.generate).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid unstructured response format', async () => {
      mockOllamaStructuredClientInstance.ollama.generate.mockResolvedValueOnce({
        invalid: 'format',
        response: '', // Ensure response property exists
        model: 'test-model',
        created_at: new Date(),
        done: true,
        total_duration: 0,
        load_duration: 0,
        prompt_eval_count: 0,
        eval_count: 0,
        eval_duration: 0,
        done_reason: 'stop',
        context: [],
        prompt_eval_duration: 0
      } as GenerateResponse);

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Invalid unstructured response format from Ollama API');
      }
      expect(mockOllamaStructuredClientInstance.ollama.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendStructuredPrompt', () => {
    const mockSchema = { type: 'object', properties: { key: { type: 'string' } } };
    const mockZodSchema = { parse: jest.fn() };

    it('should successfully send structured prompt and return parsed response', async () => {
      const mockParsedData = { key: 'value' };
      mockOllamaStructuredClientInstance.generateStructured.mockResolvedValueOnce(mockParsedData);

      const result = await service.sendStructuredPrompt('test-structured-prompt', mockSchema, mockZodSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockParsedData);
      }
      expect(mockOllamaStructuredClientInstance.generateStructured).toHaveBeenCalledTimes(1);
      expect(mockOllamaStructuredClientInstance.generateStructured).toHaveBeenCalledWith(
        'test-structured-prompt',
        mockSchema,
        mockZodSchema,
        expect.any(Object) // options object
      );
    });

    it('should handle errors during structured prompt generation', async () => {
      mockOllamaStructuredClientInstance.generateStructured.mockRejectedValueOnce(new Error('Structured generation error'));

      const result = await service.sendStructuredPrompt('test-structured-prompt', mockSchema, mockZodSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Structured generation error');
      }
      expect(mockOllamaStructuredClientInstance.generateStructured).toHaveBeenCalledTimes(1);
    });
  });

  describe('constructor', () => {
    it('should initialize with provided parameters and OllamaStructuredClient', () => {
      // This test now primarily verifies the constructor's ability to instantiate the service
      // and that the mock OllamaStructuredClient is used.
      const testService = new LLMService(
        'http://another-api',
        'another-model',
        'another-key',
        instance(mockLogger),
        5,
        50
      );
      expect(testService).toBeInstanceOf(LLMService);
      // Further verification of OllamaStructuredClient's constructor arguments
      // would require more advanced Jest mocking of the constructor itself,
      // which is beyond the scope of simple unit tests for LLMService.
      // We rely on the mockImplementation above to ensure the mock is created.
    });
  });
});
