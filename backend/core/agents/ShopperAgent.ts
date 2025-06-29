import { inject, injectable } from 'tsyringe';
import { CommunicatingAgent, CommunicatingAgentDependencies } from './CommunicatingAgent';
import { EnhancedAgentCommunicationBus } from './communication/EnhancedAgentCommunicationBus';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';
import { DeadLetterProcessor } from '../DeadLetterProcessor';
import { TYPES } from '../../di/Types';
import winston from 'winston';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService'; // Import KnowledgeGraphService
import { UserPreferences } from '../../types'; // Import UserPreferences

// Define the configuration interface for ShopperAgent
export interface ShopperAgentConfig {
  // Add any specific configuration properties here
}

@injectable()
export class ShopperAgent extends CommunicatingAgent {
  constructor(
    @inject(EnhancedAgentCommunicationBus) private readonly injectedCommunicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.DeadLetterProcessor) private readonly deadLetterProcessor: DeadLetterProcessor,
    @inject(TYPES.Logger) protected readonly logger: winston.Logger,
    @inject(TYPES.ShopperAgentConfig) private readonly agentConfig: ShopperAgentConfig, // Inject the specific agent config
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService // Inject KnowledgeGraphService
  ) {
    const id = 'shopper-agent';
    const dependencies: CommunicatingAgentDependencies = {
      communicationBus: injectedCommunicationBus,
      logger: logger,
      messageQueue: {} as any, // Placeholder for IMessageQueue
      stateManager: {} as any, // Placeholder for IStateManager
      config: agentConfig as any // Use the injected config
    };
    super(id, agentConfig, dependencies);
    this.registerHandlers();
    this.logger.info(`[${this.id}] ShopperAgent initialized`, { agentId: this.id, operation: 'initialization' });
  }

  public getName(): string {
    return 'ShopperAgent';
  }

  getCapabilities(): string[] {
    return ['wine-search', 'availability-check'];
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    switch (message.type) {
      case MessageTypes.FIND_WINES:
        return this.handleFindWinesRequest(message as AgentMessage<any>);
      case MessageTypes.EXPANDED_SEARCH:
        return this.handleExpandedSearchRequest(message as AgentMessage<any>);
      default:
        this.logger.warn(`[${correlationId}] ShopperAgent received unhandled message type: ${message.type}`, {
          agentId: this.id,
          operation: 'handleMessage',
          correlationId: correlationId,
          messageType: message.type
        });
        return {
          success: false,
          error: new AgentError(
            `Unhandled message type: ${message.type}`,
            'UNHANDLED_MESSAGE_TYPE',
            this.id,
            correlationId,
            false,
            { messageType: message.type }
          )
        };
    }
  }

  protected registerHandlers(): void {
    super.registerHandlers();
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.FIND_WINES,
      this.handleFindWinesRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
    this.communicationBus.registerMessageHandler(
      this.id,
      MessageTypes.EXPANDED_SEARCH,
      this.handleExpandedSearchRequest.bind(this) as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>
    );
  }

  private async handleFindWinesRequest(message: AgentMessage<any>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] ShopperAgent.handleFindWinesRequest entered`, { agentId: this.id, operation: 'handleFindWinesRequest' });

    try {
      const { wine, budget, priority, maxResults } = message.payload;
      this.logger.debug(`[${correlationId}] ShopperAgent searching for wine: ${wine} with budget: ${budget}`, { agentId: this.id, operation: 'handleFindWinesRequest' });
      
      // Call KnowledgeGraphService to find wines by name
      const foundWines = await this.knowledgeGraphService.findWinesByName([wine]);
      
      const availableOptions = foundWines.slice(0, maxResults || 1); // Limit results
      this.logger.debug(`[${correlationId}] ShopperAgent found wines: ${JSON.stringify(availableOptions)}`, { agentId: this.id, operation: 'handleFindWinesRequest' });

      const responseMessage = createAgentMessage(
        'find-wines-response',
        { availableOptions: availableOptions },
        this.id,
        message.conversationId,
        correlationId,
        message.sourceAgent,
        message.userId
      );
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = new AgentError(
        `Error handling find wines request: ${errorMessage}`,
        'FIND_WINES_ERROR',
        this.id,
        correlationId,
        true,
        { originalError: errorMessage }
      );
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'FindWines', correlationId });
      return { success: false, error: agentError };
    }
  }

  private async handleExpandedSearchRequest(message: AgentMessage<any>): Promise<Result<AgentMessage | null, AgentError>> {
    const correlationId = message.correlationId;
    this.logger.info(`[${correlationId}] ShopperAgent.handleExpandedSearchRequest entered`, { agentId: this.id, operation: 'handleExpandedSearchRequest' });

    try {
      const { originalCriteria, budget, alternativeVarietals } = message.payload;
      this.logger.debug(`[${correlationId}] ShopperAgent performing expanded search with criteria: ${JSON.stringify(originalCriteria)}`, { agentId: this.id, operation: 'handleExpandedSearchRequest' });

      let expandedWines: any[] = [];
      if (originalCriteria && originalCriteria.recommendedWines && originalCriteria.recommendedWines.length > 0) {
        const wineNames = originalCriteria.recommendedWines.map((w: any) => w.name);
        // Expand search by looking for wines by name
        expandedWines = await this.knowledgeGraphService.findWinesByName(wineNames);
      } else if (originalCriteria && originalCriteria.preferences) {
        // If original criteria had preferences, try expanding on those
        expandedWines = await this.knowledgeGraphService.findWinesByPreferences(originalCriteria.preferences);
      }
      
      const wines = expandedWines.slice(0, 5); // Limit expanded results
      this.logger.debug(`[${correlationId}] ShopperAgent found expanded wines: ${JSON.stringify(wines)}`, { agentId: this.id, operation: 'handleExpandedSearchRequest' });

      const responseMessage = createAgentMessage(
        'expanded-search-response',
        { wines: wines },
        this.id,
        message.conversationId,
        correlationId,
        message.sourceAgent,
        message.userId
      );
      return { success: true, data: responseMessage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = new AgentError(
        `Error handling expanded search request: ${errorMessage}`,
        'EXPANDED_SEARCH_ERROR',
        this.id,
        correlationId,
        true,
        { originalError: errorMessage }
      );
      await this.deadLetterProcessor.process(message.payload, agentError, { source: this.id, stage: 'ExpandedSearch', correlationId });
      return { success: false, error: agentError };
    }
  }
}