import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { PreferenceNode } from '../../../types';

describe('UserPreferenceAgent', () => {
  let agent: UserPreferenceAgent;
  const mockSynonymRegistry = {
    getCanonicalTerm: (type: string, value: string) => {
      const synonyms: Record<string, Record<string, string>> = {
        wineType: {
          'reds': 'red',
          'whites': 'white',
          'sparkling': 'sparkling'
        }
      };
      return synonyms[type]?.[value.toLowerCase()] || value;
    }
  };

  beforeEach(() => {
    // Mock dependencies for the outer describe block
    const mockCommunicationBus = { sendMessage: jest.fn() };
    const mockPreferenceExtractionService = { attemptFastExtraction: jest.fn() };
    const mockKnowledgeGraphService = { addOrUpdatePreference: jest.fn(), getPreferences: jest.fn(), deletePreference: jest.fn() };

    agent = new UserPreferenceAgent(
      mockCommunicationBus as any, // Cast to any for simplicity in test setup
      mockPreferenceExtractionService as any, // Cast to any
      mockKnowledgeGraphService as any // Cast to any
    );
  });

  describe('normalizePreferences', () => {
    it('should trim whitespace and lowercase values', () => {
      const input: PreferenceNode[] = [{
        type: 'wineType',
        value: '  Red  ',
        source: 'regex',
        confidence: 0.9,
        timestamp: new Date().toISOString(),
        active: true
      }];

      const result = agent.normalizePreferences(input);
      expect(result[0].value).toBe('red');
    });

    it('should resolve synonyms using registry', () => {
      const input: PreferenceNode[] = [{
        type: 'wineType',
        value: 'Reds',
        source: 'llm',
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        active: true
      }];

      const result = agent.normalizePreferences(input);
      expect(result[0].value).toBe('red');
    });

    it('should handle negations', () => {
      const input: PreferenceNode[] = [{
        type: 'wineType',
        value: 'not red',
        source: 'duckling',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        active: true
      }];

      const result = agent.normalizePreferences(input);
      expect(result[0].value).toBe('red');
      expect(result[0].negated).toBe(true);
    });

    it('should filter invalid values', () => {
      const input: PreferenceNode[] = [{
        type: 'alcoholContent',
        value: '150%',
        source: 'spacy',
        confidence: 0.7,
        timestamp: new Date().toISOString(),
        active: true
      }];

      const result = agent.normalizePreferences(input);
      expect(result.length).toBe(0);
    });
  });

  describe('handleMessage', () => {
    let mockCommunicationBus: any;
    let mockPreferenceExtractionService: any;
    let mockKnowledgeGraphService: any;

    beforeEach(() => {
      // Mock dependencies
      mockCommunicationBus = { sendMessage: jest.fn() };
      mockPreferenceExtractionService = { attemptFastExtraction: jest.fn() };
      mockKnowledgeGraphService = { addOrUpdatePreference: jest.fn(), getPreferences: jest.fn(), deletePreference: jest.fn() }; // Add other methods as needed

      // Create a new agent instance with mocked dependencies
      agent = new UserPreferenceAgent(
        mockCommunicationBus,
        mockPreferenceExtractionService,
        mockKnowledgeGraphService
      );
    });

    it('should attempt fast extraction and persist normalized preferences if successful', async () => {
      const mockFastPreferences = { wineType: 'red', sweetness: 'dry' };
      mockPreferenceExtractionService.attemptFastExtraction.mockReturnValue(mockFastPreferences);

      // Mock the normalizePreferences method to return a predictable output
      const mockNormalizedPreferences: PreferenceNode[] = [
        { type: 'wineType', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: '', active: true },
        { type: 'sweetness', value: 'dry', source: 'fast-extraction', confidence: 1, timestamp: '', active: true },
      ];
      // Temporarily mock the actual normalizePreferences implementation
      const originalNormalizePreferences = agent.normalizePreferences;
      agent.normalizePreferences = jest.fn().mockReturnValue(mockNormalizedPreferences);


      const message = { input: 'I like dry red wine', conversationHistory: [], userId: 'test-user' };
      const result = await agent.handleMessage(message);

      expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith(message.input);
      expect(agent.normalizePreferences).toHaveBeenCalledWith([ // Expect normalizePreferences to be called with raw PreferenceNodes
        { type: 'wineType', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: expect.any(String), active: true },
        { type: 'sweetness', value: 'dry', source: 'fast-extraction', confidence: 1, timestamp: expect.any(String), active: true },
      ]);
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledTimes(mockNormalizedPreferences.length);
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(message.userId, mockNormalizedPreferences[0]);
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(message.userId, mockNormalizedPreferences[1]);
      expect(result).toEqual({ preferences: mockNormalizedPreferences });

      // Restore the original normalizePreferences implementation
      agent.normalizePreferences = originalNormalizePreferences;
    });

    it('should queue for async LLM extraction if fast extraction fails', async () => {
      mockPreferenceExtractionService.attemptFastExtraction.mockReturnValue(null);
      const message = { input: 'Recommend a wine I would like', conversationHistory: [], userId: 'test-user' };

      const result = await agent.handleMessage(message);

      expect(mockPreferenceExtractionService.attemptFastExtraction).toHaveBeenCalledWith(message.input);
      expect(mockCommunicationBus.sendMessage).toHaveBeenCalledWith('LLMPreferenceExtractorAgent', {
        input: message.input,
        history: message.conversationHistory,
        userId: message.userId,
      });
      expect(result).toEqual({ preferences: {}, error: 'Analyzing your input for preferences asynchronously.' });
    });

    // TODO: Add more tests for handleMessage, including error handling

  });
});
