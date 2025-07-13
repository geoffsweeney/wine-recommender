import { inject, injectable } from 'tsyringe';
import { Agent } from './Agent';
import { AgentCommunicationBus } from '../AgentCommunicationBus';
import { EnhancedAgentCommunicationBus } from '../agents/communication/EnhancedAgentCommunicationBus';
import { InputValidationAgent } from './InputValidationAgent';
import { RecommendationAgent } from './RecommendationAgent';
import { LLMRecommendationAgent } from './LLMRecommendationAgent';
import { ValueAnalysisAgent } from './ValueAnalysisAgent';
import { UserPreferenceAgent } from './UserPreferenceAgent';
import { ExplanationAgent } from './ExplanationAgent';
import { MCPAdapterAgent } from './MCPAdapterAgent';
import { FallbackAgent } from './FallbackAgent';
import { SommelierCoordinator } from './SommelierCoordinator';
import { ShopperAgent } from './ShopperAgent'; // Import ShopperAgent
import { AdminConversationalAgent } from './AdminConversationalAgent'; // Import AdminConversationalAgent

export interface IAgentRegistry {
  registerAgents(bus: AgentCommunicationBus): void;
  getAgent<T extends Agent>(name: string): T;
}

@injectable()
export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, Agent> = new Map();

  constructor(
    @inject(InputValidationAgent) private readonly inputValidationAgent: InputValidationAgent,
    @inject(RecommendationAgent) private readonly recommendationAgent: RecommendationAgent,
    @inject(LLMRecommendationAgent) private readonly llmRecommendationAgent: LLMRecommendationAgent,
    @inject(ValueAnalysisAgent) private readonly valueAnalysisAgent: ValueAnalysisAgent,
    @inject(UserPreferenceAgent) private readonly userPreferenceAgent: UserPreferenceAgent,
    @inject(ExplanationAgent) private readonly explanationAgent: ExplanationAgent,
    @inject(MCPAdapterAgent) private readonly mcpAdapterAgent: MCPAdapterAgent,
    @inject(FallbackAgent) private readonly fallbackAgent: FallbackAgent,
@inject(SommelierCoordinator) private readonly sommelierCoordinator: SommelierCoordinator,
    @inject(ShopperAgent) private readonly shopperAgent: ShopperAgent, // Inject ShopperAgent
    @inject(AdminConversationalAgent) private readonly adminConversationalAgent: AdminConversationalAgent // Inject AdminConversationalAgent
  ) {
    this.agents.set(inputValidationAgent.getName(), inputValidationAgent);
    this.agents.set(recommendationAgent.getName(), recommendationAgent);
    this.agents.set(llmRecommendationAgent.getName(), llmRecommendationAgent);
    this.agents.set(valueAnalysisAgent.getName(), valueAnalysisAgent);
    this.agents.set(userPreferenceAgent.getName(), userPreferenceAgent);
    this.agents.set(explanationAgent.getName(), explanationAgent);
    this.agents.set(mcpAdapterAgent.getName(), mcpAdapterAgent);
    this.agents.set(fallbackAgent.getName(), fallbackAgent);
    this.agents.set(sommelierCoordinator.getName(), sommelierCoordinator);
    this.agents.set(shopperAgent.getName(), shopperAgent); // Register ShopperAgent
    this.agents.set(adminConversationalAgent.getName(), adminConversationalAgent); // Register AdminConversationalAgent
  }

  getAgent<T extends Agent>(name: string): T {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent ${name} not registered`);
    return agent as T;
  }

  registerAgents(bus: AgentCommunicationBus): void {
    for (const [name, agent] of this.agents) {
      bus.registerAgent(name, {
        name: agent.getName(),
        capabilities: agent.getCapabilities()
      });
    }
  }
}
