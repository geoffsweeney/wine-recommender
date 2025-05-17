import { injectable } from 'tsyringe';
import { Agent } from './Agent';
import { LLMService } from '../../services/LLMService';
import { ConversationTurn } from '../ConversationHistoryService'; // Corrected import

@injectable()
export class LLMRecommendationAgent implements Agent { // Changed extends to implements
    private llmService: LLMService;

    constructor(llmService: LLMService) {
        this.llmService = llmService;
    }

    getName(): string {
        return 'LLMRecommendationAgent';
    }

    public async handleMessage(message: { input: { preferences?: any; message?: string; ingredients?: string[]; recommendationSource?: 'knowledgeGraph' | 'llm' }; conversationHistory: ConversationTurn[] }): Promise<any> {
        console.log('LLMRecommendationAgent received message:', message);

        // Construct prompt for the LLM
        let prompt = "The user is asking for a wine recommendation.";

        if (message.input.message) {
            prompt += `\nUser input: ${message.input.message}`;
        }

        if (message.input.preferences && Object.keys(message.input.preferences).length > 0) {
            prompt += `\nUser preferences: ${JSON.stringify(message.input.preferences)}`;
        }

        if (message.input.ingredients && message.input.ingredients.length > 0) {
             prompt += `\nUser mentioned ingredients: ${message.input.ingredients.join(', ')}`;
        }


        if (message.conversationHistory && message.conversationHistory.length > 0) {
            prompt += "\nConversation history:";
            message.conversationHistory.forEach(turn => {
                prompt += `\n${turn.role}: ${turn.content}`;
            });
        }

        prompt += "\nPlease provide a wine recommendation based on the user's input and history.";

        console.log('Sending prompt to LLMService:', prompt);

        try {
            const llmResponse = await this.llmService.sendPrompt(prompt);
            console.log('Received response from LLMService:', llmResponse);
            // Assuming LLM response is the recommendation text
            return { recommendation: llmResponse };
        } catch (error) {
            console.error('Error calling LLMService:', error);
            // Re-throw the error to be handled by the SommelierCoordinator
            throw new Error(`Failed to get recommendation from LLM: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}