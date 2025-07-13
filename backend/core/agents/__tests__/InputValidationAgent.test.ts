import { mockDeep } from 'jest-mock-extended';
import { createAgentMessage } from '../communication/AgentMessage';
import { AgentError } from '../AgentError';
import { InputValidationAgent } from '../InputValidationAgent';
import { BasicDeadLetterProcessor } from '../../DeadLetterProcessor';

import winston from 'winston';
import { ICommunicatingAgentDependencies } from '../../../di/Types';

// Test wrapper to access protected methods and properties for testing
class TestInputValidationAgent extends InputValidationAgent {
  public testValidateInput(input: any, correlationId?: string) {
    return this.validateInput(input, correlationId);
  }

  // Expose protected 'id' for testing purposes
  public getAgentId(): string {
    return this.id;
  }
}

describe('InputValidationAgent', () => {
  let mockBus: any;
  let mockDeadLetter: BasicDeadLetterProcessor;
  let mockLogger: winston.Logger;
  let agent: TestInputValidationAgent;
  let mockAgentConfig: any;
  let mockLLMService: any; // Declare mockLLMService here
  let mockPromptManager: any; // Declare mockPromptManager here
  let mockCommunicatingAgentDependencies: ICommunicatingAgentDependencies;

  beforeEach(() => {
    mockBus = mockDeep<any>();
    mockDeadLetter = mockDeep<BasicDeadLetterProcessor>();
    mockLogger = mockDeep<winston.Logger>();
    mockAgentConfig = { // Mock the injected config
      ingredientDatabasePath: './data/ingredients.json',
      dietaryRestrictions: ['vegetarian', 'vegan', 'gluten-free', 'kosher', 'halal'],
      standardIngredients: {
        'salmon': 'fish',
        'beef': 'meat',
      },
      maxIngredients: 10
    };
    mockLLMService = mockDeep<any>(); // Initialize mockLLMService here
    mockPromptManager = mockDeep<any>(); // Initialize mockPromptManager here
    mockCommunicatingAgentDependencies = {
      communicationBus: mockBus,
      logger: mockLogger,
      messageQueue: {} as any,
      stateManager: {} as any,
      config: mockAgentConfig as any,
    };

    agent = new TestInputValidationAgent(mockDeadLetter, mockAgentConfig, mockLLMService, mockPromptManager, mockCommunicatingAgentDependencies);

    // Reset mocks before each test to ensure isolation
    jest.clearAllMocks(); // Clear all mocks before each test
  });

  describe('validateInput', () => {
    // Default mock for sendStructuredPrompt for validateInput tests
    beforeEach(() => {
      mockLLMService.sendStructuredPrompt.mockResolvedValue({
        success: true,
        data: {
          isValid: true,
          cleanedInput: {
            ingredients: ['mocked-ingredient'],
            budget: 100
          },
          extractedData: {}
        }
      });
    });

    it('should accept valid input with all required fields', async () => {
      const validInput = {
        ingredients: ['chicken', 'garlic'],
        budget: 50,
        dietaryRestrictions: [],
        correlationId: '123'
      };

      const result = await agent.testValidateInput(validInput, validInput.correlationId);
      expect(result.success).toBe(true);
      if (result.success) { // Narrow the type for data access
        expect(result.data.isValid).toBe(true);
      }
    });

    it('should reject empty ingredients list', async () => {
      const invalidInput = {
        ingredients: [],
        budget: 50,
        dietaryRestrictions: [],
        correlationId: '123'
      };

      mockLLMService.sendStructuredPrompt.mockResolvedValueOnce({
        success: true,
        data: {
          isValid: false,
          errors: ['At least one ingredient must be provided'],
          cleanedInput: { ingredients: [], budget: 50 },
          extractedData: {}
        }
      });

      const result = await agent.testValidateInput(invalidInput, invalidInput.correlationId);
      expect(result.success).toBe(true); // LLM call itself is successful
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.errors).toContain('At least one ingredient must be provided');
      }
    });

    it('should reject invalid budget values', async () => {
      const invalidInput = {
        ingredients: ['chicken'],
        budget: -10,
        dietaryRestrictions: [],
        correlationId: '123'
      };

      mockLLMService.sendStructuredPrompt.mockResolvedValueOnce({
        success: true,
        data: {
          isValid: false,
          errors: ['Budget must be a positive number'],
          cleanedInput: { ingredients: ['chicken'], budget: -10 },
          extractedData: {}
        }
      });

      const result = await agent.testValidateInput(invalidInput, invalidInput.correlationId);
      expect(result.success).toBe(true); // LLM call itself is successful
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.errors).toContain('Budget must be a positive number');
      }
    });

    it('should normalize ingredient names', async () => {
      const input = {
        ingredients: ['ChIcKeN', 'GARLIC clove'],
        budget: 50,
        dietaryRestrictions: [],
        correlationId: '123'
      };

      // Specific mock for this test
      mockLLMService.sendStructuredPrompt.mockResolvedValueOnce({
        success: true,
        data: {
          isValid: true,
          cleanedInput: {
            ingredients: ['chicken', 'garlic clove'],
            budget: 50
          },
          extractedData: {
            standardizedIngredients: {
              'chicken': 'chicken',
              'garlic clove': 'garlic'
            }
          }
        }
      });
      const result = await agent.testValidateInput(input, input.correlationId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extractedData?.standardizedIngredients).toEqual({
          'chicken': 'chicken',
          'garlic clove': 'garlic'
        });
      }
    });

    it('should validate dietary restrictions via LLM', async () => {
      const input = {
        ingredients: ['chicken'],
        budget: 50,
        dietaryRestrictions: ['invalid-restriction'],
        correlationId: '123'
      };

      // Specific mock for this test
      mockLLMService.sendStructuredPrompt.mockResolvedValueOnce({
        success: true,
        data: {
          isValid: false,
          errors: ['Unsupported dietary restriction: invalid-restriction'],
          cleanedInput: input,
          extractedData: {}
        }
      });

      const result = await agent.testValidateInput(input, input.correlationId);
      expect(result.success).toBe(true); // The LLM call itself is successful, but the LLM found invalid input
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.errors).toContain('Unsupported dietary restriction: invalid-restriction');
      }
    });
  });

  describe('handleMessage (fallback)', () => {
    it('should return an error for unhandled message types', async () => {
      const message = createAgentMessage(
        'unhandled-type', // This message type is not registered
        { some: 'payload' },
        'test-agent',
        'test-conversation-id',
        'corr-unhandled',
        'InputValidationAgent',
        'NORMAL',
        undefined, // userId (optional, not used here)
        { sender: 'test-agent', traceId: 'test-trace-unhandled' } // metadata
      );

      const response = await agent.handleMessage(message);
      expect(response.success).toBe(false);
      if (!response.success) { // Narrow the type for error access
        expect(response.error).toBeInstanceOf(AgentError);
        expect(response.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
        expect(response.error.correlationId).toBe('corr-unhandled');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('InputValidationAgent received unhandled message type: unhandled-type'),
          expect.objectContaining({
            agentId: agent.getAgentId(),
            operation: 'handleMessage',
            correlationId: 'corr-unhandled',
            messageType: 'unhandled-type'
          })
        );
      }
    });
  });

  describe('error handling', () => {
    it('should handle AgentError with correlationId', async () => {
      const message = createAgentMessage(
        'validate-input',
        {}, // Invalid payload
        'test-agent',
        'test-conversation-id', // Added conversationId
        'error-test', // correlationId
        'InputValidationAgent', // Added targetAgent
        'NORMAL', // priority
        undefined, // userId (optional, not used here)
        { sender: 'test-agent', traceId: 'test-trace-123' } // metadata
      );

      const response = await agent.handleValidationRequest({ ...message, payload: { userInput: { message: 'test input', recommendationSource: 'test' } } }); // Use handleValidationRequest with correct payload
      expect(response.success).toBe(false);
      if (!response.success) { // Narrow the type for error access
        expect(response.error).toBeInstanceOf(AgentError);
        expect(response.error.correlationId).toBe('error-test');
      }
    });
  });
});
