import { container } from 'tsyringe';
import { TYPES } from '../../../di/Types';

// Mock implementations
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockNeo4jUri = 'bolt://mock-neo4j';
const mockNeo4jUser = 'mock-neo4j-user';
const mockNeo4jPassword = 'mock-neo4j-password';

const mockLlmModel = {
  generateResponse: jest.fn()
};

const mockLlmApiKey = 'mock-llm-api-key';

const mockLLMService = {
  generateResponse: jest.fn()
};

const mockCommunicationBus = {
  registerMessageHandler: jest.fn(),
  sendMessage: jest.fn()
};

const mockMCPClient = {
  connect: jest.fn(),
  sendRequest: jest.fn()
};

const mockDeadLetterProcessor = {
  process: jest.fn()
};

const mockNeo4jCircuitWrapper = {
  execute: jest.fn()
};

const mockPreferenceExtractionService = {
  attemptFastExtraction: jest.fn()
};

const mockKnowledgeGraphService = {
  getPreferences: jest.fn(),
  addOrUpdatePreference: jest.fn()
};

const mockPreferenceNormalizationService = {
  normalizePreferences: jest.fn()
};

export function setupTestContainer() {
  container.clearInstances();
  
  // Register core services with proper tokens
  container.register(TYPES.Logger, { useValue: mockLogger });
  container.register(TYPES.Neo4jCircuitWrapper, { useValue: mockNeo4jCircuitWrapper });
  container.register(TYPES.PreferenceExtractionService, { useValue: mockPreferenceExtractionService });
  container.register(TYPES.KnowledgeGraphService, { useValue: mockKnowledgeGraphService });
  container.register(TYPES.PreferenceNormalizationService, { useValue: mockPreferenceNormalizationService });
  container.register(TYPES.Neo4jUri, { useValue: mockNeo4jUri });
  container.register(TYPES.Neo4jUser, { useValue: mockNeo4jUser });
  container.register(TYPES.Neo4jPassword, { useValue: mockNeo4jPassword });
  container.register(TYPES.LlmApiUrl, { useValue: 'http://mock-llm' });
  container.register(TYPES.LlmModel, { useValue: mockLlmModel });
  container.register(TYPES.LlmApiKey, { useValue: mockLlmApiKey });
  container.register(TYPES.DeadLetterProcessor, { useValue: mockDeadLetterProcessor });
  container.register(TYPES.LLMService, { useValue: mockLLMService });
  container.register(TYPES.AgentCommunicationBus, { useValue: mockCommunicationBus });
  container.register('MCPClient', { useValue: mockMCPClient });
  container.register('EnhancedAgentCommunicationBus', { useValue: mockCommunicationBus });

  return {
    mockLogger,
    mockLLMService,
    mockCommunicationBus,
    mockMCPClient,
    mockDeadLetterProcessor
  };
}