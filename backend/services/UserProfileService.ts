import { injectable, inject } from 'tsyringe'; // Import inject
import { TYPES } from '../di/Types'; // Import TYPES from centralized location
import { ILogger } from './LLMService'; // Import ILogger
import { KnowledgeGraphService } from './KnowledgeGraphService';
import { PreferenceNode } from '../types';

@injectable()
export class UserProfileService {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.Logger) private logger: ILogger // Inject logger
  ) {}

  async loadPreferences(userId: string): Promise<PreferenceNode[]> {
    this.logger.info(`UserProfileService: Loading preferences for user ${userId}`);
    try {
      // Use KnowledgeGraphService to get all preferences for the user
      const preferences = await this.knowledgeGraphService.getPreferences(userId);
      this.logger.info(`UserProfileService: Loaded ${preferences.length} preferences for user ${userId}`);
      return preferences;
    } catch (error: any) { // Add type annotation for error
      this.logger.error(`UserProfileService: Error loading preferences for user ${userId}:`, error);
      // Return empty array in case of error to avoid blocking the application
      return [];
    }
  }

  async savePreferences(userId: string, preferences: PreferenceNode[]): Promise<void> {
    this.logger.info(`UserProfileService: Saving preferences for user ${userId}`);
    try {
      // Iterate through preferences and use KnowledgeGraphService to add or update each
      for (const preference of preferences) {
        await this.knowledgeGraphService.addOrUpdatePreference(userId, preference);
      }
      this.logger.info(`UserProfileService: Saved ${preferences.length} preferences for user ${userId}`);
    } catch (error: any) { // Add type annotation for error
      this.logger.error(`UserProfileService: Error saving preferences for user ${userId}:`, error);
      // TODO: Implement more robust error handling (e.g., retry, dead letter queue)
    }
  }
}