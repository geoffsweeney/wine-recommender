import { Agent } from './Agent';

export class FallbackAgent implements Agent {
  getName(): string {
    return 'FallbackAgent';
  }

  async handleMessage(message: any): Promise<any> {
    // Basic placeholder logic for POC
    console.log('FallbackAgent received message:', message);

    if (!message.preferences || !message.preferences.wineType) {
      console.error('FallbackAgent received message without preferences or wineType:', message);
      return { recommendation: 'Default mock recommendation.', wineType: 'Unknown' };
    }

    // In a real implementation, this would handle fallback scenarios
    return { recommendation: 'Default mock recommendation.', wineType: message.preferences.wineType };
  }
}

// TODO: Implement actual fallback logic