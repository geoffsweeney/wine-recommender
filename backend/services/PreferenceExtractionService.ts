import { inject, injectable } from 'tsyringe';
import { AgentError } from '../core/agents/AgentError';
import { ConversationTurn } from '../core/ConversationHistoryService';
import { Result } from '../core/types/Result';
import { ILogger, TYPES } from '../di/Types';
import { PreferenceExtractionResultPayload } from '../types/agent-outputs';
import { LLMService } from './LLMService';

// Enhanced interface for HTTP client
interface IHttpClient {
  post<T>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string; headers: any; config: any; request?: any }>;
}

// Enhanced Duckling entity interface
interface DucklingEntity {
  dim: string;
  value: {
    value: any;
    unit?: string;
    type?: string;
    from?: { value: any; unit?: string };
    to?: { value: any; unit?: string };
  };
  text: string;
  start: number;
  end: number;
}

// Enhanced food-wine pairing knowledge base
interface FoodWinePairingRule {
  foods: string[];
  wineCharacteristics: {
    color?: string[];
    style?: string[];
    bodyWeight?: string[];
    acidity?: string[];
    tannins?: string[];
    sweetness?: string[];
    regions?: string[];
    grapes?: string[];
  };
  explanation: string;
  confidence: number;
}

@injectable()
export class PreferenceExtractionService {
  // Enhanced food-wine pairing rules database
  private readonly pairingRules: FoodWinePairingRule[] = [
    // Red meat pairings
    {
      foods: ['beef', 'steak', 'ribeye', 'sirloin', 'lamb', 'venison', 'bison'],
      wineCharacteristics: {
        color: ['red'],
        style: ['bold', 'full-bodied', 'robust'],
        bodyWeight: ['full', 'medium-plus'],
        tannins: ['high', 'medium-high'],
        regions: ['bordeaux', 'napa', 'barossa', 'rioja', 'tuscany'],
        grapes: ['cabernet sauvignon', 'malbec', 'syrah', 'shiraz', 'tempranillo', 'sangiovese']
      },
      explanation: 'Rich red meats pair well with bold, tannic wines that can stand up to the protein and fat',
      confidence: 0.9
    },
    // Poultry pairings
    {
      foods: ['chicken', 'turkey', 'duck', 'goose', 'quail'],
      wineCharacteristics: {
        color: ['white', 'light red', 'rosé'],
        style: ['medium-bodied', 'elegant'],
        bodyWeight: ['medium', 'light-plus'],
        acidity: ['medium-high', 'high'],
        grapes: ['chardonnay', 'pinot noir', 'riesling', 'sauvignon blanc', 'albariño']
      },
      explanation: 'Poultry benefits from wines with good acidity and moderate body weight',
      confidence: 0.85
    },
    // Seafood pairings
    {
      foods: ['salmon', 'tuna', 'cod', 'halibut', 'sea bass', 'lobster', 'crab', 'shrimp', 'scallops'],
      wineCharacteristics: {
        color: ['white', 'light red', 'rosé'],
        style: ['crisp', 'mineral', 'fresh'],
        bodyWeight: ['light', 'medium'],
        acidity: ['high', 'medium-high'],
        grapes: ['sauvignon blanc', 'pinot grigio', 'albariño', 'chablis', 'muscadet', 'pinot noir']
      },
      explanation: 'Seafood pairs best with crisp, high-acid wines that complement delicate flavors',
      confidence: 0.9
    },
    // Cheese pairings
    {
      foods: ['cheese', 'cheddar', 'gouda', 'brie', 'camembert', 'blue cheese', 'goat cheese'],
      wineCharacteristics: {
        color: ['white', 'red', 'dessert'],
        style: ['rich', 'complex'],
        sweetness: ['dry', 'off-dry', 'sweet'],
        grapes: ['chardonnay', 'riesling', 'port', 'sauternes', 'cabernet sauvignon']
      },
      explanation: 'Cheese pairings vary greatly by type - soft cheeses with light wines, aged cheeses with bold wines',
      confidence: 0.8
    },
    // Spicy food pairings
    {
      foods: ['spicy', 'curry', 'chili', 'jalapeño', 'wasabi', 'sriracha'],
      wineCharacteristics: {
        color: ['white', 'rosé'],
        style: ['off-dry', 'fruity'],
        sweetness: ['off-dry', 'semi-sweet'],
        acidity: ['high'],
        grapes: ['riesling', 'gewürztraminer', 'moscato', 'chenin blanc']
      },
      explanation: 'Spicy foods pair best with off-dry wines that cool the palate and complement heat',
      confidence: 0.85
    },
    // Pasta and Italian cuisine
    {
      foods: ['pasta', 'tomato sauce', 'marinara', 'bolognese', 'pizza', 'lasagna'],
      wineCharacteristics: {
        color: ['red'],
        style: ['medium-bodied'],
        acidity: ['high', 'medium-high'],
        regions: ['italy', 'tuscany', 'piedmont'],
        grapes: ['sangiovese', 'chianti', 'barbera', 'montepulciano']
      },
      explanation: 'Tomato-based dishes need high-acid wines, preferably Italian varietals',
      confidence: 0.9
    }
  ];

  // Enhanced cooking method mappings
  private readonly cookingMethodMappings = new Map<string, Partial<FoodWinePairingRule['wineCharacteristics']>>([
    ['grilled', { style: ['bold', 'smoky'], bodyWeight: ['medium-plus', 'full'] }],
    ['roasted', { style: ['rich', 'complex'], bodyWeight: ['medium', 'full'] }],
    ['fried', { acidity: ['high'], style: ['crisp', 'cutting'] }],
    ['steamed', { style: ['light', 'delicate'], bodyWeight: ['light'] }],
    ['braised', { style: ['rich', 'complex'], bodyWeight: ['full'] }],
    ['smoked', { style: ['bold', 'earthy'], bodyWeight: ['medium-plus', 'full'] }]
  ]);

  constructor(
    @inject(TYPES.DucklingUrl) private ducklingUrl: string,
    @inject(TYPES.HttpClient) private httpClient: IHttpClient,
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(LLMService) private readonly llmService: LLMService
  ) {
    this.logger.info('PreferenceExtractionService initialized with enhanced pairing logic.');
  }

  async attemptFastExtraction(userInput: string): Promise<Result<{ [key: string]: any } | null, Error>> {
    // 1. Enhanced Regex extraction with food detection
    const regexPreferences = this.extractWithEnhancedRegex(userInput);

    // 2. Duckling extraction
    const ducklingPreferences = await this.extractWithDuckling(userInput);

    // 3. Food-wine pairing analysis
    const pairingPreferences = this.extractFoodWinePairings(userInput);

    const combinedPreferences: { [key: string]: any } = {};

    // Helper to merge array properties
    const mergeArrayProperty = (target: any, source: any, key: string) => {
        if (source[key]) {
            if (!target[key]) {
                target[key] = [];
            }
            target[key] = [...new Set([...target[key], ...(Array.isArray(source[key]) ? source[key] : [source[key]])])];
        }
    };

    // Merge regex preferences
    if (regexPreferences.success && regexPreferences.data) {
        for (const key in regexPreferences.data) {
            if (Object.prototype.hasOwnProperty.call(regexPreferences.data, key)) {
                const value = regexPreferences.data[key];
                // Check if this key should be an array and merge it
                if (['style', 'bodyWeight', 'tannins', 'acidity', 'sweetness', 'color', 'regions', 'grapes', 'detectedFoods', 'suggestedPairings'].includes(key)) {
                    mergeArrayProperty(combinedPreferences, { [key]: value }, key);
                } else {
                    // For other scalar properties, assign directly
                    combinedPreferences[key] = value;
                }
            }
        }
    }

    // Merge duckling preferences
    if (ducklingPreferences.success && ducklingPreferences.data) {
        // Duckling's region is singular, convert to array for consistency
        if (ducklingPreferences.data.region) {
            mergeArrayProperty(combinedPreferences, { regions: [ducklingPreferences.data.region] }, 'regions');
            delete ducklingPreferences.data.region; // Remove singular region to avoid conflict
        }
        // Merge remaining properties from duckling
        for (const key in ducklingPreferences.data) {
            if (Object.prototype.hasOwnProperty.call(ducklingPreferences.data, key)) {
                const value = ducklingPreferences.data[key];
                // Check if this key should be an array and merge it
                if (['style', 'bodyWeight', 'tannins', 'acidity', 'sweetness', 'color', 'regions', 'grapes', 'detectedFoods', 'suggestedPairings'].includes(key)) {
                    mergeArrayProperty(combinedPreferences, { [key]: value }, key);
                } else {
                    // For other scalar properties, assign directly
                    combinedPreferences[key] = value;
                }
            }
        }
    }

    // Merge pairing preferences (these are already arrays or correct types)
    if (pairingPreferences.success && pairingPreferences.data) {
        for (const key in pairingPreferences.data) {
            if (Object.prototype.hasOwnProperty.call(pairingPreferences.data, key)) {
                const value = pairingPreferences.data[key];
                // Check if this key should be an array and merge it
                if (['style', 'bodyWeight', 'tannins', 'acidity', 'sweetness', 'color', 'regions', 'grapes', 'detectedFoods', 'suggestedPairings'].includes(key)) {
                    mergeArrayProperty(combinedPreferences, { [key]: value }, key);
                } else {
                    // For other scalar properties, assign directly
                    combinedPreferences[key] = value;
                }
            }
        }
    }

    if (Object.keys(combinedPreferences).length > 0) {
      return { success: true, data: combinedPreferences };
    } else {
      return { success: true, data: null };
    }
  }

  private extractWithEnhancedRegex(userInput: string): Result<{ [key: string]: any } | null, Error> {
    const preferences: { [key: string]: any } = {};
    const lowerInput = userInput.toLowerCase();

    // Enhanced wine type detection
    const wineTypeMatch = lowerInput.match(/\b(red|white|rosé|rose|sparkling|champagne|prosecco|cava)\b/);
    if (wineTypeMatch) {
      preferences.wineType = wineTypeMatch[1] === 'rose' ? 'rosé' : wineTypeMatch[1];
    }

    // Enhanced sweetness detection
    const sweetnessMatch = lowerInput.match(/\b(bone[\s-]?dry|dry|off[\s-]?dry|semi[\s-]?sweet|sweet|dessert)\b/);
    if (sweetnessMatch) {
      preferences.sweetness = sweetnessMatch[1].replace(/[\s-]/g, '-');
    }

    // Body weight detection
    const bodyMatch = lowerInput.match(/\b(light|medium|full)[\s-]?bodied?\b/);
    if (bodyMatch) {
      preferences.bodyWeight = bodyMatch[1] + '-bodied';
    }

    // Style detection
    const styleMatch = lowerInput.match(/\b(bold|crisp|smooth|elegant|robust|delicate|complex|fresh|mineral)\b/);
    if (styleMatch) {
      preferences.style = styleMatch[1];
    }

    // Price range detection with currency symbols
    const priceMatch = lowerInput.match(/(?:under|below|less than|<)\s*[$€£]?(\d+)|[$€£](\d+)[-–to]\s*[$€£]?(\d+)|budget.*?(\d+)/);
    if (priceMatch) {
      if (priceMatch[1]) {
        preferences.priceRange = [0, parseInt(priceMatch[1])];
      } else if (priceMatch[2] && priceMatch[3]) {
        preferences.priceRange = [parseInt(priceMatch[2]), parseInt(priceMatch[3])];
      } else if (priceMatch[4]) {
        preferences.priceRange = [0, parseInt(priceMatch[4])];
      }
    }

    // Occasion detection
    const occasionMatch = lowerInput.match(/\b(dinner|lunch|party|celebration|romantic|casual|formal|holiday)\b/);
    if (occasionMatch) {
      preferences.occasion = occasionMatch[1];
    }

    return Object.keys(preferences).length > 0 
      ? { success: true, data: preferences }
      : { success: true, data: null };
  }

  private extractFoodWinePairings(userInput: string): Result<{ [key: string]: any } | null, Error> {
    const lowerInput = userInput.toLowerCase();
    // Reverted console.log to logger.info
    this.logger.info(`extractFoodWinePairings: Processing input: "${lowerInput}"`);
    const detectedFoods: string[] = [];
    const pairingPreferences: { [key: string]: any } = {};

    // Extract ingredients and foods
    for (const rule of this.pairingRules) {
      for (const food of rule.foods) {
        if (lowerInput.includes(food)) {
          detectedFoods.push(food);
          
          // Apply pairing rule characteristics
          Object.entries(rule.wineCharacteristics).forEach(([key, values]) => {
            if (values && values.length > 0) {
              if (!pairingPreferences[key]) {
                pairingPreferences[key] = [];
              }
              pairingPreferences[key] = [...new Set([...pairingPreferences[key], ...values])];
            }
          });

          // Add confidence and explanation
          if (!pairingPreferences.pairingConfidence || rule.confidence > pairingPreferences.pairingConfidence) {
            pairingPreferences.pairingConfidence = rule.confidence;
            pairingPreferences.pairingExplanation = rule.explanation;
          }
        }
      }
    }

    // Detect cooking methods
    for (const [method, characteristics] of this.cookingMethodMappings) {
      if (lowerInput.includes(method)) {
        pairingPreferences.cookingMethod = method;
        Object.entries(characteristics).forEach(([key, values]) => {
          if (values) {
            if (!pairingPreferences[key]) {
              pairingPreferences[key] = [];
            }
            pairingPreferences[key] = [...new Set([...pairingPreferences[key], ...values])];
          }
        });
      }
    }

    if (detectedFoods.length > 0) {
      pairingPreferences.detectedFoods = detectedFoods;
      pairingPreferences.foodPairingActive = true;
    }

    return Object.keys(pairingPreferences).length > 0
      ? { success: true, data: pairingPreferences }
      : { success: true, data: null };
  }

  private async extractWithDuckling(userInput: string): Promise<Result<{ [key: string]: any } | null, Error>> {
    this.logger.info('Attempting Duckling extraction for:', userInput);

    try {
      const response = await this.httpClient.post<DucklingEntity[]>(
        this.ducklingUrl, 
        `text=${encodeURIComponent(userInput)}&locale=en_AU`, 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.status === 200) {
        const entities = response.data;
        const preferences: { [key: string]: any } = {};

        for (const entity of entities) {
          switch (entity.dim) {
            case 'number':
            case 'quantity':
              if (entity.value.unit === 'EUR' || entity.value.unit === 'USD' || entity.value.unit === 'AUD') {
                preferences.priceRange = [entity.value.value, entity.value.value];
              } else if (entity.value.unit === '%' || entity.value.unit === 'percent') {
                preferences.alcohol = entity.value.value;
              } else if (entity.value.unit === 'ml' || entity.value.unit === 'l') {
                preferences.volume = entity.value.value;
              } else {
                preferences.quantity = entity.value.value;
              }
              break;
            case 'duration':
              preferences.aging = entity.value.value;
              break;
            case 'time':
              preferences.timePreference = entity.value.value;
              break;
            case 'location':
              // Duckling's location can be a country or region. Map to 'country' for now.
              preferences.country = entity.value.value;
              break;
            case 'temperature':
              preferences.servingTemperature = entity.value.value;
              break;
            case 'interval':
              if (entity.value.type === 'interval' && entity.value.from && entity.value.to) {
                if ((entity.value.from.unit === 'EUR' || entity.value.from.unit === 'USD' || entity.value.from.unit === 'AUD') &&
                    (entity.value.to.unit === 'EUR' || entity.value.to.unit === 'USD' || entity.value.to.unit === 'AUD')) {
                  preferences.priceRange = [entity.value.from.value, entity.value.to.value];
                }
              }
              break;
            default:
              this.logger.debug(`Unhandled Duckling dimension: ${entity.dim}`);
              break;
          }
        }

        return Object.keys(preferences).length > 0
          ? { success: true, data: preferences }
          : { success: true, data: null };

      } else {
        this.logger.error('Duckling request failed:', response.statusText);
        return { success: false, error: new Error(`Duckling request failed: ${response.statusText}`) };
      }
    } catch (error) {
      this.logger.error('Error during Duckling extraction:', error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async extractPreferencesWithLLM(
    userInput: string,
    conversationHistory?: ConversationTurn[],
    userId?: string,
    correlationId?: string
  ): Promise<Result<PreferenceExtractionResultPayload, AgentError>> {
    this.logger.info(`[${correlationId}] Attempting enhanced LLM extraction for user: ${userId}`, { 
      operation: 'extractPreferencesWithLLM' 
    });


    try {
      const llmResponseResult = await this.llmService.sendStructuredPrompt<
        'extractPreferences',
        PreferenceExtractionResultPayload
      >(
        'extractPreferences',
        {
          userInput: userInput,
          conversationContext: conversationHistory ?? [], // Map conversationHistory to conversationContext, provide empty array if undefined
        },
        {
          correlationId: correlationId // Pass logContext here
        }
      );

      if (!llmResponseResult.success) {
        if (llmResponseResult.error?.code === 'LLM_MALFORMED_JSON') {
          this.logger.warn(`[${correlationId}] LLM returned malformed JSON. Attempting fallback extraction.`, {
            agentId: 'PreferenceExtractionService',
            operation: 'extractPreferencesWithLLM',
            originalError: llmResponseResult.error?.message
          });
          // Attempt a fallback extraction using regex/duckling if LLM fails to produce valid JSON
          const fallbackPreferencesResult = await this.attemptFastExtraction(userInput); // Await the promise
          if (fallbackPreferencesResult.success && fallbackPreferencesResult.data) {
            // If fallback extraction is successful, return it as a valid (but less comprehensive) payload
            return {
              success: true,
              data: {
                isValid: true,
                preferences: fallbackPreferencesResult.data,
                ingredients: fallbackPreferencesResult.data.detectedFoods || [],
                pairingRecommendations: [],
                error: 'Partial preferences extracted due to LLM malformed JSON.'
              }
            };
          } else {
            // If fallback also fails, then return the original LLM error
            return {
              success: false,
              error: new AgentError(
                `LLM returned malformed JSON and fallback extraction failed: ${llmResponseResult.error?.message}`,
                'LLM_MALFORMED_JSON_FALLBACK_FAILED',
                'PreferenceExtractionService',
                correlationId ?? '',
                true,
                { originalError: llmResponseResult.error?.message }
              )
            };
          }
        } else {
          // For other LLM service errors, return the original error
          return {
            success: false,
            error: new AgentError(
              `LLM service failed during preference extraction: ${llmResponseResult.error?.message}`,
              'LLM_SERVICE_ERROR',
              'PreferenceExtractionService',
              correlationId ?? '',
              true,
              { originalError: llmResponseResult.error?.message }
            )
          };
        }
      }

      const extractedData = llmResponseResult.data;
      // The extractedData is now guaranteed to be of type PreferenceExtractionResultPayload due to Zod validation in LLMService
      if (!extractedData.isValid) { // Only fail if isValid is explicitly false
        return {
          success: false,
          error: new AgentError(
            extractedData.error || 'LLM returned invalid preference data (isValid was false)',
            'LLM_INVALID_RESPONSE',
            'PreferenceExtractionService',
            correlationId ?? '',
            true,
            { llmResponse: extractedData }
          )
        };
      }

      // Enhance the LLM response with our local pairing knowledge
      const enhancedData = this.enhanceWithLocalPairingKnowledge(extractedData, userInput);

      return { success: true, data: enhancedData };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: new AgentError(
          `Error during LLM preference extraction: ${errorMessage}`,
          'LLM_EXTRACTION_ERROR',
          'PreferenceExtractionService',
          correlationId ?? '',
          false,
          { originalError: errorMessage }
        )
      };
    }
  }

  private enhanceWithLocalPairingKnowledge(
    llmData: PreferenceExtractionResultPayload,
    userInput: string
  ): PreferenceExtractionResultPayload {
    const localPairingResult = this.extractFoodWinePairings(userInput);
    
    if (localPairingResult.success && localPairingResult.data) {
      const localData = localPairingResult.data;
      
      // Merge local pairing knowledge with LLM results
      if (localData.detectedFoods) {
        llmData.ingredients = [...new Set([...llmData.ingredients, ...localData.detectedFoods])];
      }
      
      if (localData.pairingExplanation && llmData.pairingRecommendations) {
        llmData.pairingRecommendations.push(localData.pairingExplanation);
      }
      
      // Add confidence score from local knowledge
      if (localData.pairingConfidence) {
        llmData.preferences = {
          ...llmData.preferences,
          pairingConfidence: localData.pairingConfidence
        };
      }

      // Add wine characteristics from local pairing knowledge
      if (localData.wineCharacteristics) {
        llmData.wineCharacteristics = {
          ...llmData.wineCharacteristics,
          ...localData.wineCharacteristics
        };
      }
    }
    
    return llmData;
  }
}
