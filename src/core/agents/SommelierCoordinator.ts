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
import { BasicDeadLetterProcessor } from '../BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor

@injectable()
export class SommelierCoordinator implements Agent {
  public failNextRequest: boolean = false; // Add failNextRequest property

  constructor(
    @inject(InputValidationAgent) private readonly inputValidationAgent: InputValidationAgent,
    @inject(RecommendationAgent) private readonly recommendationAgent: RecommendationAgent,
    @inject(ValueAnalysisAgent) private readonly valueAnalysisAgent: ValueAnalysisAgent,
    @inject(UserPreferenceAgent) private readonly userPreferenceAgent: UserPreferenceAgent,
    @inject(ExplanationAgent) private readonly explanationAgent: ExplanationAgent,
    @inject(MCPAdapterAgent) private readonly mcpAdapterAgent: MCPAdapterAgent,
    @inject(FallbackAgent) private readonly fallbackAgent: FallbackAgent,
    @inject(BasicDeadLetterProcessor) private readonly deadLetterProcessor: BasicDeadLetterProcessor // Inject BasicDeadLetterProcessor
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
          // On validation failure, send to dead letter queue
          await this.deadLetterProcessor.process(message, new Error(validationResult?.error || 'Invalid input provided.'), { source: this.getName(), stage: 'InputValidation' });
          return this.fallbackAgent.handleMessage({ error: validationResult?.error || 'Invalid input provided.', preferences: { wineType: 'Unknown' } });
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
         // On failure to determine request type, send to dead letter queue
         await this.deadLetterProcessor.process(message, new Error('Could not determine request type from input.'), { source: this.getName(), stage: 'RequestTypeDetermination' });
         return this.fallbackAgent.handleMessage({ error: 'Could not determine request type from input (no message with ingredients or preferences provided.)', preferences: { wineType: 'Unknown' } });
       }


      // Basic calls to other agents for inclusion in the flow
      console.log('SommelierCoordinator: Passing input to ValueAnalysisAgent (Basic)');
      try {
        await this.valueAnalysisAgent.handleMessage(recommendationInput); // Basic call
      } catch (error) {
        console.error('Error calling ValueAnalysisAgent:', error);
        await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in ValueAnalysisAgent.'), { source: this.getName(), stage: 'ValueAnalysisAgent' });
        // Decide how to handle this error - maybe continue or return a partial result?
        // For now, we'll just log and continue, assuming subsequent agents might still provide value.
      }

      console.log('SommelierCoordinator: Passing input to UserPreferenceAgent (Basic)');
      try {
        await this.userPreferenceAgent.handleMessage(recommendationInput); // Basic call
      } catch (error) {
        console.error('Error calling UserPreferenceAgent:', error);
        await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in UserPreferenceAgent.'), { source: this.getName(), stage: 'UserPreferenceAgent' });
        // Decide how to handle this error - maybe continue or return a partial result?
        // For now, we'll just log and continue, assuming subsequent agents might still provide value.
      }

      console.log('SommelierCoordinator: Passing input to MCPAdapterAgent (Basic)');
      try {
        await this.mcpAdapterAgent.handleMessage(recommendationInput); // Basic call
      } catch (error) {
        console.error('Error calling MCPAdapterAgent:', error);
        await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in MCPAdapterAgent.'), { source: this.getName(), stage: 'MCPAdapterAgent' });
        // Decide how to handle this error - maybe continue or return a partial result?
        // For now, we'll just log and continue, assuming subsequent agents might still provide value.
      }


      console.log('SommelierCoordinator: Passing input to RecommendationAgent');
      let recommendationResult;
      try {
        recommendationResult = await this.recommendationAgent.handleMessage(recommendationInput);
        console.log('SommelierCoordinator: Received recommendation result:', recommendationResult);

        // Basic call to ExplanationAgent after recommendation
        console.log('SommelierCoordinator: Passing recommendation result to ExplanationAgent (Basic)');
        try {
          await this.explanationAgent.handleMessage(recommendationResult); // Basic call
        } catch (error) {
          console.error('Error calling ExplanationAgent:', error);
          await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in ExplanationAgent.'), { source: this.getName(), stage: 'ExplanationAgent' });
          // Decide how to handle this error - maybe continue or return a partial result?
          // For now, we'll just log and continue, assuming subsequent agents might still provide value.
        }

        // Return the final result from the RecommendationAgent
        return recommendationResult;

      } catch (error) {
        console.error('Error calling RecommendationAgent:', error);
        // If RecommendationAgent fails, send to DLQ and re-throw the error
        await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in RecommendationAgent.'), { source: this.getName(), stage: 'RecommendationAgent' });
        throw new Error('Recommendation failed.'); // Re-throw a specific error to be caught by the API route handler
      }

    } catch (error) {
      console.error('Error during SommelierCoordinator orchestration:', error);
      // On error during orchestration (excluding RecommendationAgent's handled error), send to dead letter queue
      await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Unknown error during orchestration.'), { source: this.getName(), stage: 'Orchestration' });
      // Re-throw the error to be caught by the route handler
      throw error;
    }
  }
}

// TODO: Implement more sophisticated orchestration logic involving other agents
// TODO: Integrate with Agent Communication Bus and Shared Context Memory