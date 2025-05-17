import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { InputValidationAgent } from './InputValidationAgent';
import { RecommendationAgent } from './RecommendationAgent';
import { ValueAnalysisAgent } from './ValueAnalysisAgent';
import { UserPreferenceAgent } from './UserPreferenceAgent';
import { ExplanationAgent } from './ExplanationAgent';
import { MCPAdapterAgent } from './MCPAdapterAgent';
import { FallbackAgent } from './FallbackAgent';
import { LLMRecommendationAgent } from './LLMRecommendationAgent'; // Import LLMRecommendationAgent
import { RecommendationRequest } from '@src/api/dtos/RecommendationRequest.dto'; // Import DTO
import { BasicDeadLetterProcessor } from '../BasicDeadLetterProcessor'; // Import BasicDeadLetterProcessor
import { ConversationHistoryService } from '../ConversationHistoryService'; // Import ConversationHistoryService
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus
import { logger } from '../../utils/logger'; // Import the logger
import winston from 'winston'; // Import winston for logger type

@injectable()
export class SommelierCoordinator implements Agent {
  public failNextRequest: boolean = false; // Add failNextRequest property

  constructor(
    @inject(InputValidationAgent) private readonly inputValidationAgent: InputValidationAgent,
    @inject(RecommendationAgent) private readonly recommendationAgent: RecommendationAgent,
    @inject(LLMRecommendationAgent) private readonly llmRecommendationAgent: LLMRecommendationAgent, // Inject LLMRecommendationAgent
    @inject(ValueAnalysisAgent) private readonly valueAnalysisAgent: ValueAnalysisAgent,
    @inject(UserPreferenceAgent) private readonly userPreferenceAgent: UserPreferenceAgent,
    @inject(ExplanationAgent) private readonly explanationAgent: ExplanationAgent,
    @inject(MCPAdapterAgent) private readonly mcpAdapterAgent: MCPAdapterAgent,
    @inject(FallbackAgent) private readonly fallbackAgent: FallbackAgent,
    @inject(BasicDeadLetterProcessor) private readonly deadLetterProcessor: BasicDeadLetterProcessor, // Inject BasicDeadLetterProcessor
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus, // Inject AgentCommunicationBus
    @inject(ConversationHistoryService) private readonly conversationHistoryService: ConversationHistoryService, // Inject ConversationHistoryService
    @inject('logger') private logger: winston.Logger // Inject the logger
  ) {
    // Register agents with the communication bus
    this.communicationBus.registerAgent(this.inputValidationAgent.getName(), { name: this.inputValidationAgent.getName(), capabilities: ['input-validation'] });
    this.communicationBus.registerAgent(this.recommendationAgent.getName(), { name: this.recommendationAgent.getName(), capabilities: ['recommendation'] });
    this.communicationBus.registerAgent(this.llmRecommendationAgent.getName(), { name: this.llmRecommendationAgent.getName(), capabilities: ['llm-recommendation'] }); // Register LLMRecommendationAgent
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
      // Retrieve existing conversation history
      const conversationHistory = this.conversationHistoryService.getConversationHistory(message.userId);
      this.logger.info(`SommelierCoordinator: Retrieved history for user ${message.userId}:`, conversationHistory);

      let recommendationInput: any;

      // Prioritize message content for input validation and extraction
      if (message.input.message !== undefined) {
        this.logger.info('SommelierCoordinator: Processing message content for input validation.'); // Use logger
        // Use SharedContextMemory to pass input to InputValidationAgent
        this.communicationBus.setContext(this.getName(), 'inputMessage', message.input.message);
        const validationResult = await this.inputValidationAgent.handleMessage({
          input: message.input.message,
          conversationHistory: conversationHistory,
        });
        this.logger.info('SommelierCoordinator: Input validation result:', validationResult); // Log validation result

        // Use SharedContextMemory to retrieve result from InputValidationAgent (assuming agent sets it)
        // const validationResult = this.communicationBus.getContext(this.inputValidationAgent.getName(), 'validationResult'); // This would be the pattern if agents set context

        if (!validationResult || !validationResult.isValid) {
          this.logger.warn('SommelierCoordinator: Input validation failed. Using FallbackAgent.'); // Use logger
          // On validation failure, send to dead letter queue
          await this.deadLetterProcessor.process(message, new Error(validationResult?.error || 'Invalid input provided.'), { source: this.getName(), stage: 'InputValidation' });
          return this.fallbackAgent.handleMessage({ error: validationResult?.error || 'Invalid input provided.', preferences: { wineType: 'Unknown' } });
        }

        if (validationResult.processedInput) {
          if (validationResult.processedInput.ingredients && validationResult.processedInput.ingredients.length > 0) {
            this.logger.info('SommelierCoordinator: Detected ingredient-based request from message.'); // Use logger
            // Use ingredients from validation result, and include preferences if also extracted
            recommendationInput = { ingredients: validationResult.processedInput.ingredients };
            if (validationResult.processedInput.preferences) {
                recommendationInput.preferences = validationResult.processedInput.preferences;
            }
          } else if (validationResult.processedInput.preferences && Object.keys(validationResult.processedInput.preferences).length > 0) {
             this.logger.info('SommelierCoordinator: Detected preference-based request from message validation.'); // Use logger
             recommendationInput = { preferences: validationResult.processedInput.preferences };
          }
        }
      }

       // If no input determined from message validation, check original preferences object
       if (!recommendationInput && message.input.preferences) {
          this.logger.info('SommelierCoordinator: Detected preference-based request from original preferences object.'); // Use logger
          recommendationInput = { preferences: message.input.preferences };
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
         await this.valueAnalysisAgent.handleMessage({ input: recommendationInput, conversationHistory: conversationHistory }); // Basic call
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
         await this.userPreferenceAgent.handleMessage({ input: recommendationInput, conversationHistory: conversationHistory }); // Basic call
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
         await this.mcpAdapterAgent.handleMessage({ input: recommendationInput, conversationHistory: conversationHistory }); // Basic call
         // Use SharedContextMemory to retrieve result from MCPAdapterAgent (assuming agent sets it)
         // const mcpResult = this.communicationBus.getContext(this.mcpAdapterAgent.getName(), 'mcpResult'); // This would be the pattern if agents set context
         this.logger.info('SommelierCoordinator: MCPAdapterAgent call completed.'); // Log completion
       } catch (error) {
         this.logger.error('Error calling MCPAdapterAgent:', error); // Use logger
         await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in MCPAdapterAgent.'), { source: this.getName(), stage: 'MCPAdapterAgent' });
         // Decide how to handle this error - maybe continue or return a partial result?
         // For now, we'll just log and continue, assuming subsequent agents might still provide value.
       }


       let recommendationResult;
       const recommendationSource = message.input.recommendationSource;
       this.logger.info(`SommelierCoordinator: Recommendation source selected: ${recommendationSource}`);

       try {
           // Use SharedContextMemory to pass input to the selected Recommendation Agent
           this.communicationBus.setContext(this.getName(), 'recommendationInput', recommendationInput);

           if (recommendationSource === 'llm') {
               this.logger.info('SommelierCoordinator: Routing to LLMRecommendationAgent');
               recommendationResult = await this.llmRecommendationAgent.handleMessage({ input: recommendationInput, conversationHistory: conversationHistory });
           } else { // Default to knowledgeGraph if not 'llm' or if source is 'knowledgeGraph'
               this.logger.info('SommelierCoordinator: Routing to RecommendationAgent (Knowledge Graph)');
               recommendationResult = await this.recommendationAgent.handleMessage({ input: recommendationInput, conversationHistory: conversationHistory });
           }

           this.logger.info('SommelierCoordinator: Received recommendation result:', recommendationResult);

           // Check if the selected Recommendation Agent returned an error
           if (recommendationResult && recommendationResult.error) {
               this.logger.error(`SommelierCoordinator: ${recommendationSource === 'llm' ? 'LLMRecommendationAgent' : 'RecommendationAgent'} reported an error:`, recommendationResult.error);
               // Throw an error to propagate the failure upstream
               throw new Error(`${recommendationSource === 'llm' ? 'LLM Recommendation Agent' : 'Recommendation Agent'} Error: ${recommendationResult.error}`);
           }

           // Basic call to ExplanationAgent after recommendation
           this.logger.info('SommelierCoordinator: Passing recommendation result to ExplanationAgent (Basic)');
           this.logger.info('SommelierCoordinator: Calling ExplanationAgent with result:', recommendationResult);
           try {
               // Use SharedContextMemory to pass input to ExplanationAgent
               this.communicationBus.setContext(this.getName(), 'recommendationResult', recommendationResult);
               const explanationResult = await this.explanationAgent.handleMessage(recommendationResult); // Basic call
               this.logger.info('SommelierCoordinator: ExplanationAgent call completed. Result:', explanationResult);
               // TODO: Integrate explanationResult into the final response if needed
           } catch (error) {
               this.logger.error('Error calling ExplanationAgent:', error);
               await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error('Error in ExplanationAgent.'), { source: this.getName(), stage: 'ExplanationAgent' });
               // Decide how to handle this error - maybe continue or return a partial result?
               // For now, we'll just log and continue, assuming subsequent agents might still provide value.
           }

           // Return the final result from the selected Recommendation Agent
           this.logger.info('SommelierCoordinator: Returning final recommendation result:', recommendationResult);

           // Add user message and assistant response to history
           if (message.input.message) {
               this.conversationHistoryService.addConversationTurn(message.userId, { role: 'user', content: message.input.message });
           }
           // Assuming recommendationResult has a 'response' field with the assistant's message
           if (recommendationResult && recommendationResult.response) {
               this.conversationHistoryService.addConversationTurn(message.userId, { role: 'assistant', content: recommendationResult.response });
           }

           return recommendationResult;

       } catch (error) {
           this.logger.error(`Error calling ${recommendationSource === 'llm' ? 'LLMRecommendationAgent' : 'RecommendationAgent'}:`, error);
           // If the selected Recommendation Agent fails, send to DLQ and re-throw the error
           await this.deadLetterProcessor.process(message, error instanceof Error ? error : new Error(`Error in ${recommendationSource === 'llm' ? 'LLMRecommendationAgent' : 'RecommendationAgent'}.`), { source: this.getName(), stage: recommendationSource === 'llm' ? 'LLMRecommendationAgent' : 'RecommendationAgent' });
           this.logger.error('SommelierCoordinator: Re-throwing Recommendation Agent error.');
           throw error; // Re-throw the original error caught from the Recommendation Agent
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