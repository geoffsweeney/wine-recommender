import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { InputValidationAgent } from './InputValidationAgent';
import { RecommendationAgent } from './RecommendationAgent';

@injectable()
export class SommelierCoordinator implements Agent {
  constructor(
    @inject(InputValidationAgent) private readonly inputValidationAgent: InputValidationAgent,
    @inject(RecommendationAgent) private readonly recommendationAgent: RecommendationAgent
  ) {}

  getName(): string {
    return 'SommelierCoordinator';
  }

  async handleMessage(message: any): Promise<any> {
    console.log('SommelierCoordinator received message:', message);

    // POC Orchestration Flow: Input Validation -> Recommendation
    try {
      console.log('SommelierCoordinator: Passing message to InputValidationAgent');
      const validationResult = await this.inputValidationAgent.handleMessage(message);
      console.log('SommelierCoordinator: Received validation result:', validationResult);

      if (!validationResult || !validationResult.isValid) {
        // Basic handling for invalid input in POC
        console.log('SommelierCoordinator: Input validation failed.');
        // In a real implementation, this might go to a FallbackAgent or return a specific error
        return { error: 'Invalid input provided.' };
      }

      console.log('SommelierCoordinator: Passing processed input to RecommendationAgent');
      // Assuming processedInput contains data needed by RecommendationAgent
      const recommendationResult = await this.recommendationAgent.handleMessage(validationResult.processedInput);
      console.log('SommelierCoordinator: Received recommendation result:', recommendationResult);

      // Return the final result from the RecommendationAgent
      return recommendationResult;

    } catch (error) {
      console.error('Error during SommelierCoordinator orchestration:', error);
      // Re-throw the error so the API route handler can catch it and return a 500
      throw error;
    }
  }
}

// TODO: Implement more sophisticated orchestration logic involving other agents
// TODO: Integrate with Agent Communication Bus and Shared Context Memory