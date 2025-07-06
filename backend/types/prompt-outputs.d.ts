import { RecommendationResult } from './agent-outputs';
import { z } from 'zod';

export interface RefineSuggestionsOutput {
  refinedRecommendations: RecommendationResult;
  reasoning: string;
}

// You can also define the Zod schema here if needed for other parts of the application
export const RefineSuggestionsOutputSchema = z.object({
  refinedRecommendations: RecommendationResult.describe('The refined recommendation result based on the critique.'),
  reasoning: z.string().describe('Explanation of how the recommendations were refined.'),
});