import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { InputValidationAgent } from './InputValidationAgent';
import { RecommendationAgent } from './RecommendationAgent';
import { ValueAnalysisAgent } from './ValueAnalysisAgent';
import { UserPreferenceAgent } from './UserPreferenceAgent';
import { ExplanationAgent } from './ExplanationAgent';
import { MCPAdapterAgent } from './MCPAdapterAgent';
import { FallbackAgent } from './FallbackAgent';
import { RecommendationRequest } from '@src/api/dtos/RecommendationRequest.dto'; // Import DTO

@injectable()
export class SommelierCoordinator implements Agent {
  constructor(
    @inject(InputValidationAgent) private readonly inputValidationAgent: InputValidationAgent,
    @inject(RecommendationAgent) private readonly recommendationAgent: RecommendationAgent,
    @inject(ValueAnalysisAgent) private readonly valueAnalysisAgent: ValueAnalysisAgent,
    @inject(UserPreferenceAgent) private readonly userPreferenceAgent: UserPreferenceAgent,
    @inject(ExplanationAgent) private readonly explanationAgent: ExplanationAgent,
    @inject(MCPAdapterAgent) private readonly mcpAdapterAgent: MCPAdapterAgent,
    @inject(FallbackAgent) private readonly fallbackAgent: FallbackAgent
  ) {}

  getName(): string {
    return 'SommelierCoordinator';
  }

  async handleMessage(message: RecommendationRequest): Promise<any> {
    console.log('SommelierCoordinator received message:', message);

    try {
      let recommendationInput: any;

      // Prioritize message content for ingredient parsing
      if (message.message !== undefined) {
        console.log('SommelierCoordinator: Processing message content for input validation.');
        const validationResult = await this.inputValidationAgent.handleMessage(message.message);

        if (!validationResult || !validationResult.isValid) {
          console.log('SommelierCoordinator: Input validation failed. Using FallbackAgent.');
          return this.fallbackAgent.handleMessage({ error: validationResult?.error || 'Invalid input provided.' });
        }

        if (validationResult.processedInput && validationResult.processedInput.ingredients && validationResult.processedInput.ingredients.length > 0) {
          console.log('SommelierCoordinator: Detected ingredient-based request from message.');
          recommendationInput = { ingredients: validationResult.processedInput.ingredients };
        } else {
           console.log('SommelierCoordinator: Message processed, but no ingredients found. Checking preferences.');
           // Fall through to check preferences if no ingredients were found in the message
        }
      }

      // If no ingredient-based input from message, check preferences
      if (!recommendationInput && message.preferences) {
         console.log('SommelierCoordinator: Detected preference-based request from preferences object.');
         recommendationInput = { preferences: message.preferences };
      }

      // If no valid input found, use FallbackAgent
      if (!recommendationInput) {
         console.log('SommelierCoordinator: Could not determine request type from input. Using FallbackAgent.');
         return this.fallbackAgent.handleMessage({ error: 'Could not determine request type from input (no message with ingredients or preferences provided).' });
      }


      // Basic calls to other agents for inclusion in the flow
      console.log('SommelierCoordinator: Passing input to ValueAnalysisAgent (Basic)');
      await this.valueAnalysisAgent.handleMessage(recommendationInput); // Basic call

      console.log('SommelierCoordinator: Passing input to UserPreferenceAgent (Basic)');
      await this.userPreferenceAgent.handleMessage(recommendationInput); // Basic call

      console.log('SommelierCoordinator: Passing input to MCPAdapterAgent (Basic)');
      await this.mcpAdapterAgent.handleMessage(recommendationInput); // Basic call


      console.log('SommelierCoordinator: Passing input to RecommendationAgent');
      const recommendationResult = await this.recommendationAgent.handleMessage(recommendationInput);
      console.log('SommelierCoordinator: Received recommendation result:', recommendationResult);

      // Basic call to ExplanationAgent after recommendation
      console.log('SommelierCoordinator: Passing recommendation result to ExplanationAgent (Basic)');
      await this.explanationAgent.handleMessage(recommendationResult); // Basic call


      // Return the final result from the RecommendationAgent
      return recommendationResult;

    } catch (error) {
      console.error('Error during SommelierCoordinator orchestration:', error);
      // Use FallbackAgent for errors during orchestration
      let errorMessage = 'An unexpected error occurred during orchestration.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return this.fallbackAgent.handleMessage({ error: errorMessage });
    }
  }
}

// TODO: Implement more sophisticated orchestration logic involving other agents
// TODO: Integrate with Agent Communication Bus and Shared Context Memory