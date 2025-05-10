import { MCPAdapterAgent } from '../MCPAdapterAgent';

describe('MCPAdapterAgent', () => {
  let agent: MCPAdapterAgent;

  beforeEach(() => {
    agent = new MCPAdapterAgent();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('MCPAdapterAgent');
  });

  it('should log the received message and return a basic acknowledgment', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const testMessage = { tool: 'some_tool', params: { id: '123' } };

    const result = await agent.handleMessage(testMessage);

    expect(consoleSpy).toHaveBeenCalledWith('MCPAdapterAgent received message:', testMessage);
    expect(consoleSpy).toHaveBeenCalledWith('MCPAdapterAgent: Simulating MCP tool call with message:', testMessage);
    expect(result).toEqual({ status: 'MCP tool call simulated (basic)', receivedInput: testMessage });

    consoleSpy.mockRestore();
  });
});