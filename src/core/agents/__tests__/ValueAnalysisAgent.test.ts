import "reflect-metadata";
import { container } from 'tsyringe'; // Import container
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus'; // Correct import path

// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

describe('ValueAnalysisAgent', () => {
  let agent: ValueAnalysisAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>; // Mock instance type

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockAgentCommunicationBus.mockClear();

    // Resolve the ValueAnalysisAgent using the container.
    // This will cause tsyringe to resolve AgentCommunicationBus,
    // triggering the mocked constructor and creating a mock instance.
    agent = container.resolve(ValueAnalysisAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('ValueAnalysisAgent');
  });

  // TODO: Add tests for LLM interaction in handleMessage
  it('should process the received message and perform value analysis via LLM', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { data: 'some wine data' };
    const mockLlmAnalysis = 'This wine offers good value...';

    // Mock the sendLLMPrompt method to return a predefined analysis
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmAnalysis);

    const result = await agent.handleMessage(testMessage);

    expect(consoleSpy).toHaveBeenCalledWith('ValueAnalysisAgent received message:', testMessage);
    // Expect sendLLMPrompt to have been called
    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    // Expect the result to contain the analysis from the mocked LLM call
    expect(result).toEqual({ analysis: mockLlmAnalysis });

    consoleSpy.mockRestore();
  });

  it('should handle LLM communication errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const testMessage = { data: 'some wine data' };
    const mockError = new Error('LLM communication failed');

    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testMessage);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('ValueAnalysisAgent: Error during LLM value analysis:', mockError);
    expect(result).toEqual({ error: 'Error communicating with LLM for analysis.' });

    consoleSpy.mockRestore();
  });
});
