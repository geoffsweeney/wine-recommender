import { Request, Response } from 'express';
import { DependencyContainer } from 'tsyringe';
import { createTestContainer } from '../../../test-setup';
import { AdminUserPreferenceController } from '../AdminUserPreferenceController';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { UserProfileService } from '../../../services/UserProfileService';
import { TYPES } from '../../../di/Types';

describe('AdminUserPreferenceController', () => {
  let controller: AdminUserPreferenceController;
  let mockRequest: Partial<Request> & { validatedBody?: any; validatedParams?: any; };
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let container: DependencyContainer;
  let resetMocks: () => void;

  beforeEach(() => {
    ({ container, resetMocks } = createTestContainer());

    mockKnowledgeGraphService = {
      getAllUserPreferences: jest.fn(),
      getPreferences: jest.fn(),
      addOrUpdateUserPreferences: jest.fn(),
      deletePreference: jest.fn(),
      deleteAllPreferencesForUser: jest.fn(),
    } as any; // Cast to any to satisfy type checking for partial mock

    mockUserProfileService = {
      getPreferences: jest.fn(),
      savePreferences: jest.fn(),
    } as any;

    container.register(KnowledgeGraphService, { useValue: mockKnowledgeGraphService });
    container.register(TYPES.UserProfileService, { useValue: mockUserProfileService });

    controller = container.resolve(AdminUserPreferenceController);

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    const sendStatusSpy = jest.fn();
    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
      sendStatus: sendStatusSpy,
    };
    mockRequest = {
      params: {},
      body: {},
      validatedBody: {},
      validatedParams: {},
      originalUrl: '', // Initialize originalUrl as a writable property
    };
  });

  afterEach(() => {
    resetMocks();
  });

  describe('GET /admin/preferences', () => {
    it('should return all user preferences', async () => {
      const mockAllPreferences = [
        { userId: 'user1', preferences: [{ type: 'wineType', value: 'Red' }] },
        { userId: 'user2', preferences: [{ type: 'sweetness', value: 'Dry' }] },
      ];
      mockKnowledgeGraphService.getAllUserPreferences.mockResolvedValue(mockAllPreferences);
 
       mockRequest.method = 'GET';
       mockRequest.originalUrl = '/admin/preferences';
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.getAllUserPreferences).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockAllPreferences);
    });

    it('should return 500 if an error occurs when getting all preferences', async () => {
      const errorMessage = 'Database error';
      mockKnowledgeGraphService.getAllUserPreferences.mockRejectedValue(new Error(errorMessage));
 
       mockRequest.method = 'GET';
       mockRequest.originalUrl = '/admin/preferences';
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.getAllUserPreferences).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Error: ${errorMessage}` });
    });
  });

  describe('GET /admin/preferences/:userId', () => {
    it('should return preferences for a specific user', async () => {
      const userId = 'user123';
      const mockUserPreferences = [{ type: 'wineType', value: 'Red' }];
      mockKnowledgeGraphService.getPreferences.mockResolvedValue(mockUserPreferences);
 
       mockRequest.method = 'GET';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId, true);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockUserPreferences);
    });

    it('should return 500 if an error occurs when getting user preferences', async () => {
      const userId = 'user123';
      const errorMessage = 'Network error';
      mockKnowledgeGraphService.getPreferences.mockRejectedValue(new Error(errorMessage));
 
       mockRequest.method = 'GET';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId, true);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Error: ${errorMessage}` });
    });
  });

  describe('PUT /admin/preferences/:userId', () => {
    it('should update preferences for a specific user', async () => {
      const userId = 'user123';
      const preferencesToUpdate = [{ type: 'sweetness', value: 'Dry' }];
      mockKnowledgeGraphService.addOrUpdateUserPreferences.mockResolvedValue(undefined);
 
       mockRequest.method = 'PUT';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       mockRequest.validatedBody = preferencesToUpdate;
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.addOrUpdateUserPreferences).toHaveBeenCalledWith(userId, preferencesToUpdate);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'User preferences updated successfully' });
    });

    it('should return 500 if an error occurs when updating user preferences', async () => {
      const userId = 'user123';
      const preferencesToUpdate = [{ type: 'sweetness', value: 'Dry' }];
      const errorMessage = 'Update failed';
      mockKnowledgeGraphService.addOrUpdateUserPreferences.mockRejectedValue(new Error(errorMessage));
 
       mockRequest.method = 'PUT';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       mockRequest.validatedBody = preferencesToUpdate;
 
       await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(mockKnowledgeGraphService.addOrUpdateUserPreferences).toHaveBeenCalledWith(userId, preferencesToUpdate);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Error: ${errorMessage}` });
    });
  });

  describe('DELETE /admin/preferences/:userId', () => {
    it('should delete a specific preference for a user', async () => {
      const userId = 'user123';
      const preferenceId = 'wineType:red'; // Use composite preferenceId
      const type = 'wineType';
      const value = 'red';
      mockKnowledgeGraphService.deletePreference.mockResolvedValue(undefined);
 
       mockRequest.method = 'DELETE';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       (mockRequest as any).validatedQuery = { preferenceId }; // Set validatedQuery
 
       await controller.execute(mockRequest as Request, mockResponse as Response);
 
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(userId, type, value); // Expect type and value
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Preference ${preferenceId} for user ${userId} deleted successfully` });
    });
 
    it('should delete all preferences for a user if no preferenceId is provided', async () => {
      const userId = 'user123';
      mockKnowledgeGraphService.deleteAllPreferencesForUser.mockResolvedValue(undefined);
 
       mockRequest.method = 'DELETE';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       (mockRequest as any).validatedQuery = {}; // Ensure validatedQuery is empty for "delete all"
 
       await controller.execute(mockRequest as Request, mockResponse as Response);
 
      expect(mockKnowledgeGraphService.deleteAllPreferencesForUser).toHaveBeenCalledWith(userId);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `All preferences for user ${userId} deleted successfully` });
    });
 
    it('should return 500 if an error occurs during deletion of a specific preference', async () => {
      const userId = 'user123';
      const preferenceId = 'wineType:red'; // Use composite preferenceId
      const type = 'wineType';
      const value = 'red';
      const errorMessage = 'Deletion failed';
      mockKnowledgeGraphService.deletePreference.mockRejectedValue(new Error(errorMessage));
 
       mockRequest.method = 'DELETE';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       (mockRequest as any).validatedQuery = { preferenceId }; // Set validatedQuery
 
       await controller.execute(mockRequest as Request, mockResponse as Response);
 
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(userId, type, value); // Expect type and value
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Error: ${errorMessage}` });
    });
 
    it('should return 500 if an error occurs during deletion of all preferences', async () => {
      const userId = 'user123';
      const errorMessage = 'Deletion failed';
      mockKnowledgeGraphService.deleteAllPreferencesForUser.mockRejectedValue(new Error(errorMessage));
 
       mockRequest.method = 'DELETE';
       mockRequest.originalUrl = `/admin/preferences/${userId}`;
       mockRequest.validatedParams = { userId };
       (mockRequest as any).validatedQuery = {}; // Ensure validatedQuery is empty for "delete all"
 
       await controller.execute(mockRequest as Request, mockResponse as Response);
 
      expect(mockKnowledgeGraphService.deleteAllPreferencesForUser).toHaveBeenCalledWith(userId);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ message: `Error: ${errorMessage}` });
    });
  });

  it('should return 405 for unsupported HTTP method or invalid path', async () => {
    mockRequest.method = 'POST'; // Unsupported method for /admin/preferences
    mockRequest.originalUrl = '/admin/preferences';
    mockRequest.validatedParams = { userId: 'test-user' };
 
     await controller.execute(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(405);
    expect(jsonSpy).toHaveBeenCalledWith({ message: 'Method not allowed or invalid path' });
  });
});