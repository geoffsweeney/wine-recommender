import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus
import { DeadLetterProcessor } from '../DeadLetterProcessor'; // Import DeadLetterProcessor
import { ConversationTurn } from '../ConversationHistoryService'; // Import ConversationTurn interface

// Define a type for the expected structured output from the LLM
interface LLMValidationOutput {
  isValid: boolean;
  ingredients?: string[];
  preferences?: { [key: string]: any }; // Flexible for various preferences
  error?: string;
}

@injectable()
export class InputValidationAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus, // Inject AgentCommunicationBus
    @inject('DeadLetterProcessor') private readonly deadLetterProcessor: DeadLetterProcessor // Inject DeadLetterProcessor
  ) {
    console.log('InputValidationAgent constructor entered.');
  }

  getName(): string {
    return 'InputValidationAgent';
  }

  async handleMessage(message: { input: string; conversationHistory?: ConversationTurn[] }): Promise<{ isValid: boolean; processedInput?: { ingredients?: string[], preferences?: { [key: string]: any } }; error?: string }> {
    console.log('InputValidationAgent received message:', message);

    if (!this.communicationBus) {
      console.error('InputValidationAgent: AgentCommunicationBus not available.');
      return { isValid: false, error: 'Communication bus not available' };
    }

    // Validate that the input property is a non-empty string
    if (typeof message.input !== 'string' || message.input.trim() === '') {
      return { isValid: false, error: 'Invalid input: message input must be a non-empty string.' };
    }

    // --- LLM Integration for Input Validation and Extraction ---
    try {
      console.log('InputValidationAgent: Sending input to LLM for validation and extraction.');
      // Formulate a prompt for the LLM to validate and extract structured data
      let llmPrompt = `Analyze the following user input for a wine recommendation request. Determine if it's a valid request and extract key information like ingredients or wine preferences. Provide the output strictly in JSON format with the following structure:
{
"isValid": boolean, // true if the input is valid and contains recognizable ingredients or preferences, false otherwise.
"ingredients"?: string[], // An array of extracted ingredients if applicable.
"preferences"?: { [key: string]: any }, // An object containing extracted wine preferences if applicable.
"error"?: string // A descriptive error message if isValid is false.
}

If the input is invalid, set "isValid" to false and provide a clear "error" message. Do not include any other text in the response.

Examples:
User Input: "I need a red wine for pasta with tomato sauce"
Output: { "isValid": true, "preferences": { "foodPairing": "pasta with tomato sauce", "wineType": "red" } }

User Input: "What's a good sweet white wine under $20?"
Output: { "isValid": true, "preferences": { "sweetness": "sweet", "wineType": "white", "priceRange": [null, 20] } }

User Input: "Tell me about cars"
Output: { "isValid": false, "error": "Input is not related to wine." }

`;

      // Include conversation history if available
      if (message.conversationHistory && message.conversationHistory.length > 0) {
        llmPrompt += "Conversation History:\n";
        message.conversationHistory.forEach(turn => {
          llmPrompt += `${turn.role}: ${turn.content}\n`;
        });
        llmPrompt += "\n"; // Add a newline for separation
      }

      llmPrompt += `User Input: "${message.input}"`; // Use message.input

      console.log('InputValidationAgent: Calling communicationBus.sendLLMPrompt');
      const llmResponse = await this.communicationBus.sendLLMPrompt(llmPrompt);
      console.log('InputValidationAgent: Returned from communicationBus.sendLLMPrompt');

      if (llmResponse) {
        console.log('InputValidationAgent: Received LLM response for validation.');
        console.log('InputValidationAgent: Raw LLM response:', llmResponse); // Added logging
        try {
          const validationOutput: LLMValidationOutput = JSON.parse(llmResponse);
          console.log('InputValidationAgent: Parsed validation output:', validationOutput); // Added logging



          // Robust validation of the parsed structure
          if (typeof validationOutput.isValid !== 'boolean') {
            console.error('InputValidationAgent: LLM response missing or invalid "isValid" field.');
            return { isValid: false, error: 'Invalid structure in LLM validation response: missing or invalid "isValid".' };
          }

          if (validationOutput.ingredients !== undefined && (validationOutput.ingredients === null || !Array.isArray(validationOutput.ingredients))) {
            console.error('InputValidationAgent: LLM response "ingredients" field is not an array.');
            return { isValid: false, error: 'Invalid structure in LLM validation response: "ingredients" is not an array.' };
          }

          if (
            validationOutput.preferences !== undefined &&
            (validationOutput.preferences === null ||
              typeof validationOutput.preferences !== 'object' ||
              Array.isArray(validationOutput.preferences))
          ) {
            console.error('InputValidationAgent: LLM response "preferences" field is not an object.');
            return { isValid: false, error: 'Invalid structure in LLM validation response: "preferences" is not an object.' };
          }

          if (validationOutput.isValid === false && validationOutput.error !== undefined && typeof validationOutput.error !== 'string') {
            console.error('InputValidationAgent: LLM response "error" field is not a string.');
            return { isValid: false, error: 'Invalid structure in LLM validation response: "error" is not a string.' };
          }

          if (validationOutput.isValid) {
            console.log('InputValidationAgent: LLM validated input as valid.');
            return {
              isValid: true,
              processedInput: {
                ingredients: validationOutput.ingredients,
                preferences: validationOutput.preferences
              }
            };
          } else {
            console.log('InputValidationAgent: LLM validated input as invalid.');
            return { isValid: false, error: validationOutput.error || 'Invalid input according to LLM.' };
          }

        } catch (parseError: any) {
          console.error('InputValidationAgent: Error parsing or validating LLM response:', parseError);
          return { isValid: false, error: `Error processing LLM validation response: ${parseError.message || String(parseError)}` };
        }

      } else {
        console.warn('InputValidationAgent: LLM did not return a validation response.');
        return { isValid: false, error: 'LLM failed to provide validation response.' };
      }

    } catch (llmError: any) { // Explicitly type error as any
      console.error('InputValidationAgent: Error during LLM validation:', llmError);
      // Log LLM error and return invalid
      // Add to Dead Letter Queue
      await this.deadLetterProcessor.process(message, llmError instanceof Error ? llmError : new Error(llmError), { source: this.getName(), stage: 'LLMValidation' });
      return { isValid: false, error: 'Error communicating with LLM for validation.' };
    }
   // --- End LLM Integration ---
 }
}

// TODO: Implement more sophisticated input validation logic (now using LLM)