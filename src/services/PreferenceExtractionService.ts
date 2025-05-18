import { injectable } from 'tsyringe';
import axios from 'axios'; // Import axios

// Define a basic interface for Duckling entities
interface DucklingEntity {
  dim: string;
  value: {
    value: any; // The extracted value (can be number, string, etc.)
    unit?: string; // Optional unit (e.g., "EUR" for price, "%" for alcohol)
  };
  text: string;
  start: number;
  end: number;
}

@injectable()
export class PreferenceExtractionService {
  constructor() {
    console.log('PreferenceExtractionService constructor entered.');
  }

  async attemptFastExtraction(userInput: string): Promise<{ [key: string]: any } | null> {
    // 1. Attempt extraction with Regex
    const regexPreferences = this.extractWithRegex(userInput);

    // 2. Attempt extraction with Duckling
    const ducklingPreferences = await this.extractWithDuckling(userInput); // Await Duckling extraction
    const combinedPreferences: { [key: string]: any } = {};

    // Prioritize Duckling results
    if (ducklingPreferences) {
      Object.assign(combinedPreferences, ducklingPreferences);
    }

    // Merge Regex results, only add if the key doesn't exist from Duckling
    if (regexPreferences) {
      for (const key in regexPreferences) {
        if (regexPreferences.hasOwnProperty(key) && !combinedPreferences[key]) {
          combinedPreferences[key] = regexPreferences[key];
        }
      }
    }

    // Return combined preferences if any were found, otherwise null
    return Object.keys(combinedPreferences).length > 0 ? combinedPreferences : null;
  }

  private extractWithRegex(userInput: string): { [key: string]: any } | null {
    const preferences: { [key: string]: any } = {};
    const lowerInput = userInput.toLowerCase();

    // Regex for wine type
    const wineTypeMatch = lowerInput.match(/\b(red|white|rose|sparkling)\b/);
    if (wineTypeMatch) {
      preferences.wineType = wineTypeMatch[1];
    }

    // Regex for sweetness
    const sweetnessMatch = lowerInput.match(/\b(dry|sweet|off-dry)\b/);
    if (sweetnessMatch) {
      preferences.sweetness = sweetnessMatch[1];
    }

    // Return preferences if any were found, otherwise return null
    return Object.keys(preferences).length > 0 ? preferences : null;
  }

  private async extractWithDuckling(userInput: string): Promise<{ [key: string]: any } | null> {
    console.log('Attempting Duckling extraction for:', userInput);

    const ducklingUrl = 'http://localhost:8000/parse'; // Assuming Duckling server is running locally on port 8000

    try {
      const response = await axios.post<DucklingEntity[]>(ducklingUrl, `text=${encodeURIComponent(userInput)}&locale=en_AU`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.status === 200) {
        const entities = response.data; // Type is now inferred as DucklingEntity[]
        const preferences: { [key: string]: any } = {};

        // Process Duckling entities to extract relevant preferences
        for (const entity of entities) {
          // Map Duckling dimensions to preference types
          switch (entity.dim) {
            case 'number':
            case 'quantity':
              // Handle potential price, alcohol percentage, or volume
              if (entity.value.unit === 'EUR' || entity.value.unit === 'USD') {
                preferences.priceRange = [entity.value.value, entity.value.value];
              } else if (entity.value.unit === '%' || entity.value.unit === 'percent') {
                preferences.alcohol = entity.value.value;
              } else if (entity.value.unit === 'ml' || entity.value.unit === 'l') {
                preferences.volume = entity.value.value;
              } else {
                 preferences.quantity = entity.value.value; // Generic quantity
              }
              break;
            case 'duration':
              preferences.aging = entity.value.value;
              break;
            case 'time':
              preferences.timePreference = entity.value.value;
              break;
            case 'location':
              preferences.location = entity.value.value;
              break;
            case 'temperature':
              preferences.servingTemperature = entity.value.value;
              break;
            case 'distance':
              preferences.distance = entity.value.value; // Could be relevant for region proximity
              break;
            case 'volume':
                 preferences.volume = entity.value.value;
                 break;
            default:
              console.warn(`PreferenceExtractionService: Unhandled Duckling dimension: ${entity.dim}`);
              break;
          }
        }

        return Object.keys(preferences).length > 0 ? preferences : null;

      } else {
        console.error('Duckling request failed:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Error during Duckling extraction:', error);
      return null;
    }
  }
}
