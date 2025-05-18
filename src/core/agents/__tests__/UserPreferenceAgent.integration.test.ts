import "reflect-metadata";
import { container } from 'tsyringe';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService'; // Import LLMService
import { PreferenceExtractionService } from '../../../services/PreferenceExtractionService'; // Import PreferenceExtractionService
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService'; // Import KnowledgeGraphService
import { Neo4jService } from '../../../services/Neo4jService'; // Import Neo4jService


// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

// Mock the LLMService, PreferenceExtractionService, KnowledgeGraphService, and Neo4jService modules for integration tests
jest.mock('../../../services/LLMService');
jest.mock('../../../services/PreferenceExtractionService');
jest.mock('../../../services/KnowledgeGraphService');
jest.mock('../../../services/Neo4jService');


// Explicitly mock AgentCommunicationBus to have Jest mock functions for the methods used by UserPreferenceAgent
const MockAgentCommunicationBus = {
  sendMessage: jest.fn(),
  // Add other methods if UserPreferenceAgent starts using them
};

const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;
const MockPreferenceExtractionService = PreferenceExtractionService as jest.MockedClass<typeof PreferenceExtractionService>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.MockedClass<typeof KnowledgeGraphService>;
const MockNeo4jService = Neo4jService as jest.MockedClass<typeof Neo4jService>;


describe('UserPreferenceAgent Integration with LLMService', () => {
  let mockCommunicationBusInstance: any; // Changed type assertion to any
  let mockLlmServiceInstance: jest.Mocked<LLMService>;
  let mockPreferenceExtractionServiceInstance: jest.Mocked<PreferenceExtractionService>; // Mock instance
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>; // Mock instance
  let mockNeo4jServiceInstance: jest.Mocked<Neo4jService>; // Mock instance


  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockLLMService.mockClear();
    MockPreferenceExtractionService.mockClear(); // Clear mock
    MockKnowledgeGraphService.mockClear(); // Clear mock
    MockNeo4jService.mockClear(); // Clear mock
    // container.clearInstances(); // No longer using container for agent

    // Create mock instances of services
    const mockRateLimiter: any = { consume: jest.fn().mockResolvedValue(undefined) }; // Mock RateLimiterMemory
    mockLlmServiceInstance = new MockLLMService('mock-url', 'mock-model', mockRateLimiter) as jest.Mocked<LLMService>;
    mockPreferenceExtractionServiceInstance = new MockPreferenceExtractionService() as jest.Mocked<PreferenceExtractionService>;
    mockNeo4jServiceInstance = new MockNeo4jService() as jest.Mocked<Neo4jService>;
    // Provide the mock Neo4jService instance to the KnowledgeGraphService constructor
    mockKnowledgeGraphServiceInstance = new MockKnowledgeGraphService(mockNeo4jServiceInstance) as jest.Mocked<KnowledgeGraphService>;

    // Manually create mock AgentCommunicationBus instance
    mockCommunicationBusInstance = MockAgentCommunicationBus as any; // Changed type assertion to any
    mockCommunicationBusInstance.sendMessage.mockClear(); // Clear mock on the instance's method
    // Clear other mocked methods if necessary

    // No longer resolving agent here
  });

  afterEach(() => {
    // Clear the container after each test (if still using it for other things)
    // container.clearInstances();
  });

  it('should use fast extraction when successful and not call LLM', async () => {
    const testUserInput = 'I like red wine';
    const mockFastPreferences = { wineType: 'red' };

    // Mock fast extraction to return preferences wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(mockFastPreferences);

    // Mock persistPreferences to resolve immediately
    mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockResolvedValue(undefined);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    const result = await agent.handleMessage({ input: testUserInput, conversationHistory: [] });

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testUserInput);

    // Expect LLMService.sendPrompt not to have been called
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect persistPreferences to have been called with normalized preferences
    // TODO: Add proper normalization tests
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalled();


    // Expect the result to contain the normalized preferences (assuming basic normalization for now)
    // The agent now returns normalized PreferenceNode array
    expect(result.preferences).toBeDefined();
    expect(result.preferences).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'wineType', value: 'red', source: 'fast-extraction', active: true })
    ]));
  });

  it('should queue for async LLM via communication bus when fast extraction fails', async () => {
    const testMessage = { input: 'complex preference', conversationHistory: [{ role: 'user', content: 'previous turn' }], userId: 'test-user-queue-integration' }; // Added userId

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Mock AgentCommunicationBus.sendMessage to resolve immediately
    // We are testing that the message is sent, not that the async agent processes it.
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called'); // Removed logging
    });

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    const result = await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);

    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Include userId in the expected payload
    );

    // Expect the result to indicate async processing (as per the current agent logic)
    expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' }); // Updated expectation to return empty array for preferences
  });

  // The following tests are for scenarios where LLM fallback is triggered.
  // In the new async flow, UserPreferenceAgent queues a message and returns immediately.
  // The handling of LLM response/errors happens in the async LLM agent.
  // Therefore, these tests need to be adapted or moved to test the async LLM agent.
  // For now, we will keep them but adapt to check for sendMessage call.

  it('should queue for async LLM when LLMService would have returned no response', async () => {
    const testMessage = { input: 'Any wine is fine', conversationHistory: [], userId: 'test-user-no-response' }; // Added userId

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    // Mock AgentCommunicationBus.sendMessage
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called for no response scenario'); // Removed logging
    });

    // Mock LLMService.sendPrompt to return undefined (this is what the async agent would call)
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(undefined);


    const result = await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);
    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Include userId
    );

    // Expect the result to indicate async processing
    expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' }); // Updated expectation to return empty array for preferences
  });

  it('should queue for async LLM when LLMService would have errored', async () => {
    const testMessage = { input: 'Some input', conversationHistory: [], userId: 'test-user-llm-error' }; // Added userId
    const mockError = new Error('LLM communication failed');

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    // Mock AgentCommunicationBus.sendMessage
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called for error scenario'); // Removed logging
    });

    // Mock LLMService.sendPrompt to throw an error (this is what the async agent would call)
    mockLlmServiceInstance.sendPrompt.mockRejectedValue(mockError);


    const result = await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);
    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Include userId
    );

    // Expect the result to indicate async processing
    // Expect the result to indicate async processing
    expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' }); // Updated expectation to return empty array for preferences
  });

  it('should queue for async LLM when LLMService would have returned invalid JSON', async () => {
    const testMessage = { input: 'Another input', conversationHistory: [], userId: 'test-user-invalid-json' }; // Added userId
    const invalidJsonResponse = 'This is not JSON'; // Invalid JSON response

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance, // Corrected typo
      mockKnowledgeGraphServiceInstance
    );

    // Mock AgentCommunicationBus.sendMessage
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called for invalid JSON scenario'); // Removed logging
    });

    // Mock LLMService.sendPrompt to return invalid JSON (this is what the async agent would call)
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidJsonResponse);


    const result = await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);
    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Include userId
    );

    // Expect the result to indicate async processing
    expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' }); // Updated expectation to return empty array for preferences
  });

  it('should queue for async LLM when LLMService would have returned invalid preference structure', async () => {
    const testMessage = { input: 'Input with bad preference structure', conversationHistory: [], userId: 'test-user-invalid-structure' }; // Added userId
    const invalidPreferenceResponse = '{"notPreferences": "..."}'; // LLM response with incorrect structure

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    // Mock AgentCommunicationBus.sendMessage
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called for invalid structure scenario'); // Removed logging
    });

    // Mock LLMService.sendPrompt to return a JSON string with invalid structure (this is what the async agent would call)
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidPreferenceResponse);


    const result = await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);
    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Include userId
    );

    // Expect the result to indicate async processing
    expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' }); // Updated expectation to return empty array for preferences
  });

  it('should include conversation history when queuing for async LLM after fast extraction fails', async () => {
    const testMessage = {
      input: 'history test',
      conversationHistory: [{ role: 'user', content: 'previous turn 1' }, { role: 'assistant', content: 'previous turn 2' }],
      userId: 'test-user-history-integration', // Added userId
    };

    // Mock fast extraction to return null wrapped in a Promise
    mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);

    // Manually create agent instance with mocked dependencies
    const agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance
    );

    // Mock AgentCommunicationBus.sendMessage
    (mockCommunicationBusInstance.sendMessage as jest.Mock).mockImplementation(() => {
        // console.log('Mock AgentCommunicationBus.sendMessage called for history scenario'); // Removed logging
    });

    // Mock LLMService.sendPrompt to return a valid response (this is what the async agent would call)
    const mockLlmResponse = '{"preferences": {"foodPairing": "pasta"}}';
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(mockLlmResponse);


    await agent.handleMessage(testMessage);

    // Expect fast extraction to have been called
    expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(testMessage.input);
    // Expect LLMService.sendPrompt not to have been called directly by UserPreferenceAgent
    expect(mockLlmServiceInstance.sendPrompt).not.toHaveBeenCalled();

    // Expect message to async LLM agent to have been called via the communication bus
    expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent', // TODO: Confirm the correct agent name
      { input: testMessage.input, history: testMessage.conversationHistory, userId: testMessage.userId } // Verify history and userId are included
    );
  });
});