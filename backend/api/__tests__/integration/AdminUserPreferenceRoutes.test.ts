import express, { Express } from 'express';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { container } from 'tsyringe';
import { ILogger, TYPES } from '../../../di/Types';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { AdminCommandController } from '../../controllers/AdminCommandController'; // Import AdminCommandController
import createRouter from '../../routes'; // Import the main router

describe('AdminUserPreferenceRoutes', () => {
  let app: Express;
  let mockRequest: Partial<request.Agent> & { validatedBody?: any; validatedParams?: any; validatedQuery?: any; }; // Add validatedQuery
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  const mockKnowledgeGraphService = mock<KnowledgeGraphService>();
  const mockLogger = mock<ILogger>();

  beforeAll(() => {
    container.register(KnowledgeGraphService, { useValue: mockKnowledgeGraphService });
    container.register(TYPES.Logger, { useValue: mockLogger });

    app = express();
    app.use(express.json());
    const mockAdminCommandController = mock<AdminCommandController>(); // Create a proper mock AdminCommandController
    app.use(createRouter(container, mockAdminCommandController)); // Use the main router which includes admin routes
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-initialize mockRequest and mockResponse for each test
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    const sendStatusSpy = jest.fn();
    mockResponse = {
      json: jsonSpy,
      sendStatus: sendStatusSpy,
    } as Partial<Response>; // Cast to Partial<Response>

    // Make 'status' property writable for testing purposes
    Object.defineProperty(mockResponse, 'status', {
      writable: true,
      value: statusSpy,
    });
    mockRequest = {
      params: {},
      body: {},
      validatedBody: {},
      validatedParams: {},
      validatedQuery: {}, // Initialize validatedQuery
    } as any; // Cast to any to allow dynamic properties

    // Reset mock implementations for KnowledgeGraphService in beforeEach
    mockKnowledgeGraphService.getAllUserPreferences.mockReset();
    mockKnowledgeGraphService.getPreferences.mockReset();
    mockKnowledgeGraphService.addOrUpdateUserPreferences.mockReset();
    mockKnowledgeGraphService.deletePreference.mockReset();
    mockKnowledgeGraphService.deleteAllPreferencesForUser.mockReset();

  });

  afterAll(() => {
    container.reset();
  });

  describe('GET /admin/preferences', () => {
    it('should return 200 with all user preferences', async () => {
      const mockAllPreferences = [
        { userId: 'user1', preferences: [{ type: 'wineType', value: 'Red' }] },
        { userId: 'user2', preferences: [{ type: 'sweetness', value: 'Dry' }] },
      ];
      mockKnowledgeGraphService.getAllUserPreferences.mockResolvedValueOnce(mockAllPreferences); // Set mock for this test
      const response = await request(app).get('/admin/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAllPreferences);
      expect(mockKnowledgeGraphService.getAllUserPreferences).toHaveBeenCalledTimes(1);
    });

    it('should return 500 if an error occurs', async () => {
      const errorMessage = 'Database error';
      mockKnowledgeGraphService.getAllUserPreferences.mockRejectedValueOnce(new Error(errorMessage)); // Set mock for this test
      const response = await request(app).get('/admin/preferences');
 
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: `Error: ${errorMessage}` });
    });
  });

  describe('GET /admin/preferences/:userId', () => {
    it('should return 200 with preferences for a specific user', async () => {
      const userId = 'testUser123';
      const mockUserPreferences = [{ type: 'wineType', value: 'Red' }];
      mockKnowledgeGraphService.getPreferences.mockResolvedValueOnce(mockUserPreferences); // Set mock for this test
      const response = await request(app).get(`/admin/preferences/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUserPreferences);
      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith(userId, true);
    });

    it('should return 500 if an error occurs', async () => {
      const userId = 'testUser123';
      const errorMessage = 'Network error';
      mockKnowledgeGraphService.getPreferences.mockRejectedValueOnce(new Error(errorMessage)); // Set mock for this test
      const response = await request(app).get(`/admin/preferences/${userId}`);
 
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: `Error: ${errorMessage}` });
    });
  });

  describe('PUT /admin/preferences/:userId', () => {
    it('should return 200 on successful update of user preferences', async () => {
      const userId = 'testUser123';
      const preferencesToUpdate = [{ type: 'sweetness', value: 'Dry', source: 'test', timestamp: Date.now(), active: true }];
      mockKnowledgeGraphService.addOrUpdateUserPreferences.mockResolvedValueOnce(undefined); // Set mock for this test
      const response = await request(app)
        .put(`/admin/preferences/${userId}`)
        .set('Content-Type', 'application/json') // Explicitly set content type
        .send(preferencesToUpdate); // Directly send the array

      expect(response.status).toBe(200);
      expect(response.body).toEqual(preferencesToUpdate);
      expect(mockKnowledgeGraphService.addOrUpdateUserPreferences).toHaveBeenCalledWith(userId, preferencesToUpdate);
    });

    it('should return 500 if an error occurs', async () => {
      const userId = 'testUser123';
      const preferencesToUpdate = [{ type: 'sweetness', value: 'Dry', source: 'test', timestamp: Date.now(), active: true }];
      const errorMessage = 'Update failed';
      mockKnowledgeGraphService.addOrUpdateUserPreferences.mockRejectedValueOnce(new Error(errorMessage)); // Set mock for this test
      const response = await request(app)
         .put(`/admin/preferences/${userId}`)
         .set('Content-Type', 'application/json') // Explicitly set content type
         .send(preferencesToUpdate); // Directly send the array
 
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: `Error: ${errorMessage}` });
    });
  });

  describe('DELETE /admin/preferences/:userId', () => {
    it('should return 200 on successful deletion of a specific preference', async () => {
      const userId = 'testUser123';
      const preferenceId = 'wineType:red'; // Example composite preferenceId
      const type = 'wineType';
      const value = 'red';
      // Directly set validatedQuery for the test
      mockRequest.validatedQuery = { preferenceId };
      mockRequest.validatedParams = { userId }; // Ensure userId is also set
      mockKnowledgeGraphService.deletePreference.mockResolvedValueOnce(undefined); // Set mock for this test

      const response = await request(app).delete(`/admin/preferences/${userId}?preferenceId=${preferenceId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: `Preference ${preferenceId} for user ${userId} deleted successfully` });
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(userId, type, value);
    });

    it('should return 200 on successful deletion of all preferences for a user', async () => {
      const userId = 'testUser123';
      // Directly set validatedQuery to empty for this test
      mockRequest.validatedQuery = {};
      mockRequest.validatedParams = { userId }; // Ensure userId is also set
      mockKnowledgeGraphService.deleteAllPreferencesForUser.mockResolvedValueOnce(undefined); // Set mock for this test

      const response = await request(app).delete(`/admin/preferences/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: `All preferences for user ${userId} deleted successfully` });
      expect(mockKnowledgeGraphService.deleteAllPreferencesForUser).toHaveBeenCalledWith(userId);
    });

    it('should return 500 if an error occurs during specific preference deletion', async () => {
      const userId = 'testUser123';
      const preferenceId = 'wineType:red'; // Example composite preferenceId
      const type = 'wineType';
      const value = 'red';
      const errorMessage = 'Deletion failed';
      // Directly set validatedQuery for the test
      mockRequest.validatedQuery = { preferenceId };
      mockRequest.validatedParams = { userId }; // Ensure userId is also set
      mockKnowledgeGraphService.deletePreference.mockRejectedValueOnce(new Error(errorMessage)); // Set mock for this test

      const response = await request(app).delete(`/admin/preferences/${userId}?preferenceId=${preferenceId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: `Error: ${errorMessage}` });
    });

    it('should return 500 if an error occurs during all preferences deletion', async () => {
      const userId = 'testUser123';
      const errorMessage = 'Deletion failed';
      // Directly set validatedQuery to empty for this test
      mockRequest.validatedQuery = {};
      mockRequest.validatedParams = { userId }; // Ensure userId is also set
      mockKnowledgeGraphService.deleteAllPreferencesForUser.mockRejectedValueOnce(new Error(errorMessage)); // Set mock for this test

      const response = await request(app).delete(`/admin/preferences/${userId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: `Error: ${errorMessage}` });
    });
  });
});
