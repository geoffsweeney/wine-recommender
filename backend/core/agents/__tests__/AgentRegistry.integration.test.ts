import { AgentRegistry } from '../AgentRegistry';
import { Agent } from '../Agent';
import { AgentCommunicationBus } from '../../AgentCommunicationBus';
import { EnhancedAgentCommunicationBus } from '../communication/EnhancedAgentCommunicationBus'; // Import EnhancedAgentCommunicationBus
import { InputValidationAgent } from '../InputValidationAgent';
import { RecommendationAgent } from '../RecommendationAgent';
import { LLMRecommendationAgent } from '../LLMRecommendationAgent';
import { ValueAnalysisAgent } from '../ValueAnalysisAgent';
import { UserPreferenceAgent } from '../UserPreferenceAgent';
import { ExplanationAgent } from '../ExplanationAgent';
import { MCPAdapterAgent } from '../MCPAdapterAgent';
import { FallbackAgent } from '../FallbackAgent';
import { testContainer } from '../../../test-setup'; // Import the testContainer
import { mock } from 'jest-mock-extended';

beforeEach(() => {
  // Register agent classes with the testContainer
  testContainer.register('InputValidationAgent', { useClass: InputValidationAgent });
  testContainer.register('LLMRecommendationAgent', { useClass: LLMRecommendationAgent });
  testContainer.register('MCPAdapterAgent', { useClass: MCPAdapterAgent });
  testContainer.register('ValueAnalysisAgent', { useClass: ValueAnalysisAgent });
});

describe('AgentRegistry Integration', () => {
  let registry: AgentRegistry;
  let mockBus: jest.Mocked<EnhancedAgentCommunicationBus>;

  beforeEach(() => {
    mockBus = mock<EnhancedAgentCommunicationBus>(); // Use jest-mock-extended to create a comprehensive mock

    registry = testContainer.resolve(AgentRegistry);
  });

  it('should register all agents with their capabilities', () => {
    registry.registerAgents(mockBus);

    expect(mockBus.registerAgent).toHaveBeenCalledTimes(9);
    
    // Verify capability registration for key agents
    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'InputValidationAgent',
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'input-validation',
          'llm-integration'
        ])
      })
    );

    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'LLMRecommendationAgent', 
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'llm-recommendation',
          'conversational-recommendation'
        ])
      })
    );

    expect(mockBus.registerAgent).toHaveBeenCalledWith(
      'MCPAdapterAgent',
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          'mcp-tool-integration',
          'external-service-adapter'
        ])
      })
    );
  });

  it('should retrieve agents by name with correct capabilities', () => {
    const agent = registry.getAgent<InputValidationAgent>('InputValidationAgent');
    expect(agent.getCapabilities()).toEqual(
      expect.arrayContaining(['input-validation', 'llm-integration'])
    );
  });
});