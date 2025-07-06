import { LLMService } from '../services/LLMService';
import { ILogger } from '../di/Types';
import { mock } from 'jest-mock-extended'; // Import mock

import { INeo4jCircuitWrapper } from '../services/Neo4jCircuitWrapper';

// Minimal type definition for CircuitBreaker
type CircuitBreaker = {
  execute: jest.Mock<any, any>;
  state: string;
};

export function createMockLLMService(): jest.Mocked<LLMService> {
  const mockLogger = mock<ILogger>(); // Use mock from jest-mock-extended
  return {
    apiUrl: 'http://mock-llm-api',
    model: 'mock-model',
    apiKey: 'mock-api-key',
    logger: mockLogger, // Assign the mocked logger
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
