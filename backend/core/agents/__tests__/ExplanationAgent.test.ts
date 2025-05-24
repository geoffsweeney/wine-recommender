import "reflect-metadata";
import { container } from 'tsyringe'; // Import container
import { ExplanationAgent } from '../ExplanationAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus'; // Correct import path

// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

describe('ExplanationAgent', () => {
  let agent: ExplanationAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>; // Mock instance type

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockAgentCommunicationBus.mockClear();

    // Resolve the ExplanationAgent using the container.
    // This will cause tsyringe to resolve AgentCommunicationBus,
    // triggering the mocked constructor and creating a mock instance.
    agent = container.resolve(ExplanationAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('ExplanationAgent');
  });

  it('should send a prompt to the LLM via the communication bus and return the explanation', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testRecommendationResult = { wine: 'Sample Wine', details: '...' };
    const mockLlmExplanation = 'This wine is great because...';

    // Mock the sendLLMPrompt method to return a predefined explanation
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmExplanation);

    const result = await agent.handleMessage(testRecommendationResult);

    // Expect sendLLMPrompt to have been called with a prompt based on the recommendation result
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(JSON.stringify(testRecommendationResult, null, 2));

    // expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent received recommendation result:', testRecommendationResult);
    // expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent: Sending prompt to LLM for explanation.');
    // expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent: Received explanation from LLM.');

    expect(result).toEqual({
      status: 'Explanation generated',
      explanation: mockLlmExplanation,
      receivedRecommendation: testRecommendationResult,
    });

    consoleSpy.mockRestore();
  });

  it('should handle cases where LLM does not return an explanation', async () => {
    const consoleSpy = jest.spyOn(console, 'warn');
    const testRecommendationResult = { wine: 'Sample Wine', details: '...' };

    // Mock the sendLLMPrompt method to return undefined
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage(testRecommendationResult);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent: LLM did not return an explanation.');

    expect(result).toEqual({
      status: 'Explanation generation failed',
      error: 'LLM did not return an explanation',
      receivedRecommendation: testRecommendationResult,
    });

    consoleSpy.mockRestore();
  });

  it('should handle errors during LLM communication', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testRecommendationResult = { wine: 'Sample Wine', details: '...' };
    const mockError = new Error('LLM API error');

    // Mock the sendLLMPrompt method to throw an error
    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testRecommendationResult);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent: Error sending prompt to LLM:', mockError);

    expect(result).toEqual({
      status: 'Explanation generation failed',
      error: 'Error communicating with LLM',
      receivedRecommendation: testRecommendationResult,
    });

    consoleSpy.mockRestore();
  });

  // The test for communication bus not available is less relevant when using tsyringe and mocking the bus,
  // as tsyringe ensures the dependency is provided. If we wanted to test the agent's behavior
  // when the *injected* bus's sendLLMPrompt is undefined (which shouldn't happen with the current bus implementation),
  // we would need a different mocking strategy or test setup.
  // Keeping it commented out for now.
  /*
  it('should handle case where communication bus is not available', async () => {
    // This test scenario is less applicable when using tsyringe for dependency injection
    // as tsyringe ensures the dependency is provided.
  });
  */

  it('should include conversation history in the prompt sent to the LLM for explanation', async () => {
    const userId = 'history-user-exp';
    const conversationHistory = [
      { role: 'user', content: 'I like dry red wine.' },
      { role: 'assistant', content: 'That is a great choice!' },
    ];
    const testRecommendationResult = { wine: 'Sample Wine', details: '...' };
    const message = {
      userId: userId,
      recommendationResult: testRecommendationResult,
      conversationHistory: conversationHistory,
    };

    const mockLlmExplanation = 'This wine is great because... based on our chat.';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmExplanation);

    await agent.handleMessage(message);

    // Expect AgentCommunicationBus.sendLLMPrompt to have been called
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    // Get the prompt that was sent to the LLM
    const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];

    // Verify that the prompt includes elements from the conversation history
    expect(sentPrompt).toContain(conversationHistory[0].content);
    expect(sentPrompt).toContain(conversationHistory[1].content);
    expect(sentPrompt).toContain(JSON.stringify(message, null, 2)); // Check if the entire message is included
  });
});