import { WineNode } from '../types'; // Corrected import path for WineNode

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
 * Represents the structured output from the LLMPreferenceExtractorAgent.
 */
export interface PreferenceExtractionResultPayload {
    isValid: boolean;
    preferences: {
        style?: string;
        color?: string;
        priceRange?: [number, number];
        ingredients?: string[];
        pairing?: string;
        cookingMethod?: string; // Added for food pairing
        suggestedPairings?: string[]; // Added for food pairing
        pairingConfidence?: number; // Added for food pairing
        // Add other preference properties as they are extracted
    };
    ingredients: string[];
    pairingRecommendations?: string[]; // Added for food pairing
    error?: string;
    originalSourceAgent?: string;
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
    recommendations: string[]; // Array of wine names (strings)
    reasoning?: string; // Explanation/reasoning from LLM
    confidence: number; // Confidence score for the recommendation
    pairingNotes?: string; // Notes on food pairing
    alternatives?: string[]; // Alternative recommendations
    source?: 'knowledge_graph' | 'llm' | 'hybrid'; // Source of the recommendation
    error?: string; // Optional error message
}

/**
 * Represents the result of the ExplanationAgent.
 */
export interface ExplanationResult {
    explanation: string;
    // Add references to recommendation details if needed
}