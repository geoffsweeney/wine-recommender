import winston from 'winston';
import { Agent } from './Agent';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { inject, injectable } from 'tsyringe';
import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { logger } from '../../utils/logger';

interface Wine {
  id: string;
  name: string;
  region: string;
  price?: number;
  type: string;
}

@injectable()
export class RecommendationAgent implements Agent {
  constructor(
    @inject('LLMService') private llmService: LLMService,
    @inject('KnowledgeGraphService') private knowledgeGraphService: KnowledgeGraphService,
    @inject('DeadLetterProcessor') private deadLetterProcessor: DeadLetterProcessor,
    @inject('logger') private logger: winston.Logger // Change injection token to lowercase 'logger'
  ) {}

  async handleMessage(message: any): Promise<any> {
    this.logger.info('RecommendationAgent.handleMessage entered.');
    this.logger.debug('Received message:', message); // Debug log for input

    let recommendedWines: Wine[] = []; // Ensure this is always initialized
    let recommendationType: 'ingredients' | 'preferences' = 'preferences';

    try {
        if (message.ingredients && message.ingredients.length > 0) {
            this.logger.info('Handling ingredient-based request.');
            recommendedWines = await this.knowledgeGraphService.findWinesByIngredients(message.ingredients);
            recommendationType = 'ingredients';
        } else if (message.preferences) {
            this.logger.info('Handling preference-based request.');
            recommendedWines = await this.knowledgeGraphService.findWinesByPreferences(message.preferences);
            recommendationType = 'preferences'; // Ensure this is set correctly
        }

        // Check if recommendedWines is defined and has a length
        if (!recommendedWines || recommendedWines.length === 0) {
            return this.handleNoWinesFound(recommendationType);
        }

        return await this.enhanceRecommendations(recommendedWines, message, recommendationType);
    } catch (error: any) {
        await this.handleError(message, error);
        throw error;
    }
  }

  private async enhanceRecommendations(recommendedWines: Wine[], message: any, recommendationType: string) {
    const llmPrompt = `Based on the user's input (${recommendationType}) and the provided wine recommendations, provide an enhanced list of recommendations and a brief explanation. The explanation should highlight why the recommended wines are a good match for the user's request. Respond strictly in JSON format with the following structure:
{
  "recommendedWines": Wine[], // An array of enhanced wine objects (same structure as input Wine objects).
  "llmEnhancement": string // A brief text explaining the recommendations, focusing on the match with user input.
}

Keep the "llmEnhancement" concise and helpful.

User Input: ${JSON.stringify(message)}

Recommended Wines: ${JSON.stringify(recommendedWines)}`;
    this.logger.info('Sending recommendations and input to LLM for enhancement.');

    try { // Outer try for LLM call
      const llmResponse = await this.llmService.sendPrompt(llmPrompt);

      if (!llmResponse) {
        this.logger.warn('LLM did not return an enhancement. Returning original recommendations.');
        return { recommendedWines };
      }

      try { // Inner try for parsing
        const enhancedRecommendations = JSON.parse(llmResponse);

        // Enhanced validation of the parsed structure
        if (enhancedRecommendations &&
            Array.isArray(enhancedRecommendations.recommendedWines) &&
            typeof enhancedRecommendations.llmEnhancement === 'string') {
          return {
            recommendedWines: enhancedRecommendations.recommendedWines,
            llmEnhancement: enhancedRecommendations.llmEnhancement,
          };
        } else {
          this.logger.warn('LLM response did not contain expected structure for enhancement. Returning original recommendations.');
          // Optionally log the unexpected LLM response for debugging
          this.logger.debug('Unexpected LLM response:', llmResponse);
          return { recommendedWines };
        }
      } catch (parseError: any) { // Catch for parsing errors
        this.logger.error('Failed to parse LLM enhancement response as JSON:', parseError);
        // Add to Dead Letter Queue for parsing errors
        await this.deadLetterProcessor.process({ recommendedWines, message, recommendationType, llmResponse }, parseError instanceof Error ? parseError : new Error(parseError), { source: this.getName(), stage: 'LLMEnhancementParsing' });
        // Return original recommendations and the raw LLM response for debugging
        return {
          recommendedWines,
          llmEnhancement: `Error processing LLM enhancement: ${parseError.message}. Raw LLM response: ${llmResponse}`,
          error: 'Error during LLM enhancement: Failed to parse response as JSON.',
        };
      }

    } catch (llmCallError: any) { // Catch for LLM call errors
      this.logger.error('Error calling LLM service for enhancement:', llmCallError);
      // Add to Dead Letter Queue for LLM call errors
      await this.deadLetterProcessor.process({ recommendedWines, message, recommendationType }, llmCallError instanceof Error ? llmCallError : new Error(llmCallError), { source: this.getName(), stage: 'LLMEnhancementCall' });
      // Return original recommendations and an error message
      return {
        recommendedWines,
        llmEnhancement: `Error communicating with LLM for enhancement: ${llmCallError.message || String(llmCallError)}`,
        error: 'Error during LLM enhancement: Failed to communicate with LLM.',
      };
    }
  }

  private handleNoWinesFound(recommendationType: string) {
    const message = recommendationType === 'preferences'
      ? `Sorry, we couldn't find any wines matching your preferences.`
      : `Sorry, we couldn't find any wines based on the provided ingredients.`;
    this.logger.info('No wines found. Returning not found message.');
    return { recommendation: message };
  }

  private async handleError(message: any, error: any) {
    const errorObj = error instanceof Error ? error : new Error(error);
    this.logger.error('Error in RecommendationAgent:', error);
    await this.deadLetterProcessor.process(message, errorObj, { agent: 'RecommendationAgent', timestamp: new Date().toISOString() });
  }

  getName(): string {
    return 'RecommendationAgent';
  }
}