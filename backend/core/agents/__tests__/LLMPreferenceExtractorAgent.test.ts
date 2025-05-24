import "reflect-metadata";
import { container } from 'tsyringe'; // Keep container import for potential future use or if other parts of the file use it
import { LLMPreferenceExtractorAgent } from '../LLMPreferenceExtractorAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../../services/PreferenceNormalizationService'; // Import the service
import { PreferenceNode } from '../../../types';
import { Neo4jService } from '../../../services/Neo4jService'; // Import Neo4jService if needed for KnowledgeGraphService mock

// Mock the dependency modules
jest.mock('../../AgentCommunicationBus');
jest.mock('../../../services/LLMService');
jest.mock('../../../services/KnowledgeGraphService');
jest.mock('../../../services/PreferenceNormalizationService'); // Mock the normalization service
jest.mock('../../../services/Neo4jService'); // Mock Neo4jService if needed for KnowledgeGraphService mock

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;
const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.MockedClass<typeof KnowledgeGraphService>;
const MockPreferenceNormalizationService = PreferenceNormalizationService as jest.MockedClass<typeof PreferenceNormalizationService>; // Mocked class
const MockNeo4jService = Neo4jService as jest.MockedClass<typeof Neo4jService>; // Mocked class for Neo4jService


describe('LLMPreferenceExtractorAgent', () => {
  let agent: LLMPreferenceExtractorAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;
  let mockLlmServiceInstance: jest.Mocked<LLMService>;
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>;
  let mockPreferenceNormalizationServiceInstance: jest.Mocked<PreferenceNormalizationService>; // Mocked instance
  let mockNeo4jServiceInstance: jest.Mocked<Neo4jService>; // Mocked instance for Neo4jService


  beforeEach(() => {
    // Clear mocks
    MockAgentCommunicationBus.mockClear();
    MockLLMService.mockClear();
    MockKnowledgeGraphService.mockClear();
    MockPreferenceNormalizationService.mockClear(); // Clear normalization service mock
    MockNeo4jService.mockClear(); // Clear Neo4jService mock
    // container.clearInstances(); // No longer using container for agent

    // Create mock instances, providing constructor arguments as needed
    // LLMService requires apiUrl, model, and apiKey (optional)
    mockLlmServiceInstance = new MockLLMService('mock-url', 'mock-model', 'mock-api-key') as jest.Mocked<LLMService>; // Provide string arguments
    // KnowledgeGraphService requires Neo4jService in its constructor
    mockNeo4jServiceInstance = new MockNeo4jService() as jest.Mocked<Neo4jService>; // Create and cast Neo4jService mock instance
    mockKnowledgeGraphServiceInstance = new MockKnowledgeGraphService(mockNeo4jServiceInstance) as jest.Mocked<KnowledgeGraphService>; // Provide Neo4jService mock

    mockCommunicationBusInstance = new MockAgentCommunicationBus() as jest.Mocked<AgentCommunicationBus>;
    mockPreferenceNormalizationServiceInstance = new MockPreferenceNormalizationService() as jest.Mocked<PreferenceNormalizationService>; // Create mock instance


    // Manually create agent instance with mocked dependencies
    agent = new LLMPreferenceExtractorAgent(
      mockCommunicationBusInstance,
      mockLlmServiceInstance,
      mockKnowledgeGraphServiceInstance,
      mockPreferenceNormalizationServiceInstance // Provide the mock normalization service
    );
  });

  afterEach(() => {
    // container.clearInstances(); // No longer using container for agent
  });

  it('should call LLMService to extract preferences', async () => {
    const testMessage = {
      input: 'I like sweet wines',
      history: [{ role: 'user', content: 'previous turn' }],
      userId: 'test-user-123',
    };

    // Mock LLMService to return a dummy response
    mockLlmServiceInstance.sendPrompt.mockResolvedValue('{"preferences": {"sweetness": "sweet"}}');
    // Mock normalization service to return a predictable output
    mockPreferenceNormalizationServiceInstance.normalizePreferences.mockReturnValue([{
        type: 'sweetness',
        value: 'sweet',
        source: 'llm',
        confidence: 1.0,
        timestamp: expect.any(String),
        active: true,
    }]);


    await agent.handleMessage(testMessage);

    // Expect LLMService.sendPrompt to have been called
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    // Verify the prompt sent to the LLMService
    const sentPrompt = mockLlmServiceInstance.sendPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testMessage.input);
    expect(sentPrompt).toContain(testMessage.history[0].content);
    expect(sentPrompt).toContain('Analyze the following user input for a wine recommendation request');
  });

  it('should normalize and persist extracted preferences', async () => {
    const testMessage = {
      input: 'I prefer red wine',
      history: [],
      userId: 'test-user-456',
    };
    const mockLlmResponse = '{"preferences": {"wineType": "red"}}';
    const expectedNormalizedPreferences = [{
      type: 'wineType',
      value: 'red',
      source: 'llm', // Source should be 'llm'
      confidence: 1.0, // Default confidence
      timestamp: expect.any(String), // Expect a timestamp string
      active: true,
    }];

    // Mock LLMService to return a response with preferences
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(mockLlmResponse);
    // Mock KnowledgeGraphService persistence methods
    mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockResolvedValue(undefined);
    // Mock normalization service to return a predictable output
    mockPreferenceNormalizationServiceInstance.normalizePreferences.mockReturnValue(expectedNormalizedPreferences);


    await agent.handleMessage(testMessage);

    // Expect normalization service to be called with the extracted preferences object converted to an array
    expect(mockPreferenceNormalizationServiceInstance.normalizePreferences).toHaveBeenCalledWith([{
        type: 'wineType',
        value: 'red',
        source: 'llm',
        confidence: 1.0,
        timestamp: expect.any(String), // Timestamp is generated before normalization
        active: true,
    }]);


    // Expect KnowledgeGraphService.addOrUpdatePreference to have been called
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledTimes(1);
    // Verify the preference node passed to addOrUpdatePreference
    const persistedPreference = mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mock.calls[0][1];
    expect(persistedPreference).toEqual(expect.objectContaining(expectedNormalizedPreferences[0]));
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(
      testMessage.userId,
      expect.objectContaining({
        type: 'wineType',
        value: 'red',
        source: 'llm',
        confidence: 1.0,
        active: true,
      })
    );
  });

  it('should handle invalid JSON response from LLM', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = {
      input: 'invalid json test',
      history: [],
      userId: 'test-user-789',
    };
    const invalidJsonResponse = 'This is not JSON';

    // Mock LLMService to return invalid JSON
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidJsonResponse);

    await agent.handleMessage(testMessage);

    // Expect LLMService.sendPrompt to have been called
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    // Expect console.error to have been called due to parsing error
    expect(consoleSpy).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent: Error parsing or validating LLM response:',
      expect.any(SyntaxError)
    );
    // Expect KnowledgeGraphService.addOrUpdatePreference not to have been called
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
    // Expect normalization service not to have been called
    expect(mockPreferenceNormalizationServiceInstance.normalizePreferences).not.toHaveBeenCalled();


    consoleSpy.mockRestore();
  });

  it('should handle errors during LLMService communication', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = {
      input: 'llm error test',
      history: [],
      userId: 'test-user-abc',
    };
    const mockError = new Error('LLM communication failed');

    // Mock LLMService to reject with an error
    mockLlmServiceInstance.sendPrompt.mockRejectedValue(mockError);

    await agent.handleMessage(testMessage);

    // Expect LLMService.sendPrompt to have been called
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    // Expect console.error to have been called due to LLM error
    expect(consoleSpy).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent: Error during LLM preference extraction:',
      mockError
    );
    // Expect KnowledgeGraphService.addOrUpdatePreference not to have been called
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
    // Expect normalization service not to have been called
    expect(mockPreferenceNormalizationServiceInstance.normalizePreferences).not.toHaveBeenCalled();


    consoleSpy.mockRestore();
  });

  it('should handle LLM response with invalid preference structure', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = {
      input: 'invalid structure test',
      history: [],
      userId: 'test-user-def',
    };
    // LLM response with incorrect structure (missing 'preferences' field)
    const invalidPreferenceResponse = '{"notPreferences": "..."}';

    // Mock LLMService to return a response with invalid structure
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidPreferenceResponse);

    await agent.handleMessage(testMessage);

    // Expect LLMService.sendPrompt to have been called
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    // Expect console.error to have been called due to invalid structure
    expect(consoleSpy).toHaveBeenCalledWith(
      'LLMPreferenceExtractorAgent: LLM response missing or invalid "preferences" field.'
    );
    // Expect KnowledgeGraphService.addOrUpdatePreference not to have been called
    expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
    // Expect normalization service not to have been called
    expect(mockPreferenceNormalizationServiceInstance.normalizePreferences).not.toHaveBeenCalled();


    consoleSpy.mockRestore();
  });
});