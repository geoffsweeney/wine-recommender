import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { PreferenceNode } from '../../../types';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { PreferenceExtractionService } from '../../../services/PreferenceExtractionService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../../services/PreferenceNormalizationService';
import { Neo4jService } from '../../../services/Neo4jService'; // Import Neo4jService

// Mock the dependency modules
jest.mock('../../AgentCommunicationBus');
jest.mock('../../../services/PreferenceExtractionService');
jest.mock('../../../services/KnowledgeGraphService');
jest.mock('../../../services/PreferenceNormalizationService');
jest.mock('../../../services/Neo4jService'); // Mock Neo4jService

const MockAgentCommunicationBus = AgentCommunicationBus as jest.MockedClass<typeof AgentCommunicationBus>;
const MockPreferenceExtractionService = PreferenceExtractionService as jest.MockedClass<typeof PreferenceExtractionService>;
const MockKnowledgeGraphService = KnowledgeGraphService as jest.MockedClass<typeof KnowledgeGraphService>;
const MockPreferenceNormalizationService = PreferenceNormalizationService as jest.MockedClass<typeof PreferenceNormalizationService>;
const MockNeo4jService = Neo4jService as jest.MockedClass<typeof Neo4jService>; // Mocked class for Neo4jService

describe('UserPreferenceAgent', () => {
  let agent: UserPreferenceAgent;
  let mockCommunicationBusInstance: jest.Mocked<AgentCommunicationBus>;
  let mockPreferenceExtractionServiceInstance: jest.Mocked<PreferenceExtractionService>;
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>;
  let mockPreferenceNormalizationServiceInstance: jest.Mocked<PreferenceNormalizationService>;
  let mockNeo4jServiceInstance: jest.Mocked<Neo4jService>; // Mocked instance for Neo4jService

  beforeEach(() => {
    // Clear mock instances and reset mocks
    MockAgentCommunicationBus.mockClear();
    MockPreferenceExtractionService.mockClear();
    MockKnowledgeGraphService.mockClear();
    MockPreferenceNormalizationService.mockClear();
    MockNeo4jService.mockClear(); // Clear Neo4jService mock

    // Create new instances of the mocked classes, providing dependencies as needed
    // KnowledgeGraphService requires Neo4jService in its constructor
    mockNeo4jServiceInstance = new MockNeo4jService() as jest.Mocked<Neo4jService>; // Create and cast Neo4jService mock instance
    mockKnowledgeGraphServiceInstance = new MockKnowledgeGraphService(mockNeo4jServiceInstance) as jest.Mocked<KnowledgeGraphService>; // Provide Neo4jService mock

    mockCommunicationBusInstance = new MockAgentCommunicationBus() as jest.Mocked<AgentCommunicationBus>;
    mockPreferenceExtractionServiceInstance = new MockPreferenceExtractionService() as jest.Mocked<PreferenceExtractionService>;
    mockPreferenceNormalizationServiceInstance = new MockPreferenceNormalizationService() as jest.Mocked<PreferenceNormalizationService>;


    // Create a new agent instance with mocked dependency instances
    agent = new UserPreferenceAgent(
      mockCommunicationBusInstance,
      mockPreferenceExtractionServiceInstance,
      mockKnowledgeGraphServiceInstance,
      mockPreferenceNormalizationServiceInstance
    );

    // Mock specific methods used in tests
    mockKnowledgeGraphServiceInstance.getPreferences.mockResolvedValue([]); // Default mock for getPreferences
  });

  describe('handleMessage', () => {
    it('should attempt fast extraction and persist normalized preferences if successful', async () => {
      const mockFastPreferences = { wineType: 'red', sweetness: 'dry' };
      mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(mockFastPreferences);

      const mockNormalizedPreferences: PreferenceNode[] = [
        { type: 'wineType', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: '', active: true },
        { type: 'sweetness', value: 'dry', source: 'fast-extraction', confidence: 1, timestamp: '', active: true },
      ];
      mockPreferenceNormalizationServiceInstance.normalizePreferences.mockReturnValue(mockNormalizedPreferences);


      const message = { input: 'I like dry red wine', conversationHistory: [], userId: 'test-user' };
      const result = await agent.handleMessage(message);

      expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(message.input);

      // Expect normalizePreferences of the service to be called with the correct raw PreferenceNodes
      expect(mockPreferenceNormalizationServiceInstance.normalizePreferences).toHaveBeenCalledWith([
        { type: 'wineType', value: 'red', source: 'fast-extraction', confidence: 1, timestamp: expect.any(String), active: true },
        { type: 'sweetness', value: 'dry', source: 'fast-extraction', confidence: 1, timestamp: expect.any(String), active: true },
      ]);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledTimes(mockNormalizedPreferences.length);
      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(message.userId, mockNormalizedPreferences[0]);
      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(message.userId, mockNormalizedPreferences[1]);
      expect(result).toEqual({ preferences: mockNormalizedPreferences });
    });

    it('should queue for async LLM extraction if fast extraction fails', async () => {
      mockPreferenceExtractionServiceInstance.attemptFastExtraction.mockResolvedValue(null);
      const message = { input: 'Recommend a wine I would like', conversationHistory: [], userId: 'test-user' };

      const result = await agent.handleMessage(message);

      expect(mockPreferenceExtractionServiceInstance.attemptFastExtraction).toHaveBeenCalledWith(message.input);
      expect(mockCommunicationBusInstance.sendMessage).toHaveBeenCalledWith('LLMPreferenceExtractorAgent', {
        input: message.input,
        history: message.conversationHistory,
        userId: message.userId,
      });
      expect(result).toEqual({ preferences: [], error: 'Analyzing your input for preferences asynchronously.' });
    });

    // TODO: Add more tests for handleMessage, including error handling
  });
});
