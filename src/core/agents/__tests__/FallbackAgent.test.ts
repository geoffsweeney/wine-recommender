import 'reflect-metadata';
import { container } from 'tsyringe';
import { FallbackAgent } from '../FallbackAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService'; // Import LLMService

// Mock the LLMService module
jest.mock('../../../services/LLMService');

const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;

describe('FallbackAgent Integration with LLMService', () => {
  let agent: FallbackAgent;
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

    // Resolve the FallbackAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the factory we just registered) and inject
    // the mocked LLMService into it.
    agent = container.resolve(FallbackAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockLlmServiceInstance = MockLLMService.mock.instances[0] as jest.Mocked<LLMService>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should send the user input to the LLMService and return a fallback response', async () => {
    const testUserInput = 'Some unhandled query';
    const mockLlmResponse = 'I am sorry, I cannot help with that.'; // Mock LLM fallback response

    // Mock the sendPrompt method of the mocked LLMService
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage(testUserInput);

    // Expect LLMService.sendPrompt to have been called with a prompt based on the user input
    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();
    const sentPrompt = mockLlmServiceInstance.sendPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testUserInput);
    expect(sentPrompt).toContain('user-friendly fallback message'); // Check for prompt structure hint

    // Expect the result to contain the fallback response from the LLM
    expect(result).toEqual({ recommendation: mockLlmResponse });
  });

  it('should handle cases where LLMService does not return a response', async () => {
    const testUserInput = 'Another unhandled query';

    // Mock the sendPrompt method to return undefined
    mockLlmServiceInstance.sendPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage(testUserInput);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    // Expect a default fallback message if LLM doesn't respond
    expect(result).toEqual({ recommendation: 'Sorry, I encountered an issue and cannot provide a recommendation at this time. Please try again later.' });
  });

  it('should handle errors during LLMService communication', async () => {
    const testUserInput = 'Query causing error';
    const mockError = new Error('LLM communication failed');

    // Mock the sendPrompt method to throw an error
    mockLlmServiceInstance.sendPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testUserInput);

    expect(mockLlmServiceInstance.sendPrompt).toHaveBeenCalled();

    // Expect a default fallback message on error
    expect(result).toEqual({ recommendation: 'Sorry, I encountered an issue and cannot provide a recommendation at this time. Please try again later.' });
  });
});