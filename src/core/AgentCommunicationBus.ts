import { EventEmitter } from 'events';
import { SharedContextMemory, type ContextEntry, type ContextMetadata } from './SharedContextMemory';

interface AgentInfo {
  id: string;
  name: string;
  capabilities: string[];
  lastSeen: Date;
}

export type MessagePriority = 'HIGH' | 'NORMAL';

export interface AgentMessage<T = unknown> {
  metadata: {
    traceId: string;
    priority: MessagePriority;
    timestamp: number;
    sender: string;
  };
  payload: T;
  type: string;
}

export class AgentCommunicationBus {
  private emitter: EventEmitter;
  private agents: Map<string, AgentInfo>;
  private subscriptions: Map<string, Set<string>>;
  private contextMemory: SharedContextMemory;

  constructor() {
    this.emitter = new EventEmitter();
    this.agents = new Map();
    this.subscriptions = new Map();
    this.contextMemory = new SharedContextMemory();
  }

  registerAgent(agentId: string, info: Omit<AgentInfo, 'id' | 'lastSeen'>): void {
    this.agents.set(agentId, {
      ...info,
      id: agentId,
      lastSeen: new Date()
    });
  }

  publish<T>(message: AgentMessage<T>, topic?: string): void {
    const eventName = topic ? `message:${topic}` : 'message';
    this.emitter.emit(eventName, message);
  }

  subscribe(agentId: string, callback: (message: AgentMessage) => void, topic?: string): void {
    const eventName = topic ? `message:${topic}` : 'message';
    this.emitter.on(eventName, callback);
    this.updateSubscriptions(agentId, eventName);
  }

  unsubscribe(agentId: string, callback: (message: AgentMessage) => void, topic?: string): void {
    const eventName = topic ? `message:${topic}` : 'message';
    this.emitter.off(eventName, callback);
    this.updateSubscriptions(agentId, eventName, true);
  }

  private updateSubscriptions(agentId: string, eventName: string, remove = false): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set());
    }
    const agentSubs = this.subscriptions.get(agentId)!;

    if (remove) {
      agentSubs.delete(eventName);
    } else {
      agentSubs.add(eventName);
    }
  }

  getSubscriptions(agentId: string): string[] {
    return Array.from(this.subscriptions.get(agentId) || []);
  }

  getAgentInfo(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  // Context Memory Integration
  setContext(agentId: string, key: string, value: unknown, metadata?: ContextMetadata): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.contextMemory.setContext(agent, key, value, metadata);
    }
  }

  getContext(agentId: string, key: string): unknown {
    const agent = this.agents.get(agentId);
    return agent ? this.contextMemory.getContext(agent, key)?.value : undefined;
  }

  getContextWithMetadata(agentId: string, key: string): ContextEntry | undefined {
    const agent = this.agents.get(agentId);
    return agent ? this.contextMemory.getContext(agent, key) : undefined;
  }

  shareContext(sourceAgentId: string, targetAgentId: string, key: string): void {
    const context = this.getContextWithMetadata(sourceAgentId, key);
    if (context) {
      this.setContext(targetAgentId, key, context.value, { ...context.metadata });
    }
  }

  broadcastContext(agentId: string, key: string): void {
    const context = this.getContextWithMetadata(agentId, key);
    if (context) {
      this.listAgents()
        .filter(agent => agent.id !== agentId)
        .forEach(agent => {
          this.setContext(agent.id, key, context.value, { ...context.metadata });
        });
    }
  }
}