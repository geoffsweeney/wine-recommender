import 'reflect-metadata';
import { DependencyContainer } from 'tsyringe';
import { createTestContainer } from '../../test-setup';
import { UserPreferences } from '../../types';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { UserProfileService } from '../UserProfileService';
import { TYPES } from '../../di/Types'; // Add this import

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>;
  let container: DependencyContainer;
  let resetMocks: () => void;

  beforeEach(() => {
    ({ container, resetMocks } = createTestContainer());

    mockKnowledgeGraphService = container.resolve(TYPES.KnowledgeGraphService) as jest.Mocked<KnowledgeGraphService>;

    service = container.resolve(UserProfileService);
  });

  afterEach(() => {
    resetMocks();
  });

  describe('getPreferences', () => {
    it('should retrieve user preferences from KnowledgeGraphService and map them correctly', async () => {
      const userId = 'test-user-123';
      const mockPreferenceNodes = [
        { type: 'wineType', value: 'Red', source: 'manual', confidence: 1.0, timestamp: Date.now(), active: true },
        { type: 'sweetness', value: 'Dry', source: 'manual', confidence: 1.0, timestamp: Date.now(), active: true },
      ];
      mockKnowledgeGraphService.getPreferences.mockResolvedValue(mockPreferenceNodes);

      const expectedPreferences: UserPreferences = {
        wineType: 'Red',
        sweetness: 'Dry',
      };

      const result = await service.getPreferences(userId);

      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedPreferences);
    });

    it('should return an empty object if no preferences are found', async () => {
      const userId = 'test-user-123';
      mockKnowledgeGraphService.getPreferences.mockResolvedValue([]);

      const result = await service.getPreferences(userId);

      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual({});
    });

    it('should handle preferences with unknown types gracefully', async () => {
      const userId = 'test-user-123';
      const mockPreferenceNodes = [
        { type: 'wineType', value: 'Red', source: 'manual', confidence: 1.0, timestamp: Date.now(), active: true },
        { type: 'unknownType', value: 'SomeValue', source: 'manual', confidence: 1.0, timestamp: Date.now(), active: true },
      ];
      mockKnowledgeGraphService.getPreferences.mockResolvedValue(mockPreferenceNodes);

      const expectedPreferences: UserPreferences = {
        wineType: 'Red',
      };

      const result = await service.getPreferences(userId);

      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedPreferences);
    });
  });

  describe('savePreferences', () => {
    it('should save user preferences to KnowledgeGraphService', async () => {
      const userId = 'test-user-123';
      const preferencesToSave: UserPreferences = {
        wineType: 'White',
        region: 'Marlborough',
      };

      await service.savePreferences(userId, preferencesToSave);

      expect(mockKnowledgeGraphService.addOrUpdateUserPreferences).toHaveBeenCalledTimes(1);
      const calledWithArgs = mockKnowledgeGraphService.addOrUpdateUserPreferences.mock.calls[0];
      expect(calledWithArgs[0]).toBe(userId);
      expect(calledWithArgs[1]).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'wineType', value: 'White' }),
        expect.objectContaining({ type: 'region', value: 'Marlborough' }),
      ]));
      // Check for default properties
      expect(calledWithArgs[1][0]).toHaveProperty('source', 'user-input');
      expect(calledWithArgs[1][0]).toHaveProperty('confidence', 1.0);
      expect(calledWithArgs[1][0]).toHaveProperty('active', true);
      expect(calledWithArgs[1][0]).toHaveProperty('timestamp'); // Check for existence, value will vary
    });

    it('should handle empty preferences object', async () => {
      const userId = 'test-user-123';
      const preferencesToSave: UserPreferences = {};

      await service.savePreferences(userId, preferencesToSave);

      expect(mockKnowledgeGraphService.addOrUpdateUserPreferences).toHaveBeenCalledWith(userId, []);
    });
  });
});