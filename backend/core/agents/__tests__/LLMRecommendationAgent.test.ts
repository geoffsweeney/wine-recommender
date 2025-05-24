import 'reflect-metadata';
import { container } from 'tsyringe';
import { LLMRecommendationAgent } from '../LLMRecommendationAgent';
import { LLMService } from '../../../services/LLMService';
import { ConversationTurn } from '../../ConversationHistoryService'; // Import ConversationTurn

// Mock the dependencies
jest.mock('../../../services/LLMService');

const MockLLMService = LLMService as jest.Mock<LLMService>;

describe('LLMRecommendationAgent', () => {
  let llmRecommendationAgent: LLMRecommendationAgent;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    container.clearInstances();
    container.reset();

    mockLLMService = {
      getCompletion: jest.fn(),
      sendPrompt: jest.fn(), // Changed getChatCompletion to sendPrompt
    } as any;
 
    container.registerInstance(LLMService, mockLLMService);
 
    llmRecommendationAgent = container.resolve(LLMRecommendationAgent);
 
    jest.clearAllMocks();
  });
 
  it('should be defined', () => {
    expect(llmRecommendationAgent).toBeDefined();
  });
 
  it('should call LLMService.sendPrompt and return the recommendation', async () => { // Updated test description
    const mockMessage = { input: { message: 'test message', preferences: { wineType: 'red' } }, conversationHistory: [{ role: 'user', content: 'previous message' }] } as { input: { preferences?: any; message?: string | undefined; ingredients?: string[] | undefined; recommendationSource?: "knowledgeGraph" | "llm" | undefined; }; conversationHistory: ConversationTurn[]; }; // More comprehensive mock message with type assertion
    const mockLLMResponse = 'Recommended wine: Test Red';
    mockLLMService.sendPrompt.mockResolvedValue(mockLLMResponse); // Mock sendPrompt to return a specific value

    const result = await llmRecommendationAgent.handleMessage(mockMessage);

    // Expect sendPrompt to have been called with a prompt including message, preferences, and history
    expect(mockLLMService.sendPrompt).toHaveBeenCalledWith(expect.stringContaining('test message'));
    expect(mockLLMService.sendPrompt).toHaveBeenCalledWith(expect.stringContaining('"wineType":"red"'));
    expect(mockLLMService.sendPrompt).toHaveBeenCalledWith(expect.stringContaining('previous message'));


    // Expect the result to contain the recommendation from the LLM response
    expect(result).toEqual({ recommendation: mockLLMResponse });
  });
});