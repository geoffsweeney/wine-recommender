import "reflect-metadata";
import { container } from 'tsyringe'; // Import container
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus'; // Correct import path

// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

describe('UserPreferenceAgent', () => {
  let agent: UserPreferenceAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>; // Mock instance type

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockAgentCommunicationBus.mockClear();
    container.clearInstances(); // Clear container before each test

    // Bind the mocked AgentCommunicationBus to the container
    container.register<AgentCommunicationBus>(AgentCommunicationBus, { useClass: MockAgentCommunicationBus });

    // Resolve the UserPreferenceAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the mock we just registered) and inject it.
    agent = container.resolve(UserPreferenceAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('UserPreferenceAgent');
  });

  // TODO: Add tests for LLM interaction in handleMessage
  it('should process the received message and extract preferences via LLM', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { input: { preferences: { wineType: 'red' } }, conversationHistory: [] };

    // Mock the sendLLMPrompt method to return a predefined preference output
    const mockLlmPreferenceOutput = { preferences: { wineType: 'red', sweetness: 'dry' } };
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(JSON.stringify(mockLlmPreferenceOutput));


    const result = await agent.handleMessage(testMessage);

    // expect(consoleSpy).toHaveBeenCalledWith('UserPreferenceAgent received message:', testMessage);
    // Expect sendLLMPrompt to have been called
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // Expect the result to contain the preferences extracted by the mocked LLM call
    expect(result).toEqual({ preferences: mockLlmPreferenceOutput.preferences });


    consoleSpy.mockRestore();
  });

  it('should handle invalid JSON response from LLM', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = { input: { preferences: { wineType: 'red' } }, conversationHistory: [] };
    const invalidJsonResponse = 'This is not JSON';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(invalidJsonResponse);

    const result = await agent.handleMessage(testMessage);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // expect(consoleSpy).toHaveBeenCalledWith('UserPreferenceAgent: Error parsing or validating LLM response:', expect.any(SyntaxError));
    expect(result).toEqual({ error: expect.stringContaining('Error processing LLM preference response:') });

    consoleSpy.mockRestore();
  });

  it('should handle LLM communication errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = { input: { preferences: { wineType: 'red' } }, conversationHistory: [] };
    const mockError = new Error('LLM communication failed');

    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testMessage);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // expect(consoleSpy).toHaveBeenCalledWith('UserPreferenceAgent: Error during LLM preference extraction:', mockError);
    expect(result).toEqual({ error: 'Error communicating with LLM for preference extraction.' });

    consoleSpy.mockRestore();
  });
});

import { LLMService } from '../../../services/LLMService'; // Import LLMService

// Mock the LLMService module for integration tests
jest.mock('../../../services/LLMService');

const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;

describe('UserPreferenceAgent Integration with AgentCommunicationBus', () => {
  let agent: UserPreferenceAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockAgentCommunicationBus.mockClear();
    container.clearInstances(); // Clear container before each test

    // Bind the mocked AgentCommunicationBus to the container
    container.register<AgentCommunicationBus>(AgentCommunicationBus, { useClass: MockAgentCommunicationBus });

    // Resolve the UserPreferenceAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the mock we just registered) and inject it.
    agent = container.resolve(UserPreferenceAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should send the user input to the LLMService via the communication bus and return extracted preferences', async () => {
    const testMessage = { input: { userInput: 'I prefer dry red wine' }, conversationHistory: [] };
    const mockLlmResponse = '{"preferences": {"wineType": "red", "sweetness": "dry"}}'; // Mock LLM response as a JSON string
    const mockExtractedPreferences = { wineType: 'red', sweetness: 'dry' }; // Expected parsed preferences

    // Mock the sendLLMPrompt method of the mocked AgentCommunicationBus to return a JSON string
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage(testMessage);

    // Expect AgentCommunicationBus.sendLLMPrompt to have been called with a prompt based on the user input
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testMessage.input.userInput);

    // Expect the result to contain the extracted preferences
    expect(result).toEqual({ preferences: mockExtractedPreferences });
  });

  it('should handle cases where LLMService does not return a response via the communication bus', async () => {
    const testUserInput = 'Any wine is fine';

    // Mock the sendLLMPrompt method to return undefined
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage({ input: testUserInput, conversationHistory: [] });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({ preferences: {} }); // Expect empty preferences on no response
  });

  it('should handle errors during LLMService communication via the communication bus', async () => {
    const testUserInput = 'Some input';
    const mockError = new Error('LLM communication failed');

    // Mock the sendLLMPrompt method to throw an error
    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage({ input: testUserInput, conversationHistory: [] });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: 'Error communicating with LLM for preference extraction.' });
  });

  it('should handle invalid JSON response format from LLMService via the communication bus', async () => {
    const testUserInput = 'Another input';
    const invalidJsonResponse = 'This is not JSON'; // Invalid JSON response

    // Mock the sendLLMPrompt method to return invalid JSON
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(invalidJsonResponse);

    const result = await agent.handleMessage({ input: testUserInput, conversationHistory: [] });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: expect.stringContaining('Error processing LLM preference response: Unexpected token') });
  });

  it('should handle LLM response with invalid preference structure', async () => {
    const testUserInput = 'Input with bad preference structure';
    const invalidPreferenceResponse = '{"notPreferences": "..."}'; // LLM response with incorrect structure

    // Mock the sendLLMPrompt method to return a JSON string with invalid structure
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(invalidPreferenceResponse);

    const result = await agent.handleMessage({ input: testUserInput, conversationHistory: [] });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({ error: 'Invalid structure in LLM preference response.', preferences: {} });
  });

  it('should include conversation history in the prompt sent to the LLM', async () => {
    const userId = 'history-user';
    const conversationHistory = [
      { role: 'user', content: 'I like dry red wine.' },
      { role: 'assistant', content: 'That is a great choice!' },
    ];
    const testMessage = {
      userId: userId,
      input: { userInput: 'What about a wine for pasta?' },
      conversationHistory: conversationHistory,
    };

    const mockLlmResponse = '{"preferences": {"foodPairing": "pasta"}}';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    await agent.handleMessage(testMessage);

    // Expect AgentCommunicationBus.sendLLMPrompt to have been called
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    // Get the prompt that was sent to the LLM
    const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];

    // Verify that the prompt includes elements from the conversation history
    expect(sentPrompt).toContain(conversationHistory[0].content);
    expect(sentPrompt).toContain(conversationHistory[1].content);
    expect(sentPrompt).toContain(testMessage.input.userInput);
  });
});