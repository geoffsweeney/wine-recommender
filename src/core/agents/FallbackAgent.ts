import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus

@injectable()
export class FallbackAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus // Inject AgentCommunicationBus
  ) {
    console.log('FallbackAgent constructor entered.');
  }

  getName(): string {
    return 'FallbackAgent';
  }

  async handleMessage(message: any): Promise<{ recommendation: string; error?: string }> {
    console.log('FallbackAgent received message:', message);

    if (!this.communicationBus) {
      console.error('FallbackAgent: AgentCommunicationBus not available.');
      return { recommendation: 'A fallback response is not available due to a communication issue.' };
    }

    // --- LLM Integration for Fallback Response Generation ---
    try {
      console.log('FallbackAgent: Sending failure context to LLM for fallback response.');
      // Formulate a prompt for the LLM based on the failure context
      // The 'message' here is expected to contain information about the failure,
      // potentially including the original user input or an error message.
      // TODO: Refine the prompt to provide relevant context to the LLM
      const llmPrompt = `A request for a wine recommendation failed with the following context: ${JSON.stringify(message, null, 2)}. Please generate a user-friendly fallback message that acknowledges the issue and provides a simple, helpful response.`;

      const llmResponse = await this.communicationBus.sendLLMPrompt(llmPrompt);

      if (llmResponse) {
        console.log('FallbackAgent: Received LLM response for fallback.');
        // TODO: Process and format the LLM response if needed
        return { recommendation: llmResponse };
      } else {
        console.warn('FallbackAgent: LLM did not return a fallback response.');
        // Return a generic fallback if LLM fails or returns nothing
        return { recommendation: 'Sorry, I encountered an issue and cannot provide a recommendation at this time. Please try again later.' };
      }

    } catch (llmError) {
      console.error('FallbackAgent: Error during LLM fallback generation:', llmError);
      // Log LLM error and return a generic fallback
      // TODO: Add to Dead Letter Queue if necessary
      return { recommendation: 'Sorry, I encountered an issue and cannot provide a recommendation at this time. Please try again later.' };
    }
    // --- End LLM Integration ---
  }
}

// TODO: Implement more sophisticated fallback logic (now using LLM)