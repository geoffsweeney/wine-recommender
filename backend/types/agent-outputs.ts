import { WineNode } from '../types'; // Corrected import path for WineNode
import { WineRecommendationOutput } from '../core/agents/LLMRecommendationAgent';

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
    wineCharacteristics?: { [key: string]: string[] }; // Added for food pairing characteristics
    pairingRecommendations?: string[]; // Added for food pairing
    error?: string;
    originalSourceAgent?: string;
}

import { z } from 'zod';

export const PreferenceExtractionResultPayloadSchema = z.object({
    isValid: z.boolean(),
    preferences: z.object({
        style: z.string().optional(),
        color: z.string().optional(),
        priceRange: z.tuple([z.number(), z.number()]).optional(),
        ingredients: z.array(z.string()).optional(),
        pairing: z.string().optional(),
        cookingMethod: z.string().optional(),
        suggestedPairings: z.array(z.string()).optional(),
        pairingConfidence: z.number().optional(),
    }).passthrough(), // Use passthrough to allow for additional properties not explicitly defined
    ingredients: z.array(z.string()),
    wineCharacteristics: z.record(z.array(z.string())).optional(),
    pairingRecommendations: z.array(z.string()).optional(),
    error: z.string().optional(),
    originalSourceAgent: z.string().optional(),
});

/**
 * Represents the result of the ValueAnalysisAgent.
 */
export interface ValueAnalysisResult {
    // Define structure for value analysis outcome
    analysis?: any; // Placeholder for now, refine later
}

export const InputValidationSchema = z.object({
    isValid: z.boolean(),
    cleanedInput: z.object({
      ingredients: z.array(z.string()).optional(),
      budget: z.union([z.number(), z.null()]),
      occasion: z.union([z.string(), z.null()]),
    }).optional(),
    extractedData: z.object({
      standardizedIngredients: z.record(z.union([z.string(), z.array(z.string())])).optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
      preferences: z.record(z.any()).optional(),
    }).optional(),
    errors: z.array(z.string()).optional(),
});

export const ExplanationConfidenceSchema = z.object({
    explanation: z.string(),
    confidence: z.number(),
});

/**
 * Represents the structured recommendation output from a Recommendation Agent.
 * This aligns with the structured output requested from the LLM.
 */
export interface RecommendationResult {
    recommendations: WineRecommendationOutput[]; // Array of wine names (strings)
    reasoning?: string; // Explanation/reasoning from LLM
    confidence: number; // Confidence score for the recommendation
    pairingNotes?: string; // Notes on food pairing
    alternatives?: WineRecommendationOutput[]; // Alternative recommendations
    source?: 'knowledge_graph' | 'llm' | 'hybrid'; // Source of the recommendation
    error?: string; // Optional error message
}

export const RecommendationResultSchema = z.object({
    recommendations: z.array(z.object({
        name: z.string(),
        grapeVarieties: z.array(z.object({
            name: z.string(),
            percentage: z.number().optional()
        })).optional()
    })),
    reasoning: z.string().optional(),
    confidence: z.number(),
    pairingNotes: z.string().optional(),
    alternatives: z.array(z.object({
        name: z.string(),
        grapeVarieties: z.array(z.object({
            name: z.string(),
            percentage: z.number().optional()
        })).optional()
    })).optional(),
    source: z.union([z.literal('knowledge_graph'), z.literal('llm'), z.literal('hybrid')]).optional(),
    error: z.string().optional(),
});

/**
 * Represents the result of the ExplanationAgent.
 */
export interface ExplanationResult {
    explanation: string;
    // Add references to recommendation details if needed
}
/**
 * Represents the final recommendation payload sent to the API.
 */
export interface FinalRecommendationPayload {
    primaryRecommendation: WineRecommendationOutput | null;
    alternatives: WineRecommendationOutput[];
    explanation: string;
    confidence: number;
    conversationId: string;
    canRefine: boolean;
}
