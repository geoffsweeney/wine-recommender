import { LLMService } from '../services/LLMService';
import { ILogger } from '../services/LLMService';

import { INeo4jCircuitWrapper } from '../services/Neo4jCircuitWrapper';

// Minimal type definition for CircuitBreaker
type CircuitBreaker = {
  execute: jest.Mock<any, any>;
  state: string;
};

export function createMockLLMService(): jest.Mocked<LLMService> {
  return {
    apiUrl: 'http://mock-llm-api',
    model: 'mock-model',
    apiKey: 'mock-api-key',
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as ILogger,
    sendPrompt: jest.fn(),
    generateCompletion: jest.fn(),
    generateEmbedding: jest.fn()
  } as unknown as jest.Mocked<LLMService>;
}

// Mock for CircuitBreaker implementing INeo4jCircuitWrapper
export const createMockCircuitBreaker = (): jest.Mocked<INeo4jCircuitWrapper> => ({
  execute: jest.fn(),
  executeQuery: jest.fn(),
  verifyConnection: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  getCircuitState: jest.fn().mockReturnValue('CLOSED')
});