import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus

// Define a type for the expected structured output from the LLM for preferences
interface LLMPreferenceOutput {
  preferences: { [key: string]: any }; // Flexible for various preferences
  // Add other fields if needed, e.g., confidence score
}

@injectable()
export class UserPreferenceAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus // Inject AgentCommunicationBus
  ) {
    // console.log('UserPreferenceAgent constructor entered.');
  }

  getName(): string {
    return 'UserPreferenceAgent';
  }

  async handleMessage(message: { input: any; conversationHistory?: { role: string; content: string }[] }): Promise<{ preferences?: { [key: string]: any }; error?: string }> {
    // console.log('UserPreferenceAgent received message:', message);

    if (!this.communicationBus) {
      // console.error('UserPreferenceAgent: AgentCommunicationBus not available.');
      return { error: 'Communication bus not available' };
    }

    // Determine the input to send to the LLM. Could be raw message or processed input.
    // For now, assuming the raw message or a relevant part of it is passed.
    // Determine the input to send to the LLM. Could be raw message or processed input.
    // For now, assuming the raw message or a relevant part of it is passed.
    const inputForLLM = typeof message.input === 'string' ? message.input : JSON.stringify(message.input);

    // Format conversation history for the prompt
    const historyForLLM = message.conversationHistory
      ? message.conversationHistory.map(turn => `${turn.role}: ${turn.content}`).join('\n') + '\n'
      : '';

    // --- LLM Integration for User Preference Extraction ---
    try {
      // console.log('UserPreferenceAgent: Sending input to LLM for preference extraction.');
      // Formulate a prompt for the LLM to extract user preferences
      // TODO: Refine the prompt to guide the LLM on the expected output format (e.g., JSON)
      const llmPrompt = `Analyze the following user input for a wine recommendation request, considering the conversation history provided. Determine if it's a valid request and extract key information like ingredients or wine preferences. Provide the output in a JSON format with the following structure: { "isValid": boolean, "ingredients"?: string[], "preferences"?: { [key: string]: any }, "error"?: string }. If the input is invalid, set isValid to false and provide an error message.

${historyForLLM}User Input: "${inputForLLM}"`;

      const llmResponse = await this.communicationBus.sendLLMPrompt(llmPrompt);

      if (llmResponse) {
        // console.log('UserPreferenceAgent: Received LLM response for preferences.');
        // console.log('UserPreferenceAgent: LLM response content:', llmResponse); // Add this line to log the LLM response
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

        // console.log('UserPreferenceAgent: Extracted JSON string:', jsonString);

        // TODO: Implement more robust parsing and validation of the LLM's JSON response
        try {
          const preferenceOutput: LLMPreferenceOutput = JSON.parse(jsonString);

          // Basic validation of the parsed structure
          if (typeof preferenceOutput.preferences !== 'object' || preferenceOutput.preferences === null) {
             // console.error('UserPreferenceAgent: LLM response missing or invalid "preferences" field.');
             return { preferences: {}, error: 'Invalid structure in LLM preference response.' };
          }

          // console.log('UserPreferenceAgent: Extracted preferences from LLM.');
          return { preferences: preferenceOutput.preferences };

        } catch (parseError: any) { // Explicitly type error as any
          // console.error('UserPreferenceAgent: Error parsing or validating LLM response:', parseError);
          return { error: `Error processing LLM preference response: ${parseError.message || String(parseError)}` };
        }

      } else {
        // console.warn('UserPreferenceAgent: LLM did not return a preference response.');
        // Return empty preferences if LLM doesn't respond
        return { preferences: {} };
      }

    } catch (llmError) {
      // console.error('UserPreferenceAgent: Error during LLM preference extraction:', llmError);
      // Log LLM error and return empty preferences
      // TODO: Add to Dead Letter Queue if necessary
      return { error: 'Error communicating with LLM for preference extraction.' };
    }
    // --- End LLM Integration ---
  }
}

// TODO: Implement more sophisticated user preference processing logic (now using LLM)