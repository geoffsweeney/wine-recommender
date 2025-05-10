import { ExplanationAgent } from '../ExplanationAgent';

describe('ExplanationAgent', () => {
  let agent: ExplanationAgent;

  beforeEach(() => {
    agent = new ExplanationAgent();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('ExplanationAgent');
  });

  it('should log the received message and return a basic acknowledgment', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { recommendation: 'Recommended Wine: Sample Red' };

    const result = await agent.handleMessage(testMessage);

    expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent received message:', testMessage);
    expect(consoleSpy).toHaveBeenCalledWith('ExplanationAgent: Generating basic explanation (placeholder).');
    expect(result).toEqual({ status: 'Explanation generated (basic)', receivedRecommendation: testMessage });

    consoleSpy.mockRestore();
  });
});