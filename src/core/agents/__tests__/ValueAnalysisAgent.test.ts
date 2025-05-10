import { ValueAnalysisAgent } from '../ValueAnalysisAgent';

describe('ValueAnalysisAgent', () => {
  let agent: ValueAnalysisAgent;

  beforeEach(() => {
    agent = new ValueAnalysisAgent();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('ValueAnalysisAgent');
  });

  it('should log the received message and return a basic acknowledgment', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { data: 'some value data' };

    const result = await agent.handleMessage(testMessage);

    expect(consoleSpy).toHaveBeenCalledWith('ValueAnalysisAgent received message:', testMessage);
    expect(consoleSpy).toHaveBeenCalledWith('ValueAnalysisAgent: Performing basic value analysis (placeholder).');
    expect(result).toEqual({ status: 'Value analysis performed (basic)', receivedInput: testMessage });

    consoleSpy.mockRestore();
  });
});