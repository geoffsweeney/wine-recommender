import { z } from 'zod';

export const RecommendationRequest = z.object({
  userId: z.string().min(1, 'User ID is required'),
  input: z.object({ // Wrap preferences and message in an 'input' object
    preferences: z.object({
      wineType: z.enum(['red', 'white', 'sparkling', 'rose']).optional().default('red'),
      priceRange: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
      foodPairing: z.string().optional(),
      excludeAllergens: z.array(z.string()).optional()
    }).strict().optional(), // Make preferences optional within input
    message: z.string().optional(), // Keep message optional within input
  }).strict(), // Ensure no extra properties in input
  conversationHistory: z.array(z.object({
    role: z.string(),
    content: z.string()
  })).optional()
});

export type RecommendationRequest = z.infer<typeof RecommendationRequest>;