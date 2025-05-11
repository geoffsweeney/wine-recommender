import "reflect-metadata";
import { container } from 'tsyringe';
import { InputValidationAgent } from '../InputValidationAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService'; // Import LLMService

// Mock the LLMService module
// Mock the AgentCommunicationBus module
jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

describe('InputValidationAgent Integration with AgentCommunicationBus', () => {
  let agent: InputValidationAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockAgentCommunicationBus.mockClear();
    container.clearInstances(); // Clear container before each test

    // Bind the mocked AgentCommunicationBus to the container
    container.register<AgentCommunicationBus>(AgentCommunicationBus, { useClass: MockAgentCommunicationBus });

    // Resolve the InputValidationAgent. This will cause tsyringe to resolve
    // AgentCommunicationBus (using the mock we just registered) and inject it.
    agent = container.resolve(InputValidationAgent);

    // Get the mock instance created by tsyringe and jest.mock
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
  });

  afterEach(() => {
    // Clear the container after each test
    container.clearInstances();
  });

  it('should send the user input to the LLMService via the communication bus for validation and return the LLM response', async () => {
    const testUserInput = 'I want a sweet red wine';
    const mockLlmResponse = '{"isValid": true, "ingredients": ["grape"], "preferences": {"wineType": "red", "sweetness": "dry"}}'; // Mock LLM response as a JSON string

   // Mock the sendLLMPrompt method of the mocked AgentCommunicationBus to return a JSON string
   mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

   const result = await agent.handleMessage(testUserInput);

   // Expect AgentCommunicationBus.sendLLMPrompt to have been called with a prompt based on the user input
   expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
   const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];
   expect(sentPrompt).toContain(testUserInput);
   expect(sentPrompt).toContain('Analyze the following user input for a wine recommendation request.'); // Check for prompt structure hint

   // Expect the result to contain the parsed LLM response
   expect(result).toEqual({
     isValid: true,
     processedInput: {
       ingredients: ["grape"],
       preferences: { wineType: 'red', sweetness: 'dry' },
     },
   });
 });

  it('should handle cases where LLMService does not return a response via the communication bus', async () => {
    const testUserInput = 'Tell me about beer';

    // Mock the sendLLMPrompt method to return undefined
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage(testUserInput);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({
      isValid: false,
      error: 'LLM failed to provide validation response.',
    });
  });

  it('should handle errors during LLMService communication via the communication bus', async () => {
    const testUserInput = 'Invalid query';
    const mockError = new Error('LLM API error');

    // Mock the sendLLMPrompt method to throw an error
    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage(testUserInput);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    expect(result).toEqual({
      isValid: false,
      error: 'Error communicating with LLM for validation.',
    });
  });

  it('should handle invalid JSON response format from LLMService via the communication bus', async () => {
    const testUserInput = 'Another query';
    const invalidJsonResponse = 'This is not JSON'; // Invalid JSON response

    // Mock the sendLLMPrompt method to return invalid JSON
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(invalidJsonResponse);

    const result = await agent.handleMessage(testUserInput);

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();

    // The error message will contain the specific parsing error, so we check for a substring
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Error processing LLM validation response:');
    expect(result.error).toContain('Unexpected token');
  });
});