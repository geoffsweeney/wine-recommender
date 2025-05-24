import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus'; // Import AgentCommunicationBus

@injectable()
export class ExplanationAgent implements Agent {
  constructor(
    @inject(AgentCommunicationBus) private readonly communicationBus: AgentCommunicationBus // Inject AgentCommunicationBus
  ) {
    console.log('ExplanationAgent constructor entered.');
  }

  getName(): string {
    return 'ExplanationAgent';
  }

  async handleMessage(recommendationResult: any): Promise<any> {
    // console.log('ExplanationAgent received recommendation result:', recommendationResult);

    if (!this.communicationBus) {
      // console.error('ExplanationAgent: AgentCommunicationBus not available.');
      return { status: 'Explanation generation failed', error: 'Communication bus not available' };
    }

    // Formulate a prompt for the LLM based on the recommendation result
    // TODO: Refine the prompt based on the structure of recommendationResult
    const prompt = `Provide a concise explanation for the following wine recommendation:\n\n${JSON.stringify(recommendationResult, null, 2)}`;

    try {
      // console.log('ExplanationAgent: Sending prompt to LLM for explanation.');
      const llmExplanation = await this.communicationBus.sendLLMPrompt(prompt);

      if (llmExplanation) {
        // console.log('ExplanationAgent: Received explanation from LLM.');
        // TODO: Process and format the LLM explanation if needed
        return { status: 'Explanation generated', explanation: llmExplanation, receivedRecommendation: recommendationResult };
      } else {
        // console.warn('ExplanationAgent: LLM did not return an explanation.');
        return { status: 'Explanation generation failed', error: 'LLM did not return an explanation', receivedRecommendation: recommendationResult };
      }

    } catch (error) {
      // console.error('ExplanationAgent: Error sending prompt to LLM:', error);
      return { status: 'Explanation generation failed', error: 'Error communicating with LLM', receivedRecommendation: recommendationResult };
    }
  }
}

// TODO: Implement more sophisticated explanation generation logic, potentially using context from SharedContextMemory