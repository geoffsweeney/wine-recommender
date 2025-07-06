import { z } from 'zod';

export const RecommendationRequest = z.object({
  userId: z.string().min(1, 'User ID is required'),
  input: z.object({
    preferences: z.object({
      wineType: z.enum(['red', 'white', 'sparkling', 'rose']).optional().default('red'),
      priceRange: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
      foodPairing: z.string().optional(),
      excludeAllergens: z.array(z.string()).optional(),
      sweetness: z.string().optional(),
    }).strict().optional(),
    message: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    recommendationSource: z.enum(['knowledgeGraph', 'llm']).optional().default('knowledgeGraph'),
  }).strict(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
}).strict();

export type RecommendationRequest = z.infer<typeof RecommendationRequest>;