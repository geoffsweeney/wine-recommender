import { Agent } from './Agent';

export class FallbackAgent implements Agent {
  getName(): string {
    return 'FallbackAgent';
  }

  async handleMessage(message: any): Promise<any> {
    // Basic placeholder logic for POC
    console.log('FallbackAgent received message:', message);
    // In a real implementation, this would handle fallback scenarios
    return { response: 'Placeholder fallback response' };
  }
}

// TODO: Implement actual fallback logic