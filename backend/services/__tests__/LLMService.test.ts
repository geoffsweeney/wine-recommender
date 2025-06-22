import 'reflect-metadata';
import { LLMService } from '../LLMService';
import { mock, instance, when, verify, anything } from 'ts-mockito';
import { ILogger } from '../LLMService';
import { AgentError } from '../../core/agents/AgentError'; // Import AgentError

describe('LLMService', () => {
  let service: LLMService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = mock<ILogger>();
    service = new LLMService(
      'http://test-api',
      'test-model',
      'test-key',
      instance(mockLogger),
      3, // maxRetries
      10 // retryDelayMs (reduced for faster tests)
    );
  });

  describe('sendPrompt', () => {
    it('should successfully send prompt and return response', async () => {
      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: 'test-response',
          model: 'test-model',
          created_at: 'now',
          done: true
        })
      });

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test-response');
      }
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('api-error')
      });

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Ollama API error: 500 - api-error');
      }
    });

    it('should handle invalid response format', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'format' })
      });

      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('Invalid response format from Ollama API');
      }
    });

    it('should return undefined on network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('network-error'));
      const result = await service.sendPrompt('test-prompt');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.message).toContain('network-error');
      }
    });
  });

  describe('retry logic', () => {
    it('should retry on network errors and eventually succeed', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new TypeError('network-error-1'))
        .mockRejectedValueOnce(new TypeError('network-error-2'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'successful-retry', model: 'test', created_at: 'now', done: true })
        });

      const result = await service.sendPrompt('test-prompt-retry');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('successful-retry');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should retry on 5xx errors and eventually succeed', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('server-error-1') })
        .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('server-error-2') })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'successful-retry-5xx', model: 'test', created_at: 'now', done: true })
        });

      const result = await service.sendPrompt('test-prompt-retry-5xx');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('successful-retry-5xx');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should fail after max retries on persistent network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('persistent-network-error'));

      const result = await service.sendPrompt('test-prompt-fail');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_NETWORK_ERROR');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should fail after max retries on persistent 5xx errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('persistent-server-error') });

      const result = await service.sendPrompt('test-prompt-fail-5xx');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_API_ERROR');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry on non-retryable API errors (e.g., 400 Bad Request)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad-request') });

      const result = await service.sendPrompt('test-prompt-400');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('LLM_API_ERROR');
      }
      expect(global.fetch).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(service).toBeInstanceOf(LLMService);
    });
  });
});
