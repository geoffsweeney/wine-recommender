import { LLMService } from '../LLMService';
import { logger } from '../../utils/logger'; // Import logger directly

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the logger to prevent console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LLMService', () => {
  const apiUrl = 'http://mock-ollama-api';
  const model = 'mock-model';
  const apiKey = 'mock-api-key';

  beforeEach(() => {
    // Clear mocks before each test
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  it('should be initialized with API URL, model, and optional API key', () => {
    const service = new LLMService(apiUrl, model, apiKey);
    expect(service).toBeInstanceOf(LLMService);
    // Check if logger.info was called with initialization message
    expect(logger.info).toHaveBeenCalledWith(
      `LLMService initialized for Ollama at ${apiUrl} with model: ${model}`
    );
  });

  it('should send a prompt to the LLM API successfully', async () => {
    const service = new LLMService(apiUrl, model, apiKey);
    const mockResponse = { response: 'Mocked LLM response' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse), // Include text for error cases
    });

    const prompt = 'Test prompt';
    const response = await service.sendPrompt(prompt);

    expect(mockFetch).toHaveBeenCalledWith(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
      }),
    });
    expect(response).toBe(mockResponse.response);
    expect(logger.debug).toHaveBeenCalledWith(
      `Sending prompt to LLM: ${prompt}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Received Ollama response: ${mockResponse.response}`
    );
  }, 100); // Added timeout

  it('should handle API errors gracefully', async () => {
    const service = new LLMService(apiUrl, model, apiKey);
    const errorStatus = 500;
    const errorText = 'Internal Server Error';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: errorStatus,
      text: async () => errorText,
    });

    const prompt = 'Test prompt';
    const response = await service.sendPrompt(prompt);

    expect(response).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      `Ollama API error: ${errorStatus} - ${errorText}`
    );
  }, 1000); // Increased timeout for this test

  it('should handle invalid JSON response format from API', async () => {
    const service = new LLMService(apiUrl, model, apiKey);
    const invalidJsonResponse = { notTheResponseField: '...' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidJsonResponse,
      text: async () => JSON.stringify(invalidJsonResponse), // Include text for error cases
    });

    const prompt = 'Test prompt';
    const response = await service.sendPrompt(prompt);

    expect(response).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid response format from Ollama API'
    );
  });
});
