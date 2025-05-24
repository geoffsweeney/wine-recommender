import { injectable, inject } from 'tsyringe';
import { KnowledgeGraphService } from './KnowledgeGraphService';
import { PreferenceNode } from '../types';

@injectable()
export class UserProfileService {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService
  ) {}

  async loadPreferences(userId: string): Promise<PreferenceNode[]> {
    console.log(`UserProfileService: Loading preferences for user ${userId}`);
    try {
      // Use KnowledgeGraphService to get all preferences for the user
      const preferences = await this.knowledgeGraphService.getPreferences(userId);
      console.log(`UserProfileService: Loaded ${preferences.length} preferences for user ${userId}`);
      return preferences;
    } catch (error) {
      console.error(`UserProfileService: Error loading preferences for user ${userId}:`, error);
      // Return empty array in case of error to avoid blocking the application
      return [];
    }
  }

  async savePreferences(userId: string, preferences: PreferenceNode[]): Promise<void> {
    console.log(`UserProfileService: Saving preferences for user ${userId}`);
    try {
      // Iterate through preferences and use KnowledgeGraphService to add or update each
      for (const preference of preferences) {
        await this.knowledgeGraphService.addOrUpdatePreference(userId, preference);
      }
      console.log(`UserProfileService: Saved ${preferences.length} preferences for user ${userId}`);
    } catch (error) {
      console.error(`UserProfileService: Error saving preferences for user ${userId}:`, error);
      // TODO: Implement more robust error handling (e.g., retry, dead letter queue)
    }
  }
}