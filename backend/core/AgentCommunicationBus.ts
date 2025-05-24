import { injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { SharedContextMemory, type ContextEntry, type ContextMetadata } from './SharedContextMemory';
import { LLMService } from '../services/LLMService';

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

@injectable()
export class AgentCommunicationBus {
  private emitter: EventEmitter;
  private agents: Map<string, AgentInfo>;
  private subscriptions: Map<string, Set<string>>;
  private contextMemory: SharedContextMemory;
  private llmService?: LLMService; // Optional LLM Service

  constructor(llmService?: LLMService) {
console.log('AgentCommunicationBus constructor entered.');
    this.emitter = new EventEmitter();
    this.agents = new Map();
    this.subscriptions = new Map();
    this.contextMemory = new SharedContextMemory();
    this.llmService = llmService;
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
    console.log(`AgentCommunicationBus: Publishing message to event "${eventName}"`, message); // Add logging
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

  /**
   * Sends a prompt to the configured LLM service.
   * @param prompt The prompt to send to the LLM.
   * @returns A promise that resolves with the LLM's response, or undefined if no LLM service is configured.
   */
  async sendLLMPrompt(prompt: string): Promise<string | undefined> {
    if (!this.llmService) {
      console.warn('LLMService is not configured in AgentCommunicationBus.');
      return undefined;
    }
    return this.llmService.sendPrompt(prompt);
  }

  /**
   * Sends a message to a specific agent.
   * @param recipientAgentId The ID of the recipient agent.
   * @param payload The message payload.
   */
  sendMessage<T>(recipientAgentId: string, payload: T): void {
    console.log(`AgentCommunicationBus: Sending message to ${recipientAgentId} with payload:`, payload);
    // In a real implementation, this would involve routing the message
    // to the appropriate agent instance. For now, we'll just emit an event.
    this.emitter.emit(`agentMessage:${recipientAgentId}`, payload);
  }
}
