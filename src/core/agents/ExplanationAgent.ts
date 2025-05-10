import { Agent } from './Agent';

export class ExplanationAgent implements Agent {
  getName(): string {
    return 'ExplanationAgent';
  }

  async handleMessage(message: any): Promise<any> {
    console.log('ExplanationAgent received message:', message);
    // Minimal logic: Acknowledge receipt of recommendation result
    console.log('ExplanationAgent: Generating basic explanation (placeholder).');
    return { status: 'Explanation generated (basic)', receivedRecommendation: message };
  }
}

// TODO: Implement actual explanation generation logic