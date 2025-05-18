import "reflect-metadata";
import { container } from 'tsyringe';
import { LLMPreferenceExtractorAgent } from '../LLMPreferenceExtractorAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../../types';

// Mock the dependencies
jest.mock('../../AgentCommunicationBus');
jest.mock('../../../services/LLMService');
jest.mock('../../../services/KnowledgeGraphService');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;
const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.MockedClass<typeof KnowledgeGraphService>;

describe('LLMPreferenceExtractorAgent', () => {
  let agent: LLMPreferenceExtractorAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;
  let mockLlmServiceInstance: jest.Mocked<LLMService>;
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>;

  beforeEach(() => {
    // Clear mocks and container
    MockAgentCommunicationBus.mockClear();
    MockLLMService.mockClear();
    MockKnowledgeGraphService.mockClear();
    container.clearInstances();

    // Register mocked dependencies
    container.register<AgentCommunicationBus>(AgentCommunicationBus, { useClass: MockAgentCommunicationBus });
    container.register<LLMService>(LLMService, { useClass: MockLLMService });
    container.register<KnowledgeGraphService>(KnowledgeGraphService, { useClass: MockKnowledgeGraphService });

    // Resolve the agent
    agent = container.resolve(LLMPreferenceExtractorAgent);

    // Get mock instances
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
    mockLlmServiceInstance = MockLLMService.mock.instances[0] as jest.Mocked<LLMService>;
    mockKnowledgeGraphServiceInstance = MockKnowledgeGraphService.mock.instances[0] as jest.Mocked<KnowledgeGraphService>;
  });

  afterEach(() => {
    container.clearInstances();
  });

  it('should call LLMService to extract preferences', async () => {
    const testMessage = {
      input: 'I like sweet wines',
      history: [{ role: 'user', content: 'previous turn' }],
      userId: 'test-user-123',
    };

    // Mock LLMService to return a dummy response
    mockLlmServiceInstance.sendPrompt.mockResolvedValue('{"preferences": {"sweetness": "sweet"}}');

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

    await agent.handleMessage(testMessage);

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

    consoleSpy.mockRestore();
  });
});