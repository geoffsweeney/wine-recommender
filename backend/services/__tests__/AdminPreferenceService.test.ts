import 'reflect-metadata';
import { AdminPreferenceService } from '../AdminPreferenceService';
import { AdminUserPreferenceController } from '../../api/controllers/AdminUserPreferenceController';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { UserProfileService } from '../UserProfileService';
import { Result } from '../../core/types/Result';
import { success, failure } from '../../utils/result-utils';
import { AgentError } from '../../core/agents/AgentError';
import { ILogger } from '../../di/Types'; // Import ILogger

// Mock dependencies
const mockAdminUserPreferenceController = {
  execute: jest.fn(),
  executeImpl: jest.fn(async (req: any, res: any) => {
    // This mock needs to simulate the behavior of the actual controller's executeImpl.
    // The AdminPreferenceService's executeControllerAction method expects the controller
    // to either resolve with a value (which it then wraps in 'success') or throw an error
    // (which it then wraps in 'failure').
    // We will use a simple mock that resolves with a predefined value or throws an error.
    // The actual data returned by the controller's `ok` method is what we need to simulate.
    // For simplicity, we'll make `executeImpl` directly return the data that `ok` would send.
    // For error cases, it will throw.

    // This is a simplified mock. In a real scenario, you might have more complex logic
    // to determine what `executeImpl` should return based on `req.method` or other `req` properties.
    // For now, we'll rely on `mockImplementationOnce` in individual tests to control behavior.
    // The controller's `ok` method returns the data, so we'll simulate that here.
    // The `executeImpl` method itself doesn't return anything, but the `executeControllerAction`
    // method in `AdminPreferenceService` expects the `res.json` or `res.send` to be called.
    // We need to make sure that the `executeImpl` mock calls `res.json` with the expected data.
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn((data: any) => data); // Mock res.json to return the data
    res.send = jest.fn((data: any) => data); // Mock res.send to return the data
    // The executeImpl method itself doesn't return anything, but the AdminPreferenceService
    // expects the controller to either succeed (by calling res.json/res.send) or fail (by throwing).
    // We need to ensure that the mock for executeImpl either resolves or rejects.
    // For successful cases, we'll resolve the promise.
    // For error cases, we'll throw an error.
    // The specific return value of executeImpl doesn't matter as much as its side effects (calling res.json/res.send)
    // and whether it resolves or rejects.
    // We need to ensure that the mock for executeImpl actually calls res.json or res.send
    // with the data that the AdminPreferenceService expects.
    // This will be handled by mockImplementationOnce in each test case.
    return Promise.resolve();
  }),
};


describe('AdminPreferenceService', () => {
  let service: AdminPreferenceService;
  let mockLogger: Partial<jest.Mocked<ILogger>>; // Declare mockLogger as Partial

  beforeEach(() => {
    mockLogger = { // Initialize mockLogger with only the 'error' method
      error: jest.fn(),
    };

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Manually instantiate the service with mocked dependencies
    service = new AdminPreferenceService(
      mockAdminUserPreferenceController as any,
      mockLogger as any // Pass mockLogger
    );
  });

  describe('viewUserPreferences', () => {
    it('should return user preferences if successful', async () => {
      const userId = 'testUser123';
      const mockPreferences = [{ type: 'grape', value: 'Merlot' }];
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 200;
        res.jsonResponse = mockPreferences;
      });

      const result = await service.viewUserPreferences(userId, 'test-correlation-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockPreferences);
      }
      expect(mockAdminUserPreferenceController.executeImpl).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', validatedParams: { userId } }),
        expect.any(Object)
      );
    });

    it('should return a failure result if controller returns an error status', async () => {
      const userId = 'testUser123';
      const errorMessage = 'Controller Error';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 400;
        res.jsonResponse = { error: errorMessage };
      });

      const result = await service.viewUserPreferences(userId, 'test-correlation-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(expect.objectContaining({
          message: errorMessage,
          code: 'CONTROLLER_ERROR',
        }));
      }
    });

    it('should return a failure result if controller throws an error', async () => {
      const userId = 'testUser123';
      const error = new Error('Internal Server Error');
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async () => {
        throw error;
      });

      const result = await service.viewUserPreferences(userId, 'test-correlation-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(expect.objectContaining({
          message: `Failed to execute controller action: ${error.message}`,
          code: 'SERVICE_EXECUTION_ERROR',
        }));
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error executing controller action: ${error.message}`,
        expect.objectContaining({ error })
      );
    });
  });

  describe('addOrUpdateUserPreferences', () => {
    it('should add/update preferences successfully', async () => {
      const userId = 'testUser123';
      const preferences = [{ type: 'grape', value: 'Merlot' }];
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 200;
        res.jsonResponse = 'Preferences added/updated successfully.';
      });

      const result = await service.addOrUpdateUserPreferences(userId, preferences, 'test-correlation-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Preferences added/updated successfully.');
      }
      expect(mockAdminUserPreferenceController.executeImpl).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', validatedParams: { userId }, validatedBody: preferences }),
        expect.any(Object)
      );
    });

    it('should return a failure result if controller returns an error status', async () => {
      const userId = 'testUser123';
      const preferences = [{ type: 'grape', value: 'Merlot' }];
      const errorMessage = 'Failed to add/update preferences';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 500;
        res.jsonResponse = { error: errorMessage };
      });

      const result = await service.addOrUpdateUserPreferences(userId, preferences, 'test-correlation-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(expect.objectContaining({
          message: errorMessage,
          code: 'CONTROLLER_ERROR',
        }));
      }
    });
  });

  describe('deletePreference', () => {
    it('should delete a specific preference by type and value', async () => {
      const userId = 'testUser123';
      const type = 'grape';
      const value = 'Merlot';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 200;
        res.jsonResponse = 'Preference deleted successfully.';
      });

      const result = await service.deletePreference(userId, 'test-correlation-id', type, value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Preference deleted successfully.');
      }
      expect(mockAdminUserPreferenceController.executeImpl).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', validatedParams: { userId }, validatedQuery: { type, value } }),
        expect.any(Object)
      );
    });

    it('should delete a specific preference by preferenceId', async () => {
      const userId = 'testUser123';
      const preferenceId = 'grape:Merlot';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 200;
        res.jsonResponse = 'Preference deleted successfully.';
      });

      const result = await service.deletePreference(userId, 'test-correlation-id', undefined, undefined, preferenceId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Preference deleted successfully.');
      }
      expect(mockAdminUserPreferenceController.executeImpl).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', validatedParams: { userId }, validatedQuery: { preferenceId } }),
        expect.any(Object)
      );
    });

    it('should return a failure result if controller returns an error status during specific deletion', async () => {
      const userId = 'testUser123';
      const type = 'grape';
      const value = 'Merlot';
      const errorMessage = 'Failed to delete preference';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 404;
        res.jsonResponse = { error: errorMessage };
      });

      const result = await service.deletePreference(userId, 'test-correlation-id', type, value);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(expect.objectContaining({
          message: errorMessage,
          code: 'CONTROLLER_ERROR',
        }));
      }
    });
  });

  describe('deleteAllPreferencesForUser', () => {
    it('should delete all preferences for a user', async () => {
      const userId = 'testUser123';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 200;
        res.jsonResponse = 'All preferences for user deleted successfully.';
      });

      const result = await service.deleteAllPreferencesForUser(userId, 'test-correlation-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('All preferences for user deleted successfully.');
      }
      expect(mockAdminUserPreferenceController.executeImpl).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', validatedParams: { userId }, validatedQuery: {} }),
        expect.any(Object)
      );
    });

    it('should return a failure result if controller returns an error status during bulk deletion', async () => {
      const userId = 'testUser123';
      const errorMessage = 'Failed to delete all preferences';
      mockAdminUserPreferenceController.executeImpl.mockImplementationOnce(async (req: any, res: any) => {
        res.statusCode = 500;
        res.jsonResponse = { error: errorMessage };
      });

      const result = await service.deleteAllPreferencesForUser(userId, 'test-correlation-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(expect.objectContaining({
          message: errorMessage,
          code: 'CONTROLLER_ERROR',
        }));
      }
    });
  });
});