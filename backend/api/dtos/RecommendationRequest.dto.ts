import { z } from 'zod';

export const RecommendationRequest = z.object({
  userId: z.string().min(1, 'User ID is required'),
  input: z.object({ // Wrap preferences, message, and ingredients in an 'input' object
    preferences: z.object({
      wineType: z.enum(['red', 'white', 'sparkling', 'rose']).optional().default('red'),
      priceRange: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
      foodPairing: z.string().optional(),
      excludeAllergens: z.array(z.string()).optional(),
      sweetness: z.string().optional(), // Added sweetness preference
    }).strict().optional(), // Make preferences optional within input
    message: z.string().optional(), // Keep message optional within input
    ingredients: z.array(z.string()).optional(), // Add ingredients as an optional array of strings
    recommendationSource: z.enum(['knowledgeGraph', 'llm']).optional().default('knowledgeGraph'), // Added recommendationSource
  }),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
});

export type RecommendationRequest = z.infer<typeof RecommendationRequest>;