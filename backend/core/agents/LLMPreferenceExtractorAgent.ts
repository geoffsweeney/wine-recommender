import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus';
import { LLMService } from '../../services/LLMService';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNormalizationService } from '../../services/PreferenceNormalizationService'; // Import the new service
import { PreferenceNode } from '../../types';

@injectable()
export class LLMPreferenceExtractorAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus,
    @inject(LLMService) private readonly llmService: LLMService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject('PreferenceNormalizationService') private readonly preferenceNormalizationService: PreferenceNormalizationService // Inject the new service
  ) {}

  getName(): string {
    return 'LLMPreferenceExtractorAgent';
  }

  async handleMessage(message: { input: string; history?: { role: string; content: string }[]; userId: string }): Promise<void> {
    console.log('LLMPreferenceExtractorAgent received message:', message);

    const { input, history, userId } = message;

    // Formulate a prompt for the LLM to extract user preferences
    // This prompt is similar to the one previously used in UserPreferenceAgent
    const llmPrompt = `Analyze the following user input for a wine recommendation request, considering the conversation history provided. Determine if it's a valid request and extract key information like ingredients or wine preferences. Provide the output in a JSON format with the following structure: { "isValid": boolean, "ingredients"?: string[], "preferences"?: { [key: string]: any }, "error"?: string }. If the input is invalid, set isValid to false and provide an error message.

${history ? history.map(turn => `${turn.role}: ${turn.content}`).join('\n') + '\n' : ''}User Input: "${input}"`;

    try {
      console.log('LLMPreferenceExtractorAgent: Sending input to LLM for preference extraction.');
      const llmResponse = await this.llmService.sendPrompt(llmPrompt);

      if (llmResponse) {
        console.log('LLMPreferenceExtractorAgent: Received LLM response.');
        // Extract the JSON string from the LLM response
        const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
        let jsonString = llmResponse;

        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1];
        } else {
            // Fallback if the ```json block is not found, try to find the first { and last }
            const firstBracket = llmResponse.indexOf('{');
            const lastBracket = llmResponse.lastIndexOf('}');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                jsonString = llmResponse.substring(firstBracket, lastBracket + 1);
            }
        }

        console.log('LLMPreferenceExtractorAgent: Extracted JSON string:', jsonString);

        try {
          const preferenceOutput: { preferences?: { [key: string]: any } } = JSON.parse(jsonString);

          // Basic validation of the parsed structure
          if (typeof preferenceOutput.preferences !== 'object' || preferenceOutput.preferences === null) {
             console.error('LLMPreferenceExtractorAgent: LLM response missing or invalid "preferences" field.');
             // TODO: Handle invalid structure - maybe log and discard or send to dead letter queue
             return;
          }

          console.log('LLMPreferenceExtractorAgent: Extracted preferences from LLM.');

          // Convert the preferences object to an array of PreferenceNode before normalizing
          const extractedPreferencesArray: PreferenceNode[] = Object.entries(preferenceOutput.preferences || {}).map(([type, value]) => ({
            type,
            value,
            source: 'llm', // Indicate source
            confidence: 1, // Placeholder confidence, refine later
            timestamp: new Date().toISOString(),
            active: true, // Default to active
          }));

          // Normalize and persist the preferences
          const normalizedPreferences = this.preferenceNormalizationService.normalizePreferences(extractedPreferencesArray); // Use the new service
          await this.persistPreferences(userId, normalizedPreferences);

          console.log('LLMPreferenceExtractorAgent: Preferences normalized and persisted.');

        } catch (parseError: any) {
          console.error('LLMPreferenceExtractorAgent: Error parsing or validating LLM response:', parseError);
          // TODO: Handle parsing errors - log and discard or send to dead letter queue
        }

      } else {
        console.warn('LLMPreferenceExtractorAgent: LLM did not return a preference response.');
        // TODO: Handle no LLM response - log and discard or send to dead letter queue
      }

    } catch (llmError) {
      console.error('LLMPreferenceExtractorAgent: Error during LLM preference extraction:', llmError);
      // TODO: Handle LLM communication errors - log and discard or send to dead letter queue
    }

    console.log('LLMPreferenceExtractorAgent finished processing message.');
  }

  // Helper method to persist normalized preferences
  private async persistPreferences(userId: string, preferences: PreferenceNode[]): Promise<void> {
    for (const preferenceNode of preferences) {
      await this.knowledgeGraphService.addOrUpdatePreference(userId, preferenceNode);
    }
  }
}