import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { KnowledgeGraphService, WineNode } from '@src/services/KnowledgeGraphService'; // Using @src alias
import { RecommendationRequest } from '@src/api/dtos/RecommendationRequest.dto'; // Import DTO

// Define a type for the flexible input
type RecommendationInput = { ingredients: string[] } | { preferences: RecommendationRequest['preferences'] };

@injectable()
export class RecommendationAgent implements Agent {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService
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
         // TODO: Implement logic to query KnowledgeGraphService based on preferences
         // For now, a placeholder or call a new method
         if (message.preferences.wineType) {
             console.log('RecommendationAgent: Finding wines by wine type:', message.preferences.wineType);
             // Call a new method in KnowledgeGraphService (to be added next)
             recommendedWines = await this.knowledgeGraphService.findWinesByType(message.preferences.wineType); // Placeholder call
         } else {
             // Handle other preferences or no specific preference
             return { recommendation: 'Please specify a wine type or other preferences.' };
         }

      } else {
        return { error: 'Invalid input for RecommendationAgent: neither ingredients nor preferences provided.' };
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

    } catch (error) {
      console.error('Error in RecommendationAgent:', error);
      // In a real implementation, this might go to a FallbackAgent
      return { error: 'Failed to get recommendations.' };
    }
  }
}

// TODO: Implement actual recommendation logic based on user input