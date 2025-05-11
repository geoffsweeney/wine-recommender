import "reflect-metadata";
import { container } from 'tsyringe';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService'; // Import LLMService

// Mock the LLMService module for integration tests
jest.mock('../../../services/LLMService');

const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;

describe('UserPreferenceAgent Integration with LLMService', () => {
  let agent: UserPreferenceAgent;
  let mockLlmServiceInstance: jest.Mocked<LLMService>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockLLMService.mockClear();
    container.clearInstances(); // Clear container before each test

    // Create a mock instance of LLMService with mock arguments
    const mockRateLimiter: any = { consume: jest.fn().mockResolvedValue(undefined) }; // Mock RateLimiterMemory
    mockLlmServiceInstance = new MockLLMService('mock-url', 'mock-model', mockRateLimiter) as jest.Mocked<LLMService>;

    // Bind the mocked LLMService instance to the container using useValue
    container.register<LLMService>(LLMService, { useValue: mockLlmServiceInstance });

    // Explicitly register AgentCommunicationBus with the mocked LLMService
    container.register<AgentCommunicationBus>(AgentCommunicationBus, {
      useFactory: (c) => new AgentCommunicationBus(c.resolve(LLMService)),
    });

    // Resolve the UserPreferenceAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the factory we just registered) and inject
    // the mocked LLMService instance we created above.
    agent = container.resolve(UserPreferenceAgent);
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should send the user input to the LLMService via the communication bus and return extracted preferences', async () => {
    const testUserInput = 'I prefer dry red wine';
    const mockLlmResponse = '{"preferences": {"wineType": "red", "sweetness": "dry"}}'; // Mock LLM response as a JSON string
    const mockExtractedPreferences = { wineType: 'red', sweetness: 'dry' }; // Expected parsed preferences

    // Mock the sendPrompt method of the mocked LLMService to return a JSON string
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage(testUserInput);

    // Expect LLMService.sendPrompt to have been called with a prompt based on the user input
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    const sentPrompt = mockLlmServiceInstance.sendPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testUserInput);
    // Check if the prompt contains the core instruction and the user input
    expect(sentPrompt).toContain('Analyze the following user input and extract any stated or implied wine preferences');
    expect(sentPrompt).toContain('User Input: "I prefer dry red wine"');

    // Expect the result to contain the extracted preferences
    expect(result).toEqual({ preferences: mockExtractedPreferences });
  });

  it('should handle cases where LLMService does not return a response', async () => {
    const testUserInput = 'Any wine is fine';

    // Mock the sendPrompt method to return undefined
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage(testUserInput);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    expect(result).toEqual({ preferences: {} });
  });

  it('should handle errors during LLMService communication', async () => {
    const testUserInput = 'Some input';
    const mockError = new Error('LLM communication failed');

    // Mock the sendPrompt method to throw an error
    mockLlmServiceInstance.sendPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testUserInput);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: 'Error communicating with LLM for preference extraction.' });
  });

  it('should handle invalid JSON response format from LLMService', async () => {
    const testUserInput = 'Another input';
    const invalidJsonResponse = 'This is not JSON'; // Invalid JSON response

    // Mock the sendPrompt method to return invalid JSON
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidJsonResponse);

    const result = await agent.handleMessage(testUserInput);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: expect.stringContaining('Error processing LLM preference response: Unexpected token \'T\', "This is not JSON" is not valid JSON') });
  });

  it('should handle LLM response with invalid preference structure', async () => {
    const testUserInput = 'Input with bad preference structure';
    const invalidPreferenceResponse = '{"notPreferences": "..."}'; // LLM response with incorrect structure

    // Mock the sendPrompt method to return a JSON string with invalid structure
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(invalidPreferenceResponse);

    const result = await agent.handleMessage(testUserInput);
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: "Invalid structure in LLM preference response.", preferences: {} });
  });
});