// Defines structured output interfaces for agents

/**
 * Represents the result of the InputValidationAgent.
 */
export interface InputValidationResult {
    isValid: boolean;
    error?: string;
    // Add fields for extracted entities or intents if needed later
    processedInput?: {
        preferences?: any;
        ingredients?: string[];
        message?: string;
    };
}

/**
 * Represents the result of the UserPreferenceAgent.
 */
export interface UserPreferenceResult {
    // Define structure for user preferences
    preferences: any; // Placeholder for now, refine later
}

/**
 * Represents the result of the ValueAnalysisAgent.
 */
export interface ValueAnalysisResult {
    // Define structure for value analysis outcome
    analysis?: any; // Placeholder for now, refine later
}

/**
 * Represents the structured recommendation output from a Recommendation Agent.
 * This aligns with the structured output requested from the LLM.
 */
export interface RecommendationResult {
    wineName: string;
    wineType: string;
    reasoning: string;
    foodPairing: string;
    // Add other relevant recommendation details as needed
}

/**
 * Represents the result of the ExplanationAgent.
 */
export interface ExplanationResult {
    explanation: string;
    // Add references to recommendation details if needed
}