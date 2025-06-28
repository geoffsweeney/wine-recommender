import { injectable, inject } from 'tsyringe'; // Import injectable and inject
import { TYPES } from '../di/Types'; // Import TYPES
import { ILogger } from './LLMService'; // Import ILogger
import { Result } from '../core/types/Result'; // Import Result

// Define interface for HTTP client
interface IHttpClient {
  post<T>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string; headers: any; config: any; request?: any }>;
  // Add other methods if needed (get, put, delete, etc.)
}


// Define a basic interface for Duckling entities
interface DucklingEntity {
  dim: string;
  value: {
    value: any; // The extracted value (can be number, string, etc.)
    unit?: string; // Optional unit (e.g., "EUR" for price, "%" for alcohol)
    type?: string; // Optional type for interval entities (e.g., 'interval')
    from?: { value: any; unit?: string }; // Optional 'from' for interval entities
    to?: { value: any; unit?: string }; // Optional 'to' for interval entities
  };
  text: string;
  start: number;
  end: number;
}

@injectable()
export class PreferenceExtractionService {
  constructor(
    @inject(TYPES.DucklingUrl) private ducklingUrl: string, // Inject Duckling URL
    @inject(TYPES.HttpClient) private httpClient: IHttpClient, // Inject HTTP client
    @inject(TYPES.Logger) private logger: ILogger // Inject logger
  ) {
    this.logger.info('PreferenceExtractionService constructor entered.');
  }

  async attemptFastExtraction(userInput: string): Promise<Result<{ [key: string]: any } | null, Error>> {
    // 1. Attempt extraction with Regex
    const regexPreferences = this.extractWithRegex(userInput);

    // 2. Attempt extraction with Duckling
    const ducklingPreferences = await this.extractWithDuckling(userInput); // Await Duckling extraction
    const combinedPreferences: { [key: string]: any } = {};

    // Start with Regex results
    if (regexPreferences.success && regexPreferences.data) {
      Object.assign(combinedPreferences, regexPreferences.data);
    }

    // Merge Duckling results, overwriting only if Duckling provides a value
    if (ducklingPreferences.success && ducklingPreferences.data) {
      Object.assign(combinedPreferences, ducklingPreferences.data);
    }

    // Return combined preferences if any were found, otherwise null
    if (Object.keys(combinedPreferences).length > 0) {
      return { success: true, data: combinedPreferences };
    } else {
      return { success: true, data: null }; // No preferences found, but not an error
    }
  }

  private extractWithRegex(userInput: string): Result<{ [key: string]: any } | null, Error> {
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
    if (Object.keys(preferences).length > 0) {
      return { success: true, data: preferences };
    } else {
      return { success: true, data: null };
    }
  }

  private async extractWithDuckling(userInput: string): Promise<Result<{ [key: string]: any } | null, Error>> {
    this.logger.info('Attempting Duckling extraction for:', userInput);

    try {
      const response = await this.httpClient.post<DucklingEntity[]>(this.ducklingUrl, `text=${encodeURIComponent(userInput)}&locale=en_AU`, {
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
            case 'wineType': // Add case for wineType
                 preferences.wineType = entity.value.value;
                 break;
            case 'interval':
              // Handle price ranges or other intervals
              if (entity.value.type === 'interval' && entity.value.from && entity.value.to) {
                if ((entity.value.from.unit === 'EUR' || entity.value.from.unit === 'USD') &&
                    (entity.value.to.unit === 'EUR' || entity.value.to.unit === 'USD')) {
                  preferences.priceRange = [entity.value.from.value, entity.value.to.value];
                }
              }
              break;
            default:
              console.warn(`PreferenceExtractionService: Unhandled Duckling dimension: ${entity.dim}`);
              break;
          }
        }

        if (Object.keys(preferences).length > 0) {
          return { success: true, data: preferences };
        } else {
          return { success: true, data: null };
        }

      } else {
        this.logger.error('Duckling request failed:', response.statusText);
        return { success: false, error: new Error(`Duckling request failed: ${response.statusText}`) };
      }
    } catch (error) {
      this.logger.error('Error during Duckling extraction:', error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
