import { UserPreferenceAgent } from '../UserPreferenceAgent';

describe('UserPreferenceAgent', () => {
  let agent: UserPreferenceAgent;

  beforeEach(() => {
    agent = new UserPreferenceAgent();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('UserPreferenceAgent');
  });

  it('should log the received message and return a basic acknowledgment', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { preferences: { wineType: 'red' } };

    const result = await agent.handleMessage(testMessage);

    expect(consoleSpy).toHaveBeenCalledWith('UserPreferenceAgent received message:', testMessage);
    expect(consoleSpy).toHaveBeenCalledWith('UserPreferenceAgent: Processing user preferences (basic).');
    expect(result).toEqual({ status: 'User preferences processed (basic)', receivedInput: testMessage });

    consoleSpy.mockRestore();
  });
});