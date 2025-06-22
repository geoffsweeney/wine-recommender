import request from 'supertest';
import express, { Express } from 'express';
import { container, DependencyContainer } from 'tsyringe';
import { TYPES } from '../../../di/Types';
import createUserPreferenceRouter from '../../userPreferenceRoutes';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { mock } from 'jest-mock-extended';
import { ILogger } from '../../../services/LLMService'; // Assuming ILogger is defined here or similar

describe('UserPreferenceRoutes', () => {
  let app: Express;
  const mockKnowledgeGraphService = mock<KnowledgeGraphService>();
  const mockLogger = mock<ILogger>();

  beforeAll(() => {
    // Mock dependencies for UserPreferenceController
    container.register(TYPES.KnowledgeGraphService, {
      useValue: mockKnowledgeGraphService,
    });
    container.register(TYPES.Logger, {
      useValue: mockLogger,
    });

    app = express();
    app.use(express.json());
    app.use(createUserPreferenceRouter(container));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.reset();
  });

  describe('GET /users/:userId/preferences', () => {
    it('should return 200 with user preferences', async () => {
      const mockPreferences = [{ type: 'wineType', value: 'red', active: true, source: 'manual', timestamp: new Date().toISOString() }];
      mockKnowledgeGraphService.getPreferences.mockResolvedValue(mockPreferences);

      const response = await request(app).get('/users/testUser123/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPreferences);
      expect(mockKnowledgeGraphService.getPreferences).toHaveBeenCalledWith('testUser123');
    });

    it('should return 400 if userId is invalid', async () => {
      const response = await request(app).get('/users/ /preferences'); // Invalid userId (empty string after trim)

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['userId'],
            message: 'User ID is required',
          }),
        ]),
      });
    });
  });

  describe('POST /users/:userId/preferences', () => {
    it('should return 200 on successful preference addition', async () => {
      mockKnowledgeGraphService.addOrUpdatePreference.mockResolvedValue(undefined); // addOrUpdatePreference returns void

      const newPreference = { type: 'grapeVarietal', value: 'Merlot', active: true, source: 'manual', timestamp: new Date().toISOString() };
      const response = await request(app)
        .post('/users/testUser123/preferences')
        .send(newPreference);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preference added/updated successfully' });
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(
        'testUser123',
        expect.objectContaining(newPreference)
      );
    });

    it('should return 400 for invalid preference data', async () => {
      const invalidPreference = { type: 'grapeVarietal', value: 'Merlot' }; // Missing 'active'
      const response = await request(app)
        .post('/users/testUser123/preferences')
        .send(invalidPreference);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['active'],
            message: 'Required',
          }),
        ]),
      });
    });
  });

  describe('PUT /users/:userId/preferences', () => {
    it('should return 200 on successful preference update', async () => {
      mockKnowledgeGraphService.addOrUpdatePreference.mockResolvedValue(undefined);

      const updatedPreference = { type: 'grapeVarietal', value: 'Merlot', active: false, source: 'manual', timestamp: new Date().toISOString() };
      const response = await request(app)
        .put('/users/testUser123/preferences')
        .send(updatedPreference);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preference added/updated successfully' });
      expect(mockKnowledgeGraphService.addOrUpdatePreference).toHaveBeenCalledWith(
        'testUser123',
        expect.objectContaining(updatedPreference)
      );
    });
  });

  describe('DELETE /users/:userId/preferences/:preferenceId', () => {
    it('should return 200 on successful preference deletion', async () => {
      mockKnowledgeGraphService.deletePreference.mockResolvedValue(undefined); // deletePreference returns void

      const response = await request(app).delete('/users/testUser123/preferences/prefId456');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preference deleted successfully' });
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(
        'testUser123',
        'prefId456'
      );
    });

    it('should return 400 if preferenceId is invalid', async () => {
      // Mock the service to throw an error for an invalid preferenceId
      mockKnowledgeGraphService.deletePreference.mockRejectedValue(new Error('Invalid Preference ID'));

      const response = await request(app).delete('/users/testUser123/preferences/invalid-id'); // Send an invalid ID

      expect(response.status).toBe(400); // Expecting 400 from the controller's error handling
      expect(response.body).toEqual({ message: 'Invalid Preference ID' }); // Specific error message from controller
      expect(mockKnowledgeGraphService.deletePreference).toHaveBeenCalledWith(
        'testUser123',
        'invalid-id'
      );
    });
  });
});