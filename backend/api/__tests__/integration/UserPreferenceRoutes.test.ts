import express, { Express } from 'express';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { container } from 'tsyringe';
import { ILogger, TYPES } from '../../../di/Types';
import { UserProfileService } from '../../../services/UserProfileService'; // Import UserProfileService
import createUserPreferenceRouter from '../../userPreferenceRoutes';

describe('UserPreferenceRoutes', () => {
  let app: Express;
  const mockUserProfileService = mock<UserProfileService>(); // Mock UserProfileService
  const mockLogger = mock<ILogger>();

  beforeAll(() => {
    // Mock dependencies for UserPreferenceController
    container.register(TYPES.UserProfileService, { // Register UserProfileService
      useValue: mockUserProfileService,
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
      const mockPreferences = { wineType: 'red' }; // Simplified mock preferences
      mockUserProfileService.getPreferences.mockResolvedValue(mockPreferences);

      const response = await request(app).get('/users/testUser123/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPreferences);
      expect(mockUserProfileService.getPreferences).toHaveBeenCalledWith('testUser123');
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
    it('should return 200 on successful preference addition/update', async () => {
      mockUserProfileService.savePreferences.mockResolvedValue(undefined); // savePreferences returns void

      const newPreference = { wineType: 'Merlot' }; // Simplified new preference
      const response = await request(app)
        .post('/users/testUser123/preferences')
        .send(newPreference);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Preferences saved successfully' });
      expect(mockUserProfileService.savePreferences).toHaveBeenCalledWith(
        'testUser123',
        expect.objectContaining(newPreference)
      );
    });

    it('should return 400 for invalid preference data', async () => {
      const invalidPreference = { invalidField: 'value' }; // Invalid preference
      const response = await request(app)
        .post('/users/testUser123/preferences')
        .send(invalidPreference);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      // Should include at least the unrecognized_keys error
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unrecognized_keys',
            // path: expect.any(Array), // Accept any path
          }),
        ])
      );
      // Should also include the missing required field error
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid_type',
            path: ['wineType'],
          }),
        ])
      );
    });
  });

  // Removed PUT and DELETE tests as UserProfileService only has get and save
});
