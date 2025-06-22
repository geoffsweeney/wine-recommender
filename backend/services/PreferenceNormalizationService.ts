import { injectable, inject } from 'tsyringe'; // Import injectable and inject
import { TYPES } from '../di/Types'; // Import TYPES
import { ILogger } from './LLMService'; // Import ILogger
import { PreferenceNode } from '../types';

@injectable()
export class PreferenceNormalizationService {
  constructor(
    @inject(TYPES.Logger) private logger: ILogger // Inject logger
  ) {
    this.logger.info('PreferenceNormalizationService constructor entered.');
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
        ['pinot noir', 'pinot noir'], // Added synonym
        ['syrah', 'syrah'], // Added synonym
        ['shiraz', 'syrah'], // Added synonym (Shiraz is a synonym for Syrah)
        ['cabernet', 'cabernet sauvignon'], // Added synonym (Common abbreviation)
        // Add more wine type synonyms as needed
    ]));

    synonymRegistry.set('sweetness', new Map([
        ['dry', 'dry'],
        ['sweet', 'sweet'],
        ['off-dry', 'off-dry'],
        ['bone dry', 'dry'],
        ['very sweet', 'sweet'],
        ['demi-sec', 'off-dry'], // Added synonym
        ['brut', 'dry'], // Added synonym for sparkling
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
        ['california', 'USA'], // Added synonym
        ['bordeaux', 'France'], // Added synonym
        // Add more region synonyms
    ]));

    // Add more synonym registries for other preference types (e.g., oak, tannins, acidity)

    return preferences.map(pref => {
        this.logger.info('normalizePreferences: Processing preference:', pref); // Log the preference being processed
        // Trim whitespace and lowercase string values
        let value = typeof pref.value === 'string'
            ? pref.value.trim().toLowerCase()
            : pref.value;
        this.logger.info('normalizePreferences: Trimmed/lowercased value:', value); // Log the value after trimming/lowercasing

        // Resolve synonyms using registry
        if (typeof value === 'string' && synonymRegistry.has(pref.type)) {
            const synonyms = synonymRegistry.get(pref.type);
            this.logger.info('normalizePreferences: Synonym registry for type:', pref.type, synonyms); // Log the synonym registry for the type
            if (synonyms && typeof value === 'string' && synonyms.has(value.toLowerCase())) {
                this.logger.info('normalizePreferences: Synonym found, canonical term:', synonyms.get(value.toLowerCase())); // Log when synonym is found
                value = synonyms.get(value.toLowerCase())!; // Normalize to canonical term
            } else {
                this.logger.info('normalizePreferences: No synonym found for value:', value); // Log when no synonym is found
            }
        }

        // Handle negations
        let negated = typeof value === 'string' && value.startsWith('not '); // Change const to let
        if (negated) {
            if (typeof value === 'string') {
                value = value.slice(4); // Remove 'not ' prefix
            } else {
                // Handle other types (number, boolean) as needed, e.g., throw an error or log a warning
                this.logger.warn('Value is not a string, cannot apply slice for negation.');
            }
        } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
             const originalArray = value as string[];
             const processedArray = originalArray.map(item => {
                 if (item.startsWith('not ')) {
                     negated = true; // Set overall negated flag if any item is negated
                     return item.slice(4); // Remove 'not ' prefix
                 }
                 return item; // Keep non-negated items as is
             });
             value = processedArray;
             // If the original array contained 'not ' prefixes, the overall preference is negated.
             // The 'negated' flag is set within the map loop.
        } else if (Array.isArray(value) && value.some(item => typeof item === 'string' && (item as string).startsWith('not '))) { // Explicitly cast item to string
             // Handle mixed arrays (strings and other types) with negations
             const originalArray = value as (string | any)[]; // Allow mixed types for robustness
             const processedArray = originalArray.map(item => {
                 if (typeof item === 'string' && (item as string).startsWith('not ')) { // Explicitly cast item to string
                     negated = true; // Set overall negated flag
                     return (item as string).slice(4); // Remove 'not ' prefix, explicitly cast
                 }
                 return item; // Keep other items as is
             });
             value = processedArray;
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
                    this.logger.warn(`PreferenceNormalizationService: Invalid value type for priceRange:`, value);
                    return null; // Discard invalid preference
                }
                break;
            case 'alcoholContent':
                // More robust numeric conversion
                const alcoholString = String(value).replace('%', '').trim();
                const numericAlcohol = Number(alcoholString);
                if (!isNaN(numericAlcohol) && numericAlcohol >= 0 && numericAlcohol <= 25) { // Assuming alcohol content is between 0 and 25%
                    normalizedValue = numericAlcohol;
                } else {
                    this.logger.warn(`PreferenceNormalizationService: Invalid value for alcoholContent:`, value);
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
                    this.logger.warn(`PreferenceNormalizationService: Invalid value for aging:`, value);
                    return null; // Discard invalid preference
                }
                break;
            case 'servingTemperature':
                 // More robust numeric conversion
                 const tempString = String(value).replace(/[^\d.-]/g, '').trim(); // Remove non-numeric except . and -
                 const numericTemperature = Number(tempString);
                 if (tempString === '' || isNaN(numericTemperature)) { // Check if cleaned string is empty or conversion is NaN
                     this.logger.warn(`PreferenceNormalizationService: Invalid value for servingTemperature:`, value);
                     return null; // Discard invalid preference
                 } else {
                     normalizedValue = numericTemperature;
                 }
                 break;
            case 'volume':
                 // Assuming value is a volume object from Duckling or a number in ml/l
                 if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
                      normalizedValue = `${value.value} ${value.unit}`; // Convert to string
                 } else if (typeof value === 'number' && value > 0) {
                      normalizedValue = `${value} ml`; // Assume number is in ml, convert to string
                 } else {
                     this.logger.warn(`PreferenceNormalizationService: Invalid value for volume:`, value);
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
                     this.logger.warn(`PreferenceNormalizationService: Invalid value for location:`, value);
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
                     this.logger.warn(`PreferenceNormalizationService: Invalid value for distance:`, value);
                     return null; // Discard invalid preference
                 }
                 break;
            default:
                // For other types, ensure value is one of the allowed types in PreferenceNode
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
                    normalizedValue = value;
                } else {
                    this.logger.warn(`PreferenceNormalizationService: Skipping normalization for unsupported value type for preference type "${pref.type}":`, value);
                    return null; // Discard unsupported value types
                }
                break;
        }

        this.logger.info('normalizePreferences: Final value before return:', normalizedValue); // Log the final normalized value
        const finalPreference = {
            ...pref,
            value: normalizedValue,
            negated: negated || pref.negated, // Include negated property if handled
            timestamp: pref.timestamp, // Retain original timestamp
        };
        this.logger.info('normalizePreferences: Returning preference from map:', finalPreference); // Log the preference being returned from map
        return finalPreference;
    }).filter(Boolean) as PreferenceNode[]; // Filter out nulls from discarded preferences
  }
}