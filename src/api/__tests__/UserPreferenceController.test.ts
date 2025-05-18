import "reflect-metadata";
import { container } from 'tsyringe';
import { UserPreferenceController } from '../controllers/UserPreferenceController';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../types';
import { Request, Response } from 'express';

// Mock the KnowledgeGraphService
jest.mock('../../services/KnowledgeGraphService');

const MockKnowledgeGraphService = KnowledgeGraphService as jest.MockedClass<typeof KnowledgeGraphService>;

describe('UserPreferenceController', () => {
  let controller: UserPreferenceController;
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    // Clear mocks and container
    MockKnowledgeGraphService.mockClear();
    container.clearInstances();

    // Register mocked dependency
    container.register<KnowledgeGraphService>(KnowledgeGraphService, { useClass: MockKnowledgeGraphService });

    // Resolve the controller
    controller = container.resolve(UserPreferenceController);

    // Get mock instance
    mockKnowledgeGraphServiceInstance = MockKnowledgeGraphService.mock.instances[0] as jest.Mocked<KnowledgeGraphService>;

    // Mock Request and Response objects
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockResponse = {
      status: statusSpy,
      json: jsonSpy, // Also mock json directly for cases without status chaining
    };
    mockRequest = {
      params: {},
      body: {},
    };
  });

  afterEach(() => {
    container.clearInstances();
  });

  describe('getPreferences', () => {
    it('should return preferences for a given user ID', async () => {
      const userId = 'test-user-123';
      const mockPreferences: PreferenceNode[] = [
        { type: 'wineType', value: 'red', source: 'manual', confidence: 1.0, timestamp: new Date().toISOString(), active: true },
        { type: 'sweetness', value: 'dry', source: 'llm', confidence: 0.9, timestamp: new Date().toISOString(), active: true },
      ];
      mockRequest.params = { userId };
      mockKnowledgeGraphServiceInstance.getPreferences.mockResolvedValue(mockPreferences);

      await controller.getPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).toHaveBeenCalledWith(userId);
      expect(statusSpy).not.toHaveBeenCalled(); // Should not set status if successful
      expect(jsonSpy).toHaveBeenCalledWith(mockPreferences);
    });

    it('should return 400 if user ID is missing', async () => {
      mockRequest.params = {}; // No userId in params

      await controller.getPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'User ID is required' });
    });

    it('should handle errors when getting preferences', async () => {
      const userId = 'test-user-error';
      const mockError = new Error('Failed to fetch from Neo4j');
      mockRequest.params = { userId };
      mockKnowledgeGraphServiceInstance.getPreferences.mockRejectedValue(mockError);

      await controller.getPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).toHaveBeenCalledWith(userId);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to retrieve preferences' });
    });
  });

  describe('addOrUpdatePreference', () => {
    it('should add or update a preference for a user', async () => {
      const userId = 'test-user-add';
      const preference: PreferenceNode = {
        type: 'wineType',
        value: 'white',
        source: 'manual',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        active: true,
      };
      mockRequest.params = { userId };
      mockRequest.body = preference;
      mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockResolvedValue(undefined);

      await controller.addOrUpdatePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(userId, preference);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Preference added/updated successfully' });
    });

    it('should return 400 if user ID is missing', async () => {
      const preference: PreferenceNode = {
        type: 'wineType',
        value: 'white',
        source: 'manual',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        active: true,
      };
      mockRequest.params = {}; // No userId
      mockRequest.body = preference;

      await controller.addOrUpdatePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'User ID is required' });
    });

    it('should return 400 if preference data is invalid', async () => {
      const userId = 'test-user-invalid';
      mockRequest.params = { userId };
      mockRequest.body = { type: 'wineType' }; // Missing value and active

      await controller.addOrUpdatePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid preference data provided' });
    });

    it('should handle errors when adding or updating preference', async () => {
      const userId = 'test-user-error';
      const preference: PreferenceNode = {
        type: 'wineType',
        value: 'white',
        source: 'manual',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        active: true,
      };
      const mockError = new Error('Failed to save to Neo4j');
      mockRequest.params = { userId };
      mockRequest.body = preference;
      mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockRejectedValue(mockError);

      await controller.addOrUpdatePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(userId, preference);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to add or update preference' });
    });
  });

  describe('deletePreference', () => {
    it('should delete a preference for a user', async () => {
      const userId = 'test-user-delete';
      const preferenceId = 'pref-123';
      mockRequest.params = { userId, preferenceId };
      mockKnowledgeGraphServiceInstance.deletePreference.mockResolvedValue(undefined);

      await controller.deletePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).toHaveBeenCalledWith(userId, preferenceId);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Preference deleted successfully' });
    });

    it('should return 400 if user ID or preference ID is missing', async () => {
      mockRequest.params = { userId: 'test-user-delete' }; // Missing preferenceId

      await controller.deletePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'User ID and Preference ID are required' });
    });

    it('should handle errors when deleting preference', async () => {
      const userId = 'test-user-error';
      const preferenceId = 'pref-error';
      const mockError = new Error('Failed to delete from Neo4j');
      mockRequest.params = { userId, preferenceId };
      mockKnowledgeGraphServiceInstance.deletePreference.mockRejectedValue(mockError);

      await controller.deletePreference(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).toHaveBeenCalledWith(userId, preferenceId);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Failed to delete preference' });
    });
  });
});