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
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus
import { logger } from '../../utils/logger'; // Import the logger
import winston from 'winston'; // Import winston for logger type

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
    @inject(BasicDeadLetterProcessor) private readonly deadLetterProcessor: BasicDeadLetterProcessor, // Inject BasicDeadLetterProcessor
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus, // Inject AgentCommunicationBus
    @inject('logger') private logger: winston.Logger // Inject the logger
  ) {
    // Register agents with the communication bus
    this.communicationBus.registerAgent(this.inputValidationAgent.getName(), { name: this.inputValidationAgent.getName(), capabilities: ['input-validation'] });
    this.communicationBus.registerAgent(this.recommendationAgent.getName(), { name: this.recommendationAgent.getName(), capabilities: ['recommendation'] });
    this.communicationBus.registerAgent(this.valueAnalysisAgent.getName(), { name: this.valueAnalysisAgent.getName(), capabilities: ['value-analysis'] });
    this.communicationBus.registerAgent(this.userPreferenceAgent.getName(), { name: this.userPreferenceAgent.getName(), capabilities: ['user-preferences'] });
    this.communicationBus.registerAgent(this.explanationAgent.getName(), { name: this.explanationAgent.getName(), capabilities: ['explanation'] });
    this.communicationBus.registerAgent(this.mcpAdapterAgent.getName(), { name: this.mcpAdapterAgent.getName(), capabilities: ['mcp-adapter'] });
    this.communicationBus.registerAgent(this.fallbackAgent.getName(), { name: this.fallbackAgent.getName(), capabilities: ['fallback'] });
  }

 getName(): string {
    return 'SommelierCoordinator';
  }

  async handleMessage(message: RecommendationRequest): Promise<any> {
    this.logger.info('SommelierCoordinator received message:', message); // Use logger

    try {
      let recommendationInput: any;

      // Prioritize message content for ingredient parsing
      if (message.message !== undefined) {
        this.logger.info('SommelierCoordinator: Processing message content for input validation.'); // Use logger
        // Use SharedContextMemory to pass input to InputValidationAgent
        this.communicationBus.setContext(this.getName(), 'inputMessage', message.message);
        const validationResult = await this.inputValidationAgent.handleMessage(message.message);
        this.logger.info('SommelierCoordinator: Input validation result:', validationResult); // Log validation result

        // Use SharedContextMemory to retrieve result from InputValidationAgent (assuming agent sets it)
        // const validationResult = this.communicationBus.getContext(this.inputValidationAgent.getName(), 'validationResult'); // This would be the pattern if agents set context

        if (!validationResult || !validationResult.isValid) {
          this.logger.warn('SommelierCoordinator: Input validation failed. Using FallbackAgent.'); // Use logger
          // On validation failure, send to dead letter queue
          await this.deadLetterProcessor.process(message, new Error(validationResult?.error || 'Invalid input provided.'), { source: this.getName(), stage: 'InputValidation' });
          return this.fallbackAgent.handleMessage({ error: validationResult?.error || 'Invalid input provided.', preferences: { wineType: 'Unknown' } });
        }

        if (validationResult.processedInput && validationResult.processedInput.ingredients && validationResult.processedInput.ingredients.length > 0) {
          this.logger.info('SommelierCoordinator: Detected ingredient-based request from message.'); // Use logger
          recommendationInput = { ingredients: validationResult.processedInput.ingredients };
        } else {
           this.logger.info('SommelierCoordinator: Message processed, but no ingredients found. Checking preferences.'); // Use logger
           // Fall through to check preferences if no ingredients were found in the message
         }
       }

       // If no ingredient-based input from message, check preferences
       if (!recommendationInput && message.preferences) {
          this.logger.info('SommelierCoordinator: Detected preference-based request from preferences object.'); // Use logger
          recommendationInput = { preferences: message.preferences };
       }
       this.logger.info('SommelierCoordinator: Determined recommendation input:', recommendationInput); // Log determined input


       // If no valid input found, use FallbackAgent
       if (!recommendationInput) {
          this.logger.warn('SommelierCoordinator: Could not determine request type from input. Using FallbackAgent.'); // Use logger
          // On failure to determine request type, send to dead letter queue
          await this.deadLetterProcessor.process(message, new Error('Could not determine request type from input.'), { source: this.getName(), stage: 'RequestTypeDetermination' });
          return this.fallbackAgent.handleMessage({ error: 'Could not determine request type from input (no message with ingredients or preferences provided.)', preferences: { wineType: 'Unknown' } });
        }


       // Basic calls to other agents for inclusion in the flow
       this.logger.info('SommelierCoordinator: Passing input to ValueAnalysisAgent (Basic)'); // Use logger
       try {
         // Use SharedContextMemory to pass input to ValueAnalysisAgent
         this.communicationBus.setContext(this.getName(), 'recommendationInput', recommendationInput);
         await this.valueAnalysisAgent.handleMessage(recommendationInput); // Basic call
         // Use SharedContextMemory to retrieve result from ValueAnalysisAgent (assuming agent sets it)
         // const valueAnalysisResult = this.communicationBus.getContext(this.valueAnalysisAgent.getName(), 'analysisResult'); // This would be the pattern if agents set context
         this.logger.info('SommelierCoordinator: ValueAnalysisAgent call completed.'); // Log completion
       } catch (error) {
         this.logger.error('Error calling ValueAnalysisAgent:', error); // Use logger
         await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in ValueAnalysisAgent.'), { source: this.getName(), stage: 'ValueAnalysisAgent' });
         // Decide how to handle this error - maybe continue or return a partial result?
         // For now, we'll just log and continue, assuming subsequent agents might still provide value.
       }

       this.logger.info('SommelierCoordinator: Passing input to UserPreferenceAgent (Basic)'); // Use logger
       try {
         // Use SharedContextMemory to pass input to UserPreferenceAgent
         this.communicationBus.setContext(this.getName(), 'recommendationInput', recommendationInput);
         await this.userPreferenceAgent.handleMessage(recommendationInput); // Basic call
         // Use SharedContextMemory to retrieve result from UserPreferenceAgent (assuming agent sets it)
         // const userPreferenceResult = this.communicationBus.getContext(this.userPreferenceAgent.getName(), 'preferencesResult'); // This would be the pattern if agents set context
         this.logger.info('SommelierCoordinator: UserPreferenceAgent call completed.'); // Log completion
       } catch (error) {
         this.logger.error('Error calling UserPreferenceAgent:', error); // Use logger
         await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in UserPreferenceAgent.'), { source: this.getName(), stage: 'UserPreferenceAgent' });
         // Decide how to handle this error - maybe continue or return a partial result?
         // For now, we'll just log and continue, assuming subsequent agents might still provide value.
       }

       this.logger.info('SommelierCoordinator: Passing input to MCPAdapterAgent (Basic)'); // Use logger
       try {
         // Use SharedContextMemory to pass input to MCPAdapterAgent
         this.communicationBus.setContext(this.getName(), 'recommendationInput', recommendationInput);
         await this.mcpAdapterAgent.handleMessage(recommendationInput); // Basic call
         // Use SharedContextMemory to retrieve result from MCPAdapterAgent (assuming agent sets it)
         // const mcpResult = this.communicationBus.getContext(this.mcpAdapterAgent.getName(), 'mcpResult'); // This would be the pattern if agents set context
         this.logger.info('SommelierCoordinator: MCPAdapterAgent call completed.'); // Log completion
       } catch (error) {
         this.logger.error('Error calling MCPAdapterAgent:', error); // Use logger
         await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in MCPAdapterAgent.'), { source: this.getName(), stage: 'MCPAdapterAgent' });
         // Decide how to handle this error - maybe continue or return a partial result?
         // For now, we'll just log and continue, assuming subsequent agents might still provide value.
       }


       this.logger.info('SommelierCoordinator: Passing input to RecommendationAgent'); // Use logger
        let recommendationResult;
        try {
          // Use SharedContextMemory to pass input to RecommendationAgent
          this.communicationBus.setContext(this.getName(), 'recommendationInput', recommendationInput);
          recommendationResult = await this.recommendationAgent.handleMessage(recommendationInput);
          // Use SharedContextMemory to retrieve result from RecommendationAgent (assuming agent sets it)
          // recommendationResult = this.communicationBus.getContext(this.recommendationAgent.getName(), 'recommendationResult'); // This would be the pattern if agents set context
          this.logger.info('SommelierCoordinator: Received recommendation result:', recommendationResult); // Use logger

         // Check if the RecommendationAgent returned an error
         if (recommendationResult && recommendationResult.error) {
           this.logger.error('SommelierCoordinator: RecommendationAgent reported an error:', recommendationResult.error); // Use logger
           // Throw an error to propagate the failure upstream
           throw new Error(`Recommendation Agent Error: ${recommendationResult.error}`);
         }


         // Basic call to ExplanationAgent after recommendation
         this.logger.info('SommelierCoordinator: Passing recommendation result to ExplanationAgent (Basic)'); // Use logger
         this.logger.info('SommelierCoordinator: Calling ExplanationAgent with result:', recommendationResult); // Use logger
        try {
          // Use SharedContextMemory to pass input to ExplanationAgent
          this.communicationBus.setContext(this.getName(), 'recommendationResult', recommendationResult);
          const explanationResult = await this.explanationAgent.handleMessage(recommendationResult); // Basic call
          // Use SharedContextMemory to retrieve result from ExplanationAgent (assuming agent sets it)
          // const explanationResult = this.communicationBus.getContext(this.explanationAgent.getName(), 'explanationResult'); // This would be the pattern if agents set context
          this.logger.info('SommelierCoordinator: ExplanationAgent call completed. Result:', explanationResult); // Log completion and result
          // TODO: Integrate explanationResult into the final response if needed
        } catch (error) {
           this.logger.error('Error calling ExplanationAgent:', error); // Use logger
           await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in ExplanationAgent.'), { source: this.getName(), stage: 'ExplanationAgent' });
           // Decide how to handle this error - maybe continue or return a partial result?
           // For now, we'll just log and continue, assuming subsequent agents might still provide value.
         }

         // Return the final result from the RecommendationAgent
         this.logger.info('SommelierCoordinator: Returning final recommendation result:', recommendationResult); // Added log
         return recommendationResult;

       } catch (error) {
         this.logger.error('Error calling RecommendationAgent:', error); // Use logger
         // If RecommendationAgent fails, send to DLQ and re-throw the error
         await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in RecommendationAgent.'), { source: this.getName(), stage: 'RecommendationAgent' });
         this.logger.error('SommelierCoordinator: Re-throwing RecommendationAgent error.'); // Added log
         throw error; // Re-throw the original error caught from RecommendationAgent
       }
 
     } catch (error: any) { // Added type annotation
       this.logger.error('Error during SommelierCoordinator orchestration:', error); // Use logger
       this.logger.error('SommelierCoordinator: Caught orchestration error type:', typeof error, 'message:', error.message); // Added detailed log
       // On error during orchestration (excluding RecommendationAgent's handled error), send to dead letter queue
       await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Unknown error during orchestration.'), { source: this.getName(), stage: 'Orchestration' });
       this.logger.error('SommelierCoordinator: Re-throwing orchestration error.'); // Added log
       // Re-throw the error to be caught by the route handler
       throw error;
     }
   }
 }

 // TODO: Implement more sophisticated orchestration logic involving other agents