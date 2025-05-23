import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus';
import { PreferenceExtractionService } from '../../services/PreferenceExtractionService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService'; // Import the new service
import { PreferenceNode } from '../../types';

@injectable()
export class UserPreferenceAgent implements Agent {
  constructor(
    @inject("AgentCommunicationBus") private communicationBus: AgentCommunicationBus,
    @inject('PreferenceExtractionService') private preferenceExtractionService: PreferenceExtractionService,
    @inject('KnowledgeGraphService') private knowledgeGraphService: KnowledgeGraphService,
    @inject('PreferenceNormalizationService') private preferenceNormalizationService: PreferenceNormalizationService // Inject the new service
  ) {}

  getName(): string {
    return 'UserPreferenceAgent';
  }

  async handleMessage(message: { input: string; conversationHistory: { role: string; content: string }[], userId?: string, initialPreferences?: PreferenceNode[] }): Promise<{ preferences?: PreferenceNode[], error?: string }> {
    console.log('UserPreferenceAgent received message:', message);

    const { input, conversationHistory, userId, initialPreferences } = message;
    const currentUserId = userId || 'current_user_id'; // Use a default or handle missing user ID

    // 1. Use initial preferences if provided, otherwise fetch from knowledge graph
    let persistedPreferences: PreferenceNode[] = [];
    if (initialPreferences) {
      persistedPreferences = initialPreferences;
      console.log('UserPreferenceAgent: Using initial preferences provided.');
    } else if (currentUserId) {
      try {
        // Fetch only active preferences
        persistedPreferences = await this.knowledgeGraphService.getPreferences(currentUserId, false);
        console.log('UserPreferenceAgent: Fetched active persisted preferences:', persistedPreferences);
      } catch (error) {
        console.error('UserPreferenceAgent: Error fetching persisted preferences:', error);
        // Continue without persisted preferences if fetching fails
      }
    }

    // 2. Attempt fast extraction from current input
    const fastPreferences = await this.preferenceExtractionService.attemptFastExtraction(input);

    let extractedPreferences: PreferenceNode[] = [];
    if (fastPreferences) {
      console.log('UserPreferenceAgent: Result of fast extraction:', fastPreferences);
      // Convert the fastPreferences object to an array of PreferenceNode
      extractedPreferences = Object.entries(fastPreferences).map(([type, value]) => ({
        type,
        value: value, // Keep original value for normalization
        source: 'fast-extraction', // Indicate source
        confidence: 1, // Placeholder confidence, refine later
        timestamp: new Date().toISOString(),
        active: true, // Default to active for newly extracted
      }));

      // Normalize and persist the newly extracted preferences
      const normalizedExtractedPreferences = this.preferenceNormalizationService.normalizePreferences(extractedPreferences); // Use the new service
      console.log('UserPreferenceAgent: Normalized extracted preferences:', normalizedExtractedPreferences); // Keep existing log
      console.log('UserPreferenceAgent: Persisting preferences:', normalizedExtractedPreferences); // Add new log before persisting
      await this.persistPreferences(normalizedExtractedPreferences, currentUserId);

      // Merge newly extracted and normalized preferences with persisted ones
      // Prioritize newly extracted preferences in case of conflicts
      const mergedPreferences = this.mergePreferences(persistedPreferences, normalizedExtractedPreferences);
      console.log('UserPreferenceAgent: Merged preferences (persisted + extracted):', mergedPreferences);

      // Send merged preferences to the SommelierCoordinator for recommendation
      this.communicationBus.sendMessage('SommelierCoordinator', {
        userId: currentUserId,
        input: {
          preferences: mergedPreferences,
          message: input, // Include the original user input
        },
        conversationHistory: conversationHistory,
      });

      // Return the merged preferences so the UI can display them immediately
      return { preferences: mergedPreferences };

    } else {
      console.log('UserPreferenceAgent: Fast extraction failed, queuing for async LLM.');
      this.queueAsyncLLMExtraction(input, conversationHistory, currentUserId);

      // If fast extraction fails, return only the persisted preferences for now
      // The async LLM result will be persisted later.
      return { preferences: [], error: 'Analyzing your input for preferences asynchronously.' };
    }
  }

  // Helper method to merge preferences, prioritizing later sources
  private mergePreferences(existing: PreferenceNode[], incoming: PreferenceNode[]): PreferenceNode[] {
    const merged: { [key: string]: PreferenceNode } = {};

    // Add existing preferences
    existing.forEach(pref => {
      merged[pref.type] = pref;
    });

    // Add or overwrite with incoming preferences
    incoming.forEach(pref => {
      merged[pref.type] = pref;
    });

    return Object.values(merged);
  }

  private async persistPreferences(preferences: PreferenceNode[], userId?: string): Promise<void> {
    const persistenceUserId = userId || 'current_user_id';
    for (const preferenceNode of preferences) {
      await this.knowledgeGraphService.addOrUpdatePreference(persistenceUserId, preferenceNode);
    }
  }

  private queueAsyncLLMExtraction(userInput: string, conversationHistory?: { role: string; content: string }[], userId?: string): void {
    const messageUserId = userId || 'placeholder_user_id';
    this.communicationBus.sendMessage('LLMPreferenceExtractorAgent', {
      input: userInput,
      history: conversationHistory,
      userId: messageUserId,
    });
  }
}
