import { EventEmitter } from 'events';

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

  constructor() {
    this.emitter = new EventEmitter();
    this.agents = new Map();
    this.subscriptions = new Map();
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
}