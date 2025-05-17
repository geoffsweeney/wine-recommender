import { container } from 'tsyringe';
import { RecommendationAgent } from '../RecommendationAgent';
import { LLMService } from '../../../services/LLMService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { DeadLetterProcessor } from '../../../core/DeadLetterProcessor'; // Adjusted import path
import winston from 'winston';

describe('RecommendationAgent', () => {
  let recommendationAgent: RecommendationAgent;
  let mockLLMService: jest.Mocked<LLMService>; // Updated to use jest.Mocked
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>; // Updated to use jest.Mocked
  let mockDeadLetterProcessor: jest.Mocked<DeadLetterProcessor>; // Updated to use jest.Mocked

  beforeEach(() => {
    mockLLMService = { sendPrompt: jest.fn() } as any;
    mockKnowledgeGraphService = { findWinesByIngredients: jest.fn(), findWinesByPreferences: jest.fn() } as any;
    mockDeadLetterProcessor = { process: jest.fn() } as any;

    container.register('LLMService', { useValue: mockLLMService });
    container.register('KnowledgeGraphService', { useValue: mockKnowledgeGraphService });
    container.register('DeadLetterProcessor', { useValue: mockDeadLetterProcessor });
    container.register('Logger', { useValue: winston.createLogger({ level: 'info' }) });

    recommendationAgent = new RecommendationAgent(mockLLMService, mockKnowledgeGraphService, mockDeadLetterProcessor, container.resolve('Logger'));
  });

  it('should handle ingredient-based requests', async () => {
    const message = { input: { ingredients: ['chocolate', 'vanilla'] } };
    const wines = [{ id: '1', name: 'Wine A', region: 'Region A', type: 'Red' }];
    mockKnowledgeGraphService.findWinesByIngredients.mockResolvedValue(wines);
    mockLLMService.sendPrompt.mockResolvedValue(JSON.stringify({ recommendedWines: wines }));

    const result = await recommendationAgent.handleMessage(message);
    expect(result.recommendedWines).toEqual(wines);
  });

  it('should handle preference-based requests', async () => {
    const message = { input: { preferences: ['sweet', 'fruity'] } };
    const wines = [{ id: '2', name: 'Wine B', region: 'Region B', type: 'White' }];
    mockKnowledgeGraphService.findWinesByPreferences.mockResolvedValue(wines);
    mockLLMService.sendPrompt.mockResolvedValue(JSON.stringify({ recommendedWines: wines }));

    const result = await recommendationAgent.handleMessage(message);
    expect(result.recommendedWines).toEqual(wines);
  });

  it('should return a message when no wines are found', async () => {
    const message = { input: { ingredients: ['unknown'] } };
    mockKnowledgeGraphService.findWinesByIngredients.mockResolvedValue([]);

    const result = await recommendationAgent.handleMessage(message);
    expect(result.recommendation).toContain("Sorry, we couldn't find any wines based on the provided ingredients.");
  });

  it('should handle errors gracefully', async () => {
    const message = { input: { ingredients: ['chocolate'] } };
    const error = new Error('Test error');
    mockKnowledgeGraphService.findWinesByIngredients.mockRejectedValue(error);

    await expect(recommendationAgent.handleMessage(message)).rejects.toThrow(error);
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(message, error, expect.any(Object));
    expect(mockDeadLetterProcessor.process).toHaveBeenCalledWith(message, error, expect.any(Object));
  });

  it('should include conversation history in the prompt sent to the LLM for preference-based requests', async () => {
    const userId = 'history-user-rec';
    const conversationHistory = [
      { role: 'user', content: 'I like dry red wine.' },
      { role: 'assistant', content: 'That is a great choice!' },
    ];
    const message = {
      userId: userId,
      input: { preferences: { foodPairing: 'pasta' } },
      conversationHistory: conversationHistory,
    };

    const wines = [{ id: '3', name: 'Wine C', region: 'Region C', type: 'Red' }];
    mockKnowledgeGraphService.findWinesByPreferences.mockResolvedValue(wines);
    mockLLMService.sendPrompt.mockResolvedValue(JSON.stringify({ recommendedWines: wines }));

    await recommendationAgent.handleMessage(message);

    // Expect KnowledgeGraphService to be called with preferences
    expect(mockKnowledgeGraphService.findWinesByPreferences).toHaveBeenCalledWith(message.input.preferences);

    // Expect LLMService.sendPrompt to have been called
    expect(mockLLMService.sendPrompt).toHaveBeenCalled();

    // Get the prompt that was sent to the LLM
    const sentPrompt = mockLLMService.sendPrompt.mock.calls[0][0];

    // Verify that the prompt includes elements from the conversation history
    expect(sentPrompt).toContain(conversationHistory[0].content);
    expect(sentPrompt).toContain(conversationHistory[1].content);
    expect(sentPrompt).toContain(JSON.stringify(message.input.preferences)); // Check if preferences are included
  });
});