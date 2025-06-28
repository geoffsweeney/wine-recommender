import { injectable, inject } from 'tsyringe'; // Import inject
import { TYPES } from '../di/Types'; // Import TYPES from centralized location
import { ILogger } from './LLMService'; // Import ILogger
import { KnowledgeGraphService } from './KnowledgeGraphService';
import { PreferenceNode } from '../types';

@injectable()
export class UserProfileService {
  constructor(
    @inject(TYPES.Logger) private logger: ILogger // Inject logger
  ) {}

  async loadPreferences(userId: string): Promise<PreferenceNode[]> {
    this.logger.info(`UserProfileService: Preferences are no longer loaded from Neo4j for user ${userId}. Returning empty array.`);
    return [];
  }

  async savePreferences(userId: string, preferences: PreferenceNode[]): Promise<void> {
    this.logger.info(`UserProfileService: Preferences are no longer saved to Neo4j for user ${userId}.`);
    // No operation needed as preferences are not persisted to Neo4j
  }
}