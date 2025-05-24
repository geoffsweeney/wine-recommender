import "reflect-metadata";
import { container } from 'tsyringe';
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService'; // Import LLMService

// Mock the LLMService module for integration tests
jest.mock('../../../services/LLMService');

const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;

describe('ValueAnalysisAgent Integration with LLMService', () => {
  let agent: ValueAnalysisAgent;
  let mockLlmServiceInstance: jest.Mocked<LLMService>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockLLMService.mockClear();
    container.clearInstances(); // Clear container before each test

    // Bind the mocked LLMService to the container
    container.register<LLMService>(LLMService, { useClass: MockLLMService });

    // Explicitly register AgentCommunicationBus with the mocked LLMService
    container.register<AgentCommunicationBus>(AgentCommunicationBus, {
      useFactory: (c) => new AgentCommunicationBus(c.resolve(LLMService)),
    });

    // Resolve the ValueAnalysisAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the factory we just registered) and inject
    // the mocked LLMService into it.
    agent = container.resolve(ValueAnalysisAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockLlmServiceInstance = MockLLMService.mock.instances[0] as jest.Mocked<LLMService>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should send the input data to the LLMService for value analysis and return the analysis', async () => {
    const testInputData = { wine: 'Expensive Wine', price: 100 };
    const mockLlmResponse = 'This wine is overpriced.'; // Mock LLM analysis response

    // Mock the sendPrompt method of the mocked LLMService
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage(testInputData);

    // Expect LLMService.sendPrompt to have been called with a prompt based on the input data
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    const sentPrompt = mockLlmServiceInstance.sendPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testInputData.wine); // Check if the prompt contains the wine name
    expect(sentPrompt).toContain('value analysis'); // Check for prompt structure hint

    // Expect the result to contain the analysis from the LLM
    expect(result).toEqual({ analysis: mockLlmResponse });
  });

  it('should handle cases where LLMService does not return a response', async () => {
    const testInputData = { wine: 'Cheap Wine', price: 10 };

    // Mock the sendPrompt method to return undefined
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage(testInputData);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    // Expect an error message if LLM doesn't respond
    expect(result).toEqual({ analysis: 'Basic analysis not available.' }); // Expect the fallback message
  });

  it('should handle errors during LLMService communication', async () => {
    const testInputData = { wine: 'Another Wine', price: 50 };
    const mockError = new Error('LLM communication failed');

    // Mock the sendPrompt method to throw an error
    mockLlmServiceInstance.sendPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testInputData);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    // Expect an error message on error
    expect(result).toEqual({ error: 'Error communicating with LLM for analysis.' }); // Expect the correct error message
  });
});