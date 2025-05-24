import { AgentCommunicationBus, type AgentMessage } from '../AgentCommunicationBus';

describe('AgentCommunicationBus', () => {
  let bus: AgentCommunicationBus;

  beforeEach(() => {
    bus = new AgentCommunicationBus();
  });

  test('should register agents', () => {
    bus.registerAgent('agent1', {
      name: 'Test Agent',
      capabilities: ['test']
    });

    const agent = bus.getAgentInfo('agent1');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Test Agent');
  });

  test('should publish and receive messages', () => {
    const mockCallback = jest.fn();
    bus.subscribe('agent1', mockCallback);

    const testMessage: AgentMessage<{test: string}> = {
      metadata: {
        traceId: '123',
        priority: 'NORMAL' as const,
        timestamp: Date.now(),
        sender: 'agent2'
      },
      payload: { test: 'data' },
      type: 'TEST_MESSAGE'
    };

    bus.publish(testMessage);
    expect(mockCallback).toHaveBeenCalledWith(testMessage);
  });

  test('should allow unsubscribing', () => {
    const mockCallback = jest.fn();
    bus.subscribe('agent1', mockCallback);
    bus.unsubscribe('agent1', mockCallback);

    bus.publish({
      metadata: {
        traceId: '123',
        priority: 'NORMAL',
        timestamp: Date.now(),
        sender: 'agent2'
      },
      payload: {},
      type: 'TEST_MESSAGE'
    });

    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('should list all registered agents', () => {
    bus.registerAgent('agent1', { name: 'Agent 1', capabilities: [] });
    bus.registerAgent('agent2', { name: 'Agent 2', capabilities: [] });

    const agents = bus.listAgents();
    expect(agents.length).toBe(2);
    expect(agents.map(a => a.name)).toEqual(['Agent 1', 'Agent 2']);
  });

  test('should handle topic-based subscriptions', () => {
    const topicCallback = jest.fn();
    const globalCallback = jest.fn();
    
    bus.subscribe('agent1', globalCallback);
    bus.subscribe('agent1', topicCallback, 'wine');

    bus.publish({
      metadata: {
        traceId: '123',
        priority: 'NORMAL' as const,
        timestamp: Date.now(),
        sender: 'agent2'
      },
      payload: { test: 'data' },
      type: 'TEST_MESSAGE'
    }, 'wine');

    expect(globalCallback).not.toHaveBeenCalled();
    expect(topicCallback).toHaveBeenCalled();
  });

  test('should track subscriptions', () => {
    bus.subscribe('agent1', jest.fn(), 'wine');
    bus.subscribe('agent1', jest.fn(), 'user');

    const subs = bus.getSubscriptions('agent1');
    expect(subs).toEqual(expect.arrayContaining(['message:wine', 'message:user']));
  });

  // Context Memory Tests
  test('should set and get context', () => {
    bus.registerAgent('agent1', { name: 'Agent 1', capabilities: [] });
    bus.setContext('agent1', 'prefs', { darkMode: true });
    
    const context = bus.getContext('agent1', 'prefs');
    expect(context).toEqual({ darkMode: true });
  });

  test('should get context with metadata', () => {
    bus.registerAgent('agent1', { name: 'Agent 1', capabilities: [] });
    bus.setContext('agent1', 'data', 'test', { source: 'api' });
    
    const context = bus.getContextWithMetadata('agent1', 'data');
    expect(context?.value).toBe('test');
    expect(context?.metadata.source).toBe('api');
  });

  test('should share context between agents', () => {
    bus.registerAgent('agent1', { name: 'Agent 1', capabilities: [] });
    bus.registerAgent('agent2', { name: 'Agent 2', capabilities: [] });
    bus.setContext('agent1', 'shared', { value: 42 });
    bus.shareContext('agent1', 'agent2', 'shared');
    
    expect(bus.getContext('agent2', 'shared')).toEqual({ value: 42 });
  });

  test('should broadcast context to all agents', () => {
    bus.registerAgent('agent1', { name: 'Agent 1', capabilities: [] });
    bus.registerAgent('agent2', { name: 'Agent 2', capabilities: [] });
    bus.registerAgent('agent3', { name: 'Agent 3', capabilities: [] });
    
    bus.setContext('agent1', 'broadcast', 'important');
    bus.broadcastContext('agent1', 'broadcast');
    
    expect(bus.getContext('agent2', 'broadcast')).toBe('important');
    expect(bus.getContext('agent3', 'broadcast')).toBe('important');
  });
});