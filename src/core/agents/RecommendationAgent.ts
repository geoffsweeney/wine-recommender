import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { KnowledgeGraphService, WineNode } from '@src/services/KnowledgeGraphService'; // Using @src alias

@injectable()
export class RecommendationAgent implements Agent {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService
  ) {}

  getName(): string {
    return 'RecommendationAgent';
  }

  async handleMessage(message: any): Promise<any> {
    console.log('RecommendationAgent received message:', message);
    // Basic interaction with KnowledgeGraphService for POC
    const placeholderWineId = 'some-wine-id'; // Replace with a valid ID from your Neo4j data
    try {
      const similarWines = await this.knowledgeGraphService.findSimilarWines(placeholderWineId);
      console.log('Similar wines found:', similarWines);
      // Return a basic response for the POC
      return { recommendation: similarWines.length > 0 ? `Found similar wines: ${similarWines.map((w: WineNode) => w.name).join(', ')}` : 'No similar wines found.' };
    } catch (error) {
      console.error('Error calling KnowledgeGraphService:', error);
      return { error: 'Failed to get recommendations' };
    }
  }
}

// TODO: Implement actual recommendation logic based on user input