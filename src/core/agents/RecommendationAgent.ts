import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { BasicDeadLetterProcessor } from '../BasicDeadLetterProcessor'; // Add import for BasicDeadLetterProcessor
import { KnowledgeGraphService, WineNode } from '@src/services/KnowledgeGraphService'; // Using @src alias
import { RecommendationRequest } from '@src/api/dtos/RecommendationRequest.dto'; // Import DTO

// Define a type for the flexible input
type RecommendationInput = { ingredients: string[] } | { preferences: RecommendationRequest['preferences'] };

@injectable()
export class RecommendationAgent implements Agent {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(BasicDeadLetterProcessor) private readonly deadLetterProcessor: BasicDeadLetterProcessor
  ) {}

  getName(): string {
    return 'RecommendationAgent';
  }

  async handleMessage(message: RecommendationInput): Promise<any> { // Update method signature
    console.log('RecommendationAgent received message:', message);

    try {
      let recommendedWines: WineNode[] = [];
      let recommendationType: 'ingredients' | 'preferences' | 'unknown' = 'unknown';

      if ('ingredients' in message && message.ingredients && message.ingredients.length > 0) {
        console.log('RecommendationAgent: Handling ingredient-based request.');
        recommendedWines = await this.knowledgeGraphService.findWinesByIngredients(message.ingredients);
        recommendationType = 'ingredients';
      } else if ('preferences' in message && message.preferences) {
         console.log('RecommendationAgent: Handling preference-based request.');
         recommendationType = 'preferences';

         const preferences = message.preferences;
         console.log('RecommendationAgent: Processing preferences:', preferences);

         // Call a new method in KnowledgeGraphService to find wines by preferences (to be added next)
         recommendedWines = await this.knowledgeGraphService.findWinesByPreferences(preferences); // New method call

         // TODO: Refine response based on specific preferences used
         if (recommendedWines.length === 0) {
             return { recommendation: `Sorry, we couldn't find any wines matching your preferences.` };
         }

      } else {
        throw new Error('Invalid input for RecommendationAgent: neither ingredients nor preferences provided.');
      }


      console.log('Recommended wines found:', recommendedWines);

      // Format a basic response based on the recommendation type
      if (recommendedWines.length > 0) {
        const wineList = recommendedWines.map((w: WineNode) => `${w.name} (${w.region})`).join(', ');
        if (recommendationType === 'ingredients') {
           return { recommendation: `Based on your ingredients, we recommend: ${wineList}.` };
        } else if (recommendationType === 'preferences') {
           return { recommendation: `Based on your preferences, we recommend: ${wineList}.` };
        } else {
           return { recommendation: `Recommended wines: ${wineList}.` };
        }
      } else {
        if (recommendationType === 'ingredients') {
           return { recommendation: `Sorry, we couldn't find any wines that pair well with ${('ingredients' in message && message.ingredients) ? message.ingredients.join(' and ') : 'the provided ingredients'}.` };
        } else if (recommendationType === 'preferences') {
           return { recommendation: `Sorry, we couldn't find any wines matching your preferences.` };
        } else {
           return { recommendation: 'Sorry, no wines found based on your request.' };
        }
      }

    } catch (err) {
      let errorObj: Error;
      let error: Error;
      if (err instanceof Error) {
        error = err;
        errorObj = error;
      } else {
        error = new Error(`Error in RecommendationAgent: ${String(err)}`);
        errorObj = error;
      }
      console.error('Error in RecommendationAgent:', error);
      await this.deadLetterProcessor.addToDLQ(errorObj, message, { agent: 'RecommendationAgent', timestamp: new Date().toISOString() });
      throw new Error('Failed to get recommendations.');
    }
  }
}

// TODO: Implement actual recommendation logic based on user input