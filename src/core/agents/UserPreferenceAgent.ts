import { Agent } from './Agent';

export class UserPreferenceAgent implements Agent {
  getName(): string {
    return 'UserPreferenceAgent';
  }

  async handleMessage(message: any): Promise<any> {
    console.log('UserPreferenceAgent received message:', message);
    // Minimal logic: Acknowledge receipt of message
    console.log('UserPreferenceAgent: Processing user preferences (basic).');
    return { status: 'User preferences processed (basic)', receivedInput: message };
  }
}

// TODO: Implement actual user preference processing logic