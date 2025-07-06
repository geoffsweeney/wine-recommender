import { injectable, inject } from 'tsyringe'; // Import inject
import { TYPES } from '../di/Types'; // Import TYPES from centralized location
import { ILogger } from '../di/Types'; // Import ILogger
import { UserPreferences } from '../types'; // Import UserPreferences

@injectable()
export class UserProfileService {
  private userPreferences: Map<string, UserPreferences> = new Map(); // In-memory store for user preferences

  constructor(
    @inject(TYPES.Logger) private logger: ILogger // Inject logger
  ) {}

  /**
   * Retrieves the current accumulated preferences for a user.
   * @param userId The ID of the user.
   * @returns A Promise that resolves to the UserPreferences object.
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    this.logger.debug(`UserProfileService: Retrieving preferences for user ${userId}`);
    return this.userPreferences.get(userId) || {}; // Return empty object if no preferences found
  }

  /**
   * Saves or updates the preferences for a user.
   * @param userId The ID of the user.
   * @param preferences The UserPreferences object to save.
   */
  async savePreferences(userId: string, preferences: UserPreferences): Promise<void> {
    this.logger.debug(`UserProfileService: Saving preferences for user ${userId}: ${JSON.stringify(preferences)}`);
    this.userPreferences.set(userId, preferences);
  }
}