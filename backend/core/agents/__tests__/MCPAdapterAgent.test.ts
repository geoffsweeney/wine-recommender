import { MCPAdapterAgent } from '../MCPAdapterAgent';

describe('MCPAdapterAgent', () => {
  let agent: MCPAdapterAgent;

  beforeEach(() => {
    agent = new MCPAdapterAgent();
  });

  it('should return the correct agent name', () => {
    expect(agent.getName()).toBe('MCPAdapterAgent');
  });

  it('should return a basic acknowledgment for a received message', async () => {
    const testMessage = { tool: 'some_tool', params: { id: '123' } };

    const result = await agent.handleMessage(testMessage);

    expect(result).toEqual({ status: 'MCP tool call simulated (basic)', receivedInput: testMessage });
  });

  it('should include conversation history in the acknowledgment', async () => {
    const userId = 'history-user-mcp';
    const conversationHistory = [
      { role: 'user', content: 'Call tool X.' },
      { role: 'assistant', content: 'Calling tool X.' },
    ];
    const testMessage = {
      userId: userId,
      tool: 'some_tool',
      params: { id: '456' },
      conversationHistory: conversationHistory,
    };

    const result = await agent.handleMessage(testMessage);

    expect(result).toEqual({ status: 'MCP tool call simulated (basic)', receivedInput: testMessage });
  });
});