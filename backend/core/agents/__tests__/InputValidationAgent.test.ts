import { ConversationTurn } from '../../ConversationHistoryService';
import "reflect-metadata";
import { container } from 'tsyringe';
import { InputValidationAgent } from '../InputValidationAgent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { LLMService } from '../../../services/LLMService';
import { DeadLetterProcessor } from '../../DeadLetterProcessor';
import { BasicDeadLetterProcessor } from '../../BasicDeadLetterProcessor';


class MockDeadLetterProcessor extends DeadLetterProcessor {
  constructor() {
    super({ maxReplayAttempts: 0, retryManager: {} as any }, []);
  }

  protected async handlePermanentFailure(
    message: unknown,
    error: Error,
    metadata: Record<string, unknown>
  ): Promise<void> {
    // Mock implementation
  }
}

jest.mock('../../AgentCommunicationBus');

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;

describe('InputValidationAgent Integration with AgentCommunicationBus', () => {
  let agent: InputValidationAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;
  let processSpy: jest.SpyInstance; // Declare processSpy here

    let mockDeadLetterProcessor: DeadLetterProcessor; // Declare mockDeadLetterProcessor here
  
    beforeEach(() => {
      MockAgentCommunicationBus.mockClear();
      container.clearInstances();
  
      container.register<AgentCommunicationBus>(AgentCommunicationBus, { useClass: MockAgentCommunicationBus });
      mockDeadLetterProcessor = new MockDeadLetterProcessor(); // Assign to the top-level variable
      processSpy = jest.spyOn(mockDeadLetterProcessor, 'process'); // Spy on the process method and assign to processSpy
    container.register<DeadLetterProcessor>('DeadLetterProcessor', { useValue: mockDeadLetterProcessor });

    agent = container.resolve(InputValidationAgent);
    mockCommunicationBusInstance = MockAgentCommunicationBus.mock.instances[0] as jest.Mocked<AgentCommunicationBus>;
    // mockDeadLetterProcessorInstance is no longer needed, use processSpy directly
  });

  afterEach(() => {
    container.clearInstances();
  });

  it('should send the user input to the LLMService via the communication bus for validation and return the LLM response', async () => {
    const testUserInput = 'I want a sweet red wine';
    const mockLlmResponse = '{"isValid": true, "ingredients": ["grape"], "preferences": {"wineType": "red", "sweetness": "dry"}}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];
    expect(sentPrompt).toContain(testUserInput);
    expect(sentPrompt).toContain('Analyze the following user input for a wine recommendation request.');

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
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(undefined);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      error: 'LLM failed to provide validation response.',
    });
  });

  it('should handle errors during LLMService communication via the communication bus', async () => {
    const testUserInput = 'Invalid query';
    const mockError = new Error('LLM API error');
    mockCommunicationBusInstance.sendLLMPrompt.mockRejectedValue(mockError);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(processSpy).toHaveBeenCalledWith(
      { input: testUserInput },
      expect.any(Error),
      { source: agent.getName(), stage: 'LLMValidation' }
    );
    expect(result).toEqual({
      isValid: false,
      error: 'Error communicating with LLM for validation.',
    });
  });

  it('should handle invalid JSON response format from LLMService via the communication bus', async () => {
    const testUserInput = 'Another query';
    const invalidJsonResponse = 'This is not JSON';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(invalidJsonResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Error processing LLM validation response:');
    expect(result.error).toContain('Unexpected token');
  });

  it('should handle empty or whitespace-only input', async () => {
    const emptyInput = '';
    const whitespaceInput = '   ';

    let result = await agent.handleMessage({ input: emptyInput });
    expect(result).toEqual({
      isValid: false,
      error: 'Invalid input: message input must be a non-empty string.',
    });

    result = await agent.handleMessage({ input: whitespaceInput });
    expect(result).toEqual({
      isValid: false,
      error: 'Invalid input: message input must be a non-empty string.',
    });
  });

  it('should handle LLM response with isValid: false and an error message', async () => {
    const testUserInput = 'This is not a wine query';
    const mockLlmResponse = '{"isValid": false, "error": "Input is not related to wine."}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      error: 'Input is not related to wine.',
    });
  });

  it('should handle LLM response with isValid: true but missing optional fields', async () => {
    const testUserInput = 'Just a general wine question';
    const mockLlmResponse = '{"isValid": true}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result).toEqual({
      isValid: true,
      processedInput: {
        ingredients: undefined,
        preferences: undefined,
      },
    });
  });

  it('should handle LLM response with isValid: true and empty optional fields', async () => {
    const testUserInput = 'Any wine will do';
    const mockLlmResponse = '{"isValid": true, "ingredients": [], "preferences": {}}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result).toEqual({
      isValid: true,
      processedInput: {
        ingredients: [],
        preferences: {},
      },
    });
  });

  it('should handle LLM response with incorrect type for isValid', async () => {
    const testUserInput = 'Query with invalid isValid type';
    const mockLlmResponse = '{"isValid": "true", "ingredients": [], "preferences": {}}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: missing or invalid "isValid".');
  });

  it('should handle LLM response with incorrect type for ingredients', async () => {
    const testUserInput = 'Query with invalid ingredients type';
    const mockLlmResponse = '{"isValid": true, "ingredients": "grape", "preferences": {}}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: "ingredients" is not an array.');
  });

  it('should handle LLM response with incorrect type for preferences', async () => {
    const testUserInput = 'Query with invalid preferences type';
    const mockLlmResponse = '{"isValid": true, "ingredients": [], "preferences": "sweet"}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: "preferences" is not an object.');
  });

  it('should handle LLM response with incorrect type for error when isValid is false', async () => {
    const testUserInput = 'Query with invalid error type';
    const mockLlmResponse = '{"isValid": false, "error": 123}';

    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: "error" is not a string.');
  });

  // Additional tests

  it('should handle when AgentCommunicationBus is not available', async () => {
    // @ts-ignore
    agent = new InputValidationAgent(undefined, mockDeadLetterProcessor);
    const result = await agent.handleMessage({ input: 'test' });
    expect(result).toEqual({ isValid: false, error: 'Communication bus not available' });
  });

  it('should handle when LLM response is missing isValid field', async () => {
    const testUserInput = 'Missing isValid';
    const mockLlmResponse = '{"ingredients": ["grape"], "preferences": {}}';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: missing or invalid "isValid".');
  });

  it('should handle when LLM response has extra unexpected fields', async () => {
    const testUserInput = 'Extra fields';
    const mockLlmResponse = '{"isValid": true, "ingredients": ["grape"], "preferences": {}, "extra": 123}';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    expect(result.isValid).toBe(true);
    expect(result.processedInput).toEqual({
      ingredients: ["grape"],
      preferences: {},
    });
  });

  it('should handle when LLM response has null for optional fields', async () => {
    const testUserInput = 'Null fields';
    const mockLlmResponse = '{"isValid": true, "ingredients": null, "preferences": null}';
    mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);

    const result = await agent.handleMessage({ input: testUserInput });

    // null is not an array/object, so should error
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid structure in LLM validation response: "ingredients" is not an array.');
  });
  
    it('should include conversation history in the prompt sent to the LLM for validation', async () => {
      const userId = 'history-user-validation';

      const conversationHistory: ConversationTurn[] = [
        { role: 'user', content: 'My first message.' },
        { role: 'assistant', content: 'My first response.' },
      ];
      const testInput = 'My second message.';
      const message = {
        userId: userId,
        input: testInput,
        conversationHistory: conversationHistory,
      };
  
      const mockLlmResponse = '{"isValid": true, "processedInput": {}}';
      mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);
  
      await agent.handleMessage(message);
  
      // Expect AgentCommunicationBus.sendLLMPrompt to have been called
      expect(mockCommunicationBusInstance.sendLLMPrompt).toHaveBeenCalled();
  
      // Get the prompt that was sent to the LLM
      const sentPrompt = mockCommunicationBusInstance.sendLLMPrompt.mock.calls[0][0];
  
      // Verify that the prompt includes elements from the conversation history and current input
      expect(sentPrompt).toContain(conversationHistory[0].content);
      expect(sentPrompt).toContain(conversationHistory[1].content);
      expect(sentPrompt).toContain(testInput);
    });
  
    it('should handle when LLM response has undefined for optional fields', async () => {
      const testUserInput = 'Undefined fields';
      // JSON.stringify omits undefined, so this is same as missing fields
      const mockLlmResponse = '{"isValid": true}';
      mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);
  
      const result = await agent.handleMessage({ input: testUserInput });
  
      expect(result.isValid).toBe(true);
      expect(result.processedInput).toEqual({
        ingredients: undefined,
        preferences: undefined,
      });
    });
  
    it('should handle when LLM response has empty object', async () => {
      const testUserInput = 'Empty object';
      const mockLlmResponse = '{}';
      mockCommunicationBusInstance.sendLLMPrompt.mockResolvedValue(mockLlmResponse);
  
      const result = await agent.handleMessage({ input: testUserInput });
  
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid structure in LLM validation response: missing or invalid "isValid".');
    });
  });
