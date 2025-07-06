import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LLMService } from '../LLMService';

export const createMockLLMService = (): DeepMockProxy<LLMService> => {
  const mockLLMService = mockDeep<LLMService>();

  // Default mock implementation for sendPrompt
  mockLLMService.sendPrompt.mockResolvedValue({ success: true, data: 'Mocked LLM response' });

  return mockLLMService;
};