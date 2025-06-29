import { injectable, inject } from 'tsyringe'; // Import injectable and inject
import { TYPES } from '../di/Types'; // Import TYPES
import { ILogger, LLMService } from './LLMService'; // Import ILogger and LLMService
import { PreferenceNode } from '../types';
import { z } from 'zod'; // Import Zod for schema definition
import { AgentError } from '../core/agents/AgentError'; // Import AgentError

@injectable()
export class PreferenceNormalizationService {
  private synonymRegistry: Map<string, Map<string, string>>;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger, // Inject logger
    @inject(TYPES.LLMService) private llmService: LLMService // Inject LLMService
  ) {
    this.logger.info('PreferenceNormalizationService constructor entered.');
    this.synonymRegistry = new Map<string, Map<string, string>>();

    // Synonym mappings for various preference types
    this.synonymRegistry.set('wineType', new Map([
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

    this.synonymRegistry.set('sweetness', new Map([
        ['dry', 'dry'],
        ['sweet', 'sweet'],
        ['off-dry', 'off-dry'],
        ['bone dry', 'dry'],
        ['very sweet', 'sweet'],
        ['demi-sec', 'off-dry'], // Added synonym
        ['brut', 'dry'], // Added synonym for sparkling
        // Add more sweetness synonyms
    ]));

    this.synonymRegistry.set('body', new Map([
        ['light', 'light'],
        ['medium', 'medium'],
        ['full', 'full'],
        ['light-bodied', 'light'],
        ['medium-bodied', 'medium'],
        ['full-bodied', 'full'],
        // Add more body synonyms
    ]));

    this.synonymRegistry.set('region', new Map([
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
  }

  // Define the Zod schema for the LLM's synonym resolution output
  private readonly SynonymResolutionSchema = z.object({
    canonicalTerm: z.string().optional().describe("The canonical, normalized term for the given input synonym."),
  }).describe("Schema for resolving a synonym to its canonical term using an LLM.");

  /**
   * Resolves a given synonym to its canonical term using an LLM.
   * This method is called when a synonym is not found in the local registry.
   * @param type The type of preference (e.g., 'wineType', 'sweetness').
   * @param synonym The synonym to resolve.
   * @returns A Promise that resolves to the canonical term or the original synonym if LLM resolution fails.
   */
  private async resolveSynonymWithLlm(type: string, synonym: string): Promise<string> {
    if (synonym.trim() === '') {
      this.logger.warn(`Skipping LLM synonym resolution for empty synonym for type "${type}".`);
      return ''; // Return empty string directly if synonym is empty
    }
    this.logger.info(`Attempting to resolve synonym "${synonym}" for type "${type}" with LLM.`);
    const prompt = `Given the preference type "${type}" and the user's input "${synonym}", identify the most appropriate canonical term. The canonical term should be a standardized, widely recognized term within the wine domain for this preference. If the input is already a canonical term or cannot be mapped, return the input as is.

    Examples:
    - type: "wineType", input: "reds" -> canonicalTerm: "red"
    - type: "wineType", input: "shiraz" -> canonicalTerm: "syrah"
    - type: "sweetness", input: "bone dry" -> canonicalTerm: "dry"
    - type: "region", input: "california" -> canonicalTerm: "USA"
    - type: "wineType", input: "merlot" -> canonicalTerm: "merlot"

    Your response MUST be a JSON object matching the following schema:
    ${JSON.stringify(this.SynonymResolutionSchema.parse({}), null, 2)}
    `;

    try {
      const result = await this.llmService.sendStructuredPrompt<z.infer<typeof this.SynonymResolutionSchema>>(
        prompt,
        this.SynonymResolutionSchema
      );

      if (result.success) {
        if (result.data.canonicalTerm !== undefined) {
          const canonicalTerm = result.data.canonicalTerm.trim().toLowerCase();
          this.logger.info(`LLM resolved "${synonym}" to canonical term "${canonicalTerm}" for type "${type}".`);
          // Cache the LLM-resolved synonym for future use
          if (!this.synonymRegistry.has(type)) {
            this.synonymRegistry.set(type, new Map());
          }
          this.synonymRegistry.get(type)?.set(synonym.toLowerCase(), canonicalTerm);
          return canonicalTerm;
        } else {
          // LLM call was successful, but no canonicalTerm was returned (because it's optional)
          this.logger.warn(`LLM returned no canonical term for synonym "${synonym}" for type "${type}".`);
          return synonym; // Return original synonym
        }
      } else { // result.success is false
        // Explicitly cast result to the error type to access 'error' property
        const errorResult = result as { success: false; error: AgentError };
        this.logger.warn(`LLM failed to resolve synonym "${synonym}" for type "${type}": ${errorResult.error.message}`);
        return synonym; // Return original synonym if LLM fails
      }
    } catch (error: unknown) { // Catch any unexpected errors during the LLM call
      this.logger.error(`Error during LLM synonym resolution for "${synonym}" (${type}):`, error);
      return synonym; // Return original synonym on error
    }
  }

  public async normalizePreferences(preferences: PreferenceNode[]): Promise<PreferenceNode[]> {

    const normalized = await Promise.all(preferences.map(async pref => {
        this.logger.info('normalizePreferences: Processing preference:', pref); // Log the preference being processed
        // Trim whitespace and lowercase string values
        let value = typeof pref.value === 'string'
            ? pref.value.trim().toLowerCase()
            : pref.value;
        this.logger.info(`normalizePreferences: Trimmed/lowercased value: ${JSON.stringify(value)}`); // Log the value after trimming/lowercasing

        // Resolve synonyms using registry or LLM
        if (typeof value === 'string' && this.synonymRegistry.has(pref.type)) {
            const synonyms = this.synonymRegistry.get(pref.type);
            this.logger.info(`normalizePreferences: Synonym registry for type: ${pref.type}, Synonyms: ${JSON.stringify(synonyms)}`); // Log the synonym registry for the type
            if (synonyms && typeof value === 'string' && synonyms.has(value.toLowerCase())) {
                this.logger.info(`normalizePreferences: Synonym found, canonical term: ${JSON.stringify(synonyms.get(value.toLowerCase()))}`); // Log when synonym is found
                value = synonyms.get(value.toLowerCase())!; // Normalize to canonical term
            } else {
                this.logger.info(`normalizePreferences: No synonym found in registry for value: ${JSON.stringify(value)}. Attempting LLM resolution.`); // Log when no synonym is found
                value = await this.resolveSynonymWithLlm(pref.type, value); // Attempt LLM resolution
            }
        } else if (typeof value === 'string') { // If type not in registry, try LLM anyway
            this.logger.info(`normalizePreferences: Preference type "${pref.type}" not in synonym registry. Attempting LLM resolution for value: ${JSON.stringify(value)}.`);
            value = await this.resolveSynonymWithLlm(pref.type, value); // Attempt LLM resolution
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
    })); return normalized.filter(Boolean) as PreferenceNode[]; // Filter out nulls from discarded preferences
  }
}