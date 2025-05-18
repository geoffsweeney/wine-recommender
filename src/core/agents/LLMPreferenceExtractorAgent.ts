import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../types';

@injectable()
export class LLMPreferenceExtractorAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus,
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService
  ) {}

  getName(): string {
    return 'LLMPreferenceExtractorAgent';
  }

  async handleMessage(message: { input: string; history?: { role: string; content: string }[]; userId: string }): Promise<void> {
    console.log('LLMPreferenceExtractorAgent received message:', message);

    const { input, history, userId } = message;

    // Formulate a prompt for the LLM to extract user preferences
    // This prompt is similar to the one previously used in UserPreferenceAgent
    const llmPrompt = `Analyze the following user input for a wine recommendation request, considering the conversation history provided. Determine if it's a valid request and extract key information like ingredients or wine preferences. Provide the output in a JSON format with the following structure: { "isValid": boolean, "ingredients"?: string[], "preferences"?: { [key: string]: any }, "error"?: string }. If the input is invalid, set isValid to false and provide an error message.

${history ? history.map(turn => `${turn.role}: ${turn.content}`).join('\n') + '\n' : ''}User Input: "${input}"`;

    try {
      console.log('LLMPreferenceExtractorAgent: Sending input to LLM for preference extraction.');
      const llmResponse = await this.llmService.sendPrompt(llmPrompt);

      if (llmResponse) {
        console.log('LLMPreferenceExtractorAgent: Received LLM response.');
        // Extract the JSON string from the LLM response
        const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
        let jsonString = llmResponse;

        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1];
        } else {
            // Fallback if the ```json block is not found, try to find the first { and last }
            const firstBracket = llmResponse.indexOf('{');
            const lastBracket = llmResponse.lastIndexOf('}');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                jsonString = llmResponse.substring(firstBracket, lastBracket + 1);
            }
        }

        console.log('LLMPreferenceExtractorAgent: Extracted JSON string:', jsonString);

        try {
          const preferenceOutput: { preferences?: { [key: string]: any } } = JSON.parse(jsonString);

          // Basic validation of the parsed structure
          if (typeof preferenceOutput.preferences !== 'object' || preferenceOutput.preferences === null) {
             console.error('LLMPreferenceExtractorAgent: LLM response missing or invalid "preferences" field.');
             // TODO: Handle invalid structure - maybe log and discard or send to dead letter queue
             return;
          }

          console.log('LLMPreferenceExtractorAgent: Extracted preferences from LLM.');

          // Normalize and persist the preferences
          const normalizedPreferences = this.normalizePreferences(preferenceOutput.preferences, 'llm'); // Pass source as 'llm'
          await this.persistPreferences(userId, normalizedPreferences);

          console.log('LLMPreferenceExtractorAgent: Preferences normalized and persisted.');

        } catch (parseError: any) {
          console.error('LLMPreferenceExtractorAgent: Error parsing or validating LLM response:', parseError);
          // TODO: Handle parsing errors - log and discard or send to dead letter queue
        }

      } else {
        console.warn('LLMPreferenceExtractorAgent: LLM did not return a preference response.');
        // TODO: Handle no LLM response - log and discard or send to dead letter queue
      }

    } catch (llmError) {
      console.error('LLMPreferenceExtractorAgent: Error during LLM preference extraction:', llmError);
      // TODO: Handle LLM communication errors - log and discard or send to dead letter queue
    }

    console.log('LLMPreferenceExtractorAgent finished processing message.');
  }

  // Helper method to normalize preferences extracted by LLM
  private normalizePreferences(preferences: { [key: string]: any }, source: string): PreferenceNode[] {
    const synonymRegistry = new Map<string, Map<string, string>>();

    // Synonym mappings for various preference types (Copied from UserPreferenceAgent)
    synonymRegistry.set('wineType', new Map([
        ['red', 'red'],
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

    const normalized: PreferenceNode[] = [];
    const timestamp = new Date().toISOString();

    for (const type in preferences) {
      if (preferences.hasOwnProperty(type)) {
        let value = preferences[type];
        let confidence = 1.0; // Assuming high confidence from LLM extraction, adjust if LLM provides confidence
        let negated = false;

        // Trim whitespace and lowercase string values
        value = typeof value === 'string'
            ? value.trim().toLowerCase()
            : value;

        // Resolve synonyms using registry
        if (typeof value === 'string' && synonymRegistry.has(type)) {
            const synonyms = synonymRegistry.get(type);
            if (synonyms && synonyms.has(value)) {
                value = synonyms.get(value)!; // Normalize to canonical term
            }
        }

        // Handle negations
        if (typeof value === 'string' && value.startsWith('not ')) {
            negated = true;
            value = value.slice(4); // Remove 'not ' prefix
        } else if (Array.isArray(value) && value.every(item => typeof item === 'string') && value.some(item => item.startsWith('not '))) {
             negated = true;
             value = value.map(item => item.startsWith('not ') ? item.slice(4) : item); // Remove 'not ' prefix from negated items in array
        }


        // Handle value ranges and type conversions
        let normalizedValue: PreferenceNode['value'];
        switch (type) {
            case 'priceRange':
                // Assuming value is an array [min, max] or a single number
                if (Array.isArray(value) && value.length <= 2 && value.every(v => typeof v === 'number')) {
                    normalizedValue = value;
                } else if (typeof value === 'number') {
                    normalizedValue = [value, value]; // Treat single number as a range
                } else {
                    console.warn(`LLMPreferenceExtractorAgent: Invalid value type for priceRange:`, value);
                    continue; // Skip this preference if normalization fails
                }
                break;
            case 'alcoholContent':
                const numericAlcohol = Number(value);
                if (!isNaN(numericAlcohol) && numericAlcohol >= 0 && numericAlcohol <= 25) { // Assuming alcohol content is between 0 and 25%
                    normalizedValue = numericAlcohol;
                } else {
                    console.warn(`LLMPreferenceExtractorAgent: Invalid value for alcoholContent:`, value);
                    continue; // Skip this preference if normalization fails
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
                    console.warn(`LLMPreferenceExtractorAgent: Invalid value for aging:`, value);
                    continue; // Skip this preference if normalization fails
                }
                break;
            case 'servingTemperature':
                 const numericTemperature = Number(value);
                 if (!isNaN(numericTemperature)) {
                     normalizedValue = numericTemperature;
                 } else {
                     console.warn(`LLMPreferenceExtractorAgent: Invalid value for servingTemperature:`, value);
                     continue; // Skip this preference if normalization fails
                 }
                 break;
            case 'volume':
                 // Assuming value is a volume object from Duckling or a number in ml/l
                 if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                      normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                 } else if (typeof value === 'number' && value > 0) {
                      normalizedValue = `${value} ml`; // Assume number is in ml, convert to string
                 } else {
                     console.warn(`LLMPreferenceExtractorAgent: Invalid value for volume:`, value);
                     continue; // Skip this preference if normalization fails
                 }
                 break;
            case 'location':
                 // Assuming value is a string or location object from Duckling
                 if (typeof value === 'string' || (typeof value === 'object' && value !== null && 'value' in value)) {
                      normalizedValue = typeof value === 'object' ? String(value.value) : value; // Extract value if object and cast to string, otherwise use string
                 } else {
                     console.warn(`LLMPreferenceExtractorAgent: Invalid value for location:`, value);
                     continue; // Skip this preference if normalization fails
                 }
                 break;
            case 'distance':
                 // Assuming value is a distance object from Duckling or a number
                 if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                      normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                 } else if (typeof value === 'number' && value >= 0) {
                      normalizedValue = `${value} km`; // Assume number is in km, convert to string
                 } else {
                     console.warn(`LLMPreferenceExtractorAgent: Invalid value for distance:`, value);
                     continue; // Skip this preference if normalization fails
                 }
                 break;
            case 'excludeAllergens':
                 // Assuming excludeAllergens is an array of strings
                 if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                   normalizedValue = value; // Keep as array of strings
                 } else {
                    console.warn(`LLMPreferenceExtractorAgent: Normalization failed for excludeAllergens: Expected array of strings, got ${JSON.stringify(value)}`);
                    continue; // Skip this preference if normalization fails
                 }
                 break;
            default:
                // For other types, ensure value is one of the allowed types in PreferenceNode
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
                    normalizedValue = value;
                } else {
                    console.warn(`LLMPreferenceExtractorAgent: Skipping normalization for unsupported value type for preference type "${type}":`, value);
                    continue; // Skip unsupported value types
                }
                break;
        }

        normalized.push({
          type,
          value: normalizedValue,
          source,
          confidence,
          timestamp,
          active: true, // Default to active
          negated, // Include negated property
        });
      }
    }

    return normalized;
  }

  // Helper method to persist normalized preferences
  private async persistPreferences(userId: string, preferences: PreferenceNode[]): Promise<void> {
    for (const preferenceNode of preferences) {
      await this.knowledgeGraphService.addOrUpdatePreference(userId, preferenceNode);
    }
  }
}