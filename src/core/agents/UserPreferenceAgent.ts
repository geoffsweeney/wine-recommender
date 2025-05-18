import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus';
import { PreferenceExtractionService } from '../../services/PreferenceExtractionService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../types';

@injectable()
export class UserPreferenceAgent implements Agent {
  constructor(
    @inject("AgentCommunicationBus") private communicationBus: AgentCommunicationBus,
    @inject('PreferenceExtractionService') private preferenceExtractionService: PreferenceExtractionService,
    @inject('KnowledgeGraphService') private knowledgeGraphService: KnowledgeGraphService
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
      const normalizedExtractedPreferences = this.normalizePreferences(extractedPreferences);
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

  public normalizePreferences(preferences: PreferenceNode[]): PreferenceNode[] {
    const synonymRegistry = new Map<string, Map<string, string>>();

    // Synonym mappings for various preference types
    synonymRegistry.set('wineType', new Map([
        ['red', 'red'],
        ['reds', 'red'], // Add synonym mapping for 'reds'
        ['white', 'white'],
        ['rose', 'rose'],
        ['sparkling', 'sparkling'],
        ['cabernet sauvignon', 'cabernet sauvignon'],
        ['merlot', 'merlot'],
        ['chardonnay', 'chardonnay'],
        ['sauvignon blanc', 'sauvignon blanc'],
        // Add more wine type synonyms as needed
    ]));

    synonymRegistry.set('sweetness', new Map([
        ['dry', 'dry'],
        ['sweet', 'sweet'],
        ['off-dry', 'off-dry'],
        ['bone dry', 'dry'],
        ['very sweet', 'sweet'],
        // Add more sweetness synonyms
    ]));

    synonymRegistry.set('body', new Map([
        ['light', 'light'],
        ['medium', 'medium'],
        ['full', 'full'],
        ['light-bodied', 'light'],
        ['medium-bodied', 'medium'],
        ['full-bodied', 'full'],
        // Add more body synonyms
    ]));

    synonymRegistry.set('region', new Map([
        ['france', 'France'],
        ['italy', 'Italy'],
        ['spain', 'Spain'],
        ['usa', 'USA'],
        ['australia', 'Australia'],
        // Add more region synonyms
    ]));

    // Add more synonym registries for other preference types (e.g., oak, tannins, acidity)

    return preferences.map(pref => {
        console.log('normalizePreferences: Processing preference:', pref); // Log the preference being processed
        // Trim whitespace and lowercase string values
        let value = typeof pref.value === 'string'
            ? pref.value.trim().toLowerCase()
            : pref.value;
        console.log('normalizePreferences: Trimmed/lowercased value:', value); // Log the value after trimming/lowercasing

        // Resolve synonyms using registry
        if (typeof value === 'string' && synonymRegistry.has(pref.type)) {
            const synonyms = synonymRegistry.get(pref.type);
            console.log('normalizePreferences: Synonym registry for type:', pref.type, synonyms); // Log the synonym registry for the type
            if (synonyms && typeof value === 'string' && synonyms.has(value.toLowerCase())) {
                console.log('normalizePreferences: Synonym found, canonical term:', synonyms.get(value.toLowerCase())); // Log when synonym is found
                value = synonyms.get(value.toLowerCase())!; // Normalize to canonical term
            } else {
                console.log('normalizePreferences: No synonym found for value:', value); // Log when no synonym is found
            }
        }

        // Handle negations
        const negated = typeof value === 'string' && value.startsWith('not ');
        if (negated) {
            if (typeof value === 'string') {
                value = value.slice(4); // Remove 'not ' prefix
            } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                value = value.map(item => item.slice(4)); // Remove 'not ' prefix from each string in the array
            } else {
                // Handle other types (number, boolean) as needed, e.g., throw an error or log a warning
                console.warn('Value is not a string or string array, cannot apply slice.');
            }
        }

        // Handle value ranges and type conversions
        let normalizedValue: PreferenceNode['value'];
        switch (pref.type) {
            case 'priceRange':
                // Assuming value is an array [min, max] or a single number
                if (Array.isArray(value) && value.length <= 2 && value.every(v => typeof v === 'number')) {
                    normalizedValue = value;
                } else if (typeof value === 'number') {
                    normalizedValue = [value, value]; // Treat single number as a range
                } else {
                    console.warn(`UserPreferenceAgent: Invalid value type for priceRange:`, value);
                    return null; // Discard invalid preference
                }
                break;
            case 'alcoholContent':
                const numericAlcohol = Number(value);
                if (!isNaN(numericAlcohol) && numericAlcohol >= 0 && numericAlcohol <= 25) { // Assuming alcohol content is between 0 and 25%
                    normalizedValue = numericAlcohol;
                } else {
                    console.warn(`UserPreferenceAgent: Invalid value for alcoholContent:`, value);
                    return null; // Discard invalid preference
                }
                break;
            case 'aging':
                // Assuming value is a duration object from Duckling or a number of years
                if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                     normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                } else if (typeof value === 'number' && value >= 0) {
                     normalizedValue = `${value} years`; // Assume number is in years, convert to string
                }
                else {
                    console.warn(`UserPreferenceAgent: Invalid value for aging:`, value);
                    return null; // Discard invalid preference
                }
                break;
            case 'servingTemperature':
                 const numericTemperature = Number(value);
                 if (!isNaN(numericTemperature)) {
                     normalizedValue = numericTemperature;
                 } else {
                     console.warn(`UserPreferenceAgent: Invalid value for servingTemperature:`, value);
                     return null; // Discard invalid preference
                 }
                 break;
            case 'volume':
                 // Assuming value is a volume object from Duckling or a number in ml/l
                 if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                      normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                 } else if (typeof value === 'number' && value > 0) {
                      normalizedValue = `${value} ml`; // Assume number is in ml, convert to string
                 } else {
                     console.warn(`UserPreferenceAgent: Invalid value for volume:`, value);
                     return null; // Discard invalid preference
                 }
                 break;
            case 'location':
                 // Assuming value is a string or location object from Duckling
                 if (typeof value === 'object' && value !== null && 'value' in value) {
                      normalizedValue = String(value.value); // Extract value if object and cast to string
                 } else if (typeof value === 'string') {
                      normalizedValue = value; // Use string value directly
                 }
                 else {
                     console.warn(`UserPreferenceAgent: Invalid value for location:`, value);
                     return null; // Discard invalid preference
                 }
                 break;
            case 'distance':
                 // Assuming value is a distance object from Duckling or a number
                 if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                      normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                 } else if (typeof value === 'number' && value >= 0) {
                      normalizedValue = `${value} km`; // Assume number is in km, convert to string
                 } else {
                     console.warn(`UserPreferenceAgent: Invalid value for distance:`, value);
                     return null; // Discard invalid preference
                 }
                 break;
            default:
                // For other types, ensure value is one of the allowed types in PreferenceNode
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
                    normalizedValue = value;
                } else {
                    console.warn(`UserPreferenceAgent: Skipping normalization for unsupported value type for preference type "${pref.type}":`, value);
                    return null; // Discard unsupported value types
                }
                break;
        }

        console.log('normalizePreferences: Final value before return:', normalizedValue); // Log the final normalized value
        const finalPreference = {
            ...pref,
            value: normalizedValue,
            negated: negated || pref.negated, // Include negated property if handled
            timestamp: new Date().toISOString()
        };
        console.log('normalizePreferences: Returning preference from map:', finalPreference); // Log the preference being returned from map
        return finalPreference;
    }).filter(Boolean) as PreferenceNode[]; // Filter out nulls from discarded preferences
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
