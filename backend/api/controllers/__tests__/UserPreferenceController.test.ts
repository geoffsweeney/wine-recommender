import { UserPreferenceController } from '../../controllers/UserPreferenceController';
import { Request, Response } from 'express';
import { TYPES } from '../../../di/Types';
import { createTestContainer } from '../../../test-setup'; // Import the test container factory
import { DependencyContainer } from 'tsyringe';
import { mock } from 'jest-mock-extended'; // Import mock for comprehensive mocking

describe('UserPreferenceController', () => {
  let controller: UserPreferenceController;
  let mockRequest: Partial<Request> & { validatedBody?: any; validatedParams?: any; }; // Explicitly add validatedBody and validatedParams
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let container: DependencyContainer; // Declare container
  let resetMocks: () => void; // Declare resetMocks

  beforeEach(() => {
    // Get a fresh container and reset function for each test
    ({ container, resetMocks } = createTestContainer());

    // Register mock and resolve controller from container
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
    it('should return an empty array for preferences', async () => {
      const userId = 'test-user-123';
      mockRequest.validatedParams = { userId }; // Use validatedParams

      mockRequest.method = 'GET';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200); // Should set status 200 for successful response
      expect(jsonSpy).toHaveBeenCalledWith([]); // Expect an empty array as per controller logic
    });

    it('should return 400 if user ID is missing', async () => {
      mockRequest.validatedParams = {}; // No userId in validatedParams

      mockRequest.method = 'GET';
      await controller.execute(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'User ID is required' });
    });
  });

  it('should return 405 for unsupported HTTP method', async () => {
    mockRequest.method = 'PATCH';
    mockRequest.validatedParams = { userId: 'test-user' }; // Use validatedParams

    await controller.execute(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(405);
    expect(jsonSpy).toHaveBeenCalledWith({ message: 'Method not allowed' });
  });
});
