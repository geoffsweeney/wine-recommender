import { UserPreferenceController } from '../../controllers/UserPreferenceController';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../../types';
import { Request, Response } from 'express';
import { TYPES } from '../../../di/Types';
import { createTestContainer } from '../../../test-setup'; // Import the test container factory
import { DependencyContainer } from 'tsyringe';
import { mock } from 'jest-mock-extended'; // Import mock for comprehensive mocking

describe('UserPreferenceController', () => {
  let controller: UserPreferenceController;
  let mockKnowledgeGraphServiceInstance: jest.Mocked<KnowledgeGraphService>;
  let mockRequest: Partial<Request> & { validatedBody?: any; validatedParams?: any; }; // Explicitly add validatedBody and validatedParams
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let container: DependencyContainer; // Declare container
  let resetMocks: () => void; // Declare resetMocks

  beforeEach(() => {
    // Get a fresh container and reset function for each test
    ({ container, resetMocks } = createTestContainer());

    // Mock KnowledgeGraphService using jest-mock-extended
    mockKnowledgeGraphServiceInstance = mock<KnowledgeGraphService>();
    
    // Register mock and resolve controller from container
    container.register(TYPES.KnowledgeGraphService, { useValue: mockKnowledgeGraphServiceInstance });
    controller = container.resolve(UserPreferenceController);

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
      validatedBody: {}, // Add validatedBody
      validatedParams: {}, // Add validatedParams
    };
  });

  afterEach(() => {
    // container.clearInstances(); // Removed container clear
  });

  describe('getPreferences', () => {
    it('should return preferences for a given user ID', async () => {
      const userId = 'test-user-123';
      const mockPreferences: PreferenceNode[] = [
        { type: 'wineType', value: 'red', source: 'manual', confidence: 1.0, timestamp: new Date().toISOString(), active: true },
        { type: 'sweetness', value: 'dry', source: 'llm', confidence: 0.9, timestamp: new Date().toISOString(), active: true },
      ];
      mockRequest.validatedParams = { userId }; // Use validatedParams
      mockKnowledgeGraphServiceInstance.getPreferences.mockResolvedValue(mockPreferences);

      mockRequest.method = 'GET';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).toHaveBeenCalledWith(userId);
      expect(statusSpy).toHaveBeenCalledWith(200); // Should set status 200 for successful response
      expect(jsonSpy).toHaveBeenCalledWith(mockPreferences);
    });

    it('should return 400 if user ID is missing', async () => {
      mockRequest.validatedParams = {}; // No userId in validatedParams

      mockRequest.method = 'GET';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    it('should handle errors when getting preferences', async () => {
      const userId = 'test-user-error';
      const mockError = new Error('Failed to fetch from Neo4j');
      mockRequest.validatedParams = { userId };
      mockKnowledgeGraphServiceInstance.getPreferences.mockRejectedValue(mockError);

      mockRequest.method = 'GET';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.getPreferences).toHaveBeenCalledWith(userId);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'An unexpected error occurred' });
    });
  });

  it('should return 405 for unsupported HTTP method', async () => {
    mockRequest.method = 'PATCH';
    mockRequest.validatedParams = { userId: 'test-user' }; // Use validatedParams

    await controller.execute(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(405);
    expect(jsonSpy).toHaveBeenCalledWith({ message: 'Method not allowed' });
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
      mockRequest.validatedParams = { userId }; // Use validatedParams
      mockRequest.validatedBody = preference; // Use validatedBody
      mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockResolvedValue(undefined);

      mockRequest.method = 'POST';
      await controller.execute(mockRequest as Request, mockResponse as Response);

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
      mockRequest.validatedParams = {}; // No userId
      mockRequest.validatedBody = preference; // Use validatedBody

      mockRequest.method = 'POST';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    it('should return 400 if preference data is invalid', async () => {
      const userId = 'test-user-invalid';
      mockRequest.validatedParams = { userId }; // Use validatedParams
      mockRequest.validatedBody = { type: 'wineType' }; // Missing value and active

      mockRequest.method = 'POST';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Invalid preference data provided' });
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
      mockRequest.validatedParams = { userId }; // Use validatedParams
      mockRequest.validatedBody = preference; // Use validatedBody
      mockKnowledgeGraphServiceInstance.addOrUpdatePreference.mockRejectedValue(mockError);

      mockRequest.method = 'POST';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.addOrUpdatePreference).toHaveBeenCalledWith(userId, preference);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'An unexpected error occurred' });
    });
  });

  describe('deletePreference', () => {
    it('should delete a preference for a user', async () => {
      const userId = 'test-user-delete';
      const preferenceId = 'pref-123';
      mockRequest.validatedParams = { userId, preferenceId }; // Use validatedParams
      mockKnowledgeGraphServiceInstance.deletePreference.mockResolvedValue(undefined);

      mockRequest.method = 'DELETE';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).toHaveBeenCalledWith(userId, preferenceId);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Preference deleted successfully' });
    });

    it('should return 400 if user ID or preference ID is missing', async () => {
      mockRequest.validatedParams = { userId: 'test-user-delete' }; // Missing preferenceId

      mockRequest.method = 'DELETE';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Preference ID is required' });
    });

    it('should handle errors when deleting preference', async () => {
      const userId = 'test-user-error';
      const preferenceId = 'pref-error';
      const mockError = new Error('Failed to delete from Neo4j');
      mockRequest.validatedParams = { userId, preferenceId }; // Use validatedParams
      mockKnowledgeGraphServiceInstance.deletePreference.mockRejectedValue(mockError);

      mockRequest.method = 'DELETE';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphServiceInstance.deletePreference).toHaveBeenCalledWith(userId, preferenceId);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Failed to delete from Neo4j' });
    });
  });
});
