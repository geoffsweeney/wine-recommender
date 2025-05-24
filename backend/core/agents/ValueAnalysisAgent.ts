import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent'; // Assuming a base Agent class will be created
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus

@injectable()
export class ValueAnalysisAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus // Inject AgentCommunicationBus
  ) {
    console.log('ValueAnalysisAgent constructor entered.');
  }

  getName(): string {
    return 'ValueAnalysisAgent';
  }

  async handleMessage(message: any): Promise<{ analysis?: string; error?: string }> {
    console.log('ValueAnalysisAgent received message:', message);

    if (!this.communicationBus) {
      console.error('ValueAnalysisAgent: AgentCommunicationBus not available.');
      return { error: 'Communication bus not available' };
    }

    // --- LLM Integration for Value Analysis ---
    try {
      console.log('ValueAnalysisAgent: Sending wine data to LLM for value analysis.');
      // Formulate a prompt for the LLM based on the wine data
      // The 'message' is expected to contain wine data (e.g., a WineNode object)
      // TODO: Refine the prompt to guide the LLM on the desired analysis
      const llmPrompt = `Analyze the following wine data and provide a brief value analysis or interesting facts:\n\n${JSON.stringify(message, null, 2)}`;

      const llmResponse = await this.communicationBus.sendLLMPrompt(llmPrompt);

      if (llmResponse) {
        console.log('ValueAnalysisAgent: Received LLM response for analysis.');
        // TODO: Process and format the LLM response if needed
        return { analysis: llmResponse };
      } else {
        console.warn('ValueAnalysisAgent: LLM did not return an analysis.');
        // Return with no analysis if LLM fails or returns nothing
        return { analysis: 'Basic analysis not available.' };
      }

    } catch (llmError) {
      console.error('ValueAnalysisAgent: Error during LLM value analysis:', llmError);
      // Log LLM error and return with no analysis
      // TODO: Add to Dead Letter Queue if necessary
      return { error: 'Error communicating with LLM for analysis.' };
    }
    // --- End LLM Integration ---
  }
}

// TODO: Define a base Agent interface or class (Agent.ts already exists)
// TODO: Implement more sophisticated value analysis logic (now using LLM)