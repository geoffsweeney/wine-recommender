import { InputValidationAgent } from '../InputValidationAgent';
import { RecommendationAgent } from '../RecommendationAgent';
import { LLMRecommendationAgent } from '../LLMRecommendationAgent';
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { ExplanationAgent } from '../ExplanationAgent';
import { MCPAdapterAgent } from '../MCPAdapterAgent';
import { FallbackAgent } from '../FallbackAgent';
import { AgentRegistry } from '../AgentRegistry';
import { createTestContainer } from '../../../test-setup'; // Import the testContainer factory
import { TYPES } from '../../../di/Types';
import { DependencyContainer } from 'tsyringe';

describe('Agent Capabilities', () => {
  let container: DependencyContainer;
  let resetMocks: () => void;

  beforeEach(() => {
    ({ container, resetMocks } = createTestContainer());
    // Register agent classes with the container
    container.register('InputValidationAgent', { useClass: InputValidationAgent });
    container.register('RecommendationAgent', { useClass: RecommendationAgent });
    container.register('LLMRecommendationAgent', { useClass: LLMRecommendationAgent });
    container.register('MCPAdapterAgent', { useClass: MCPAdapterAgent });
    container.register('ValueAnalysisAgent', { useClass: ValueAnalysisAgent });
    container.register('UserPreferenceAgent', { useClass: UserPreferenceAgent });
    container.register('ExplanationAgent', { useClass: ExplanationAgent });
    container.register('FallbackAgent', { useClass: FallbackAgent });
  });

  afterEach(() => {
    resetMocks();
  });

  it('should return correct capabilities for InputValidationAgent', () => {
    const agent = container.resolve(InputValidationAgent);
    expect(agent.getCapabilities()).toEqual([
      'input-validation',
      'llm-integration',
      'dead-letter-processing'
    ]);
  });

  it('should return correct capabilities for LLMRecommendationAgent', () => {
    const agent = container.resolve(LLMRecommendationAgent);
    expect(agent.getCapabilities()).toEqual([
      'llm-recommendation',
      'conversational-recommendation',
      'preference-analysis',
      'ingredient-matching',
      'confidence-scoring',
      'food-pairing',
      'budget-awareness',
      'style-matching'
    ]);
  });

  it('should return correct capabilities for MCPAdapterAgent', () => {
    const agent = container.resolve(MCPAdapterAgent);
    expect(agent.getCapabilities()).toEqual([
      'mcp-tool-integration',
      'external-service-adapter',
      'protocol-translation',
      'error-handling',
      'dead-letter-processing'
    ]);
  });

  it('should return correct capabilities for ValueAnalysisAgent', () => {
    const agent = container.resolve(ValueAnalysisAgent);
    expect(agent.getCapabilities()).toEqual([
      'value-analysis',
      'price-evaluation',
      'llm-integration',
      'wine-quality-assessment'
    ]);
  });

  it('should return correct capabilities for UserPreferenceAgent', () => {
    const agent = container.resolve(UserPreferenceAgent);
    expect(agent.getCapabilities()).toEqual([
      'preference-extraction',
      'preference-normalization',
      'preference-persistence',
      'fast-extraction',
      'async-llm-extraction',
      'preference-broadcasting'
    ]);
  });

  it('should return correct capabilities for ExplanationAgent', () => {
    const agent = container.resolve(ExplanationAgent);
    expect(agent.getCapabilities()).toEqual([
      'wine-explanation',
      'llm-generation',
      'context-aware-explanation',
      'error-handling'
    ]);
  });

  it('should return correct capabilities for FallbackAgent', () => {
    const agent = container.resolve(FallbackAgent);
    expect(agent.getCapabilities()).toEqual([
      'error-handling',
      'llm-fallback-generation',
      'dead-letter-processing',
      'graceful-degradation'
    ]);
  });

  describe('AgentRegistry Integration', () => {
    let agentRegistry: AgentRegistry;
    let mockBus: any;

    beforeEach(() => {
      mockBus = {
        registerAgent: jest.fn()
      };
      
      // Mock RecommendationAgent dependencies with the container
      container.register(TYPES.KnowledgeGraphService, {
        useValue: {
          getPreferences: jest.fn(),
          addOrUpdatePreference: jest.fn()
        }
      });
      
      container.register(TYPES.LLMService, {
        useValue: {
          generateResponse: jest.fn()
        }
      });
      
      // Register ShopperAgentConfig
      container.register(TYPES.ShopperAgentConfig, { useValue: {} });

      agentRegistry = container.resolve(AgentRegistry);
    });

    it('should register all agents with their capabilities', () => {
      agentRegistry.registerAgents(mockBus);
      
      expect(mockBus.registerAgent).toHaveBeenCalledWith('InputValidationAgent', { // Use getName()
        name: 'InputValidationAgent', // Use getName()
        capabilities: expect.arrayContaining([
          'input-validation',
          'llm-integration',
          'dead-letter-processing'
        ])
      });
      
      expect(mockBus.registerAgent).toHaveBeenCalledWith('llm-recommendation-agent', { // Use getName()
        name: 'llm-recommendation-agent', // Use getName()
        capabilities: expect.arrayContaining([
          'llm-recommendation',
          'conversational-recommendation',
          'preference-analysis',
          'ingredient-matching',
          'confidence-scoring',
          'food-pairing',
          'budget-awareness',
          'style-matching'
        ])
      });

      expect(mockBus.registerAgent).toHaveBeenCalledWith('RecommendationAgent', { // Use getName()
        name: 'RecommendationAgent', // Use getName()
        capabilities: expect.arrayContaining([
          'wine-recommendation',
          'ingredient-matching',
          'preference-matching',
          'llm-enhancement',
          'knowledge-graph-integration',
          'hybrid-recommendation',
          'contextual-recommendation'
        ])
      });
    });
  });
  });
