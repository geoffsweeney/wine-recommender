import { v4 as uuidv4 } from 'uuid';

export interface AgentMessage<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly sourceAgent: string;
  readonly targetAgent?: string;
  readonly userId?: string;
  readonly conversationId: string; // Added conversationId
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH';
  readonly metadata?: {
    sender?: string;
    [key: string]: unknown;
  };
}

export const MessageTypes = {
  VALIDATE_INPUT: 'validate_input',
  GET_PREFERENCES: 'get_preferences',
  GENERATE_RECOMMENDATIONS: 'generate_recommendations',
  REFINE_RECOMMENDATIONS: 'refine_recommendations',
  FIND_WINES: 'find_wines',
  FALLBACK_REQUEST: 'fallback_request',
  EMERGENCY_RECOMMENDATIONS: 'emergency_recommendations',
  EXPANDED_SEARCH: 'expanded_search',
  FINAL_RECOMMENDATION: 'final_recommendation',
  ADJUST_BUDGET_EXPECTATIONS: 'adjust_budget_expectations',
  UPDATE_RECOMMENDATION_HISTORY: 'update_recommendation_history',
  GENERATE_EXPLANATION: 'generate_explanation',
  ORCHESTRATE_RECOMMENDATION_REQUEST: 'orchestrate_recommendation_request',
  ERROR: 'error',
  // Add other message types as needed
} as const;

// Helper function to create an AgentMessage with default values
export function createAgentMessage<T>(
  type: string,
  payload: T,
  sourceAgent: string,
  conversationId: string, // Added conversationId
  correlationId: string, // Made correlationId required for creation
  targetAgent?: string,
  priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL',
  metadata?: {
    sender?: string;
    [key: string]: unknown;
  },
): AgentMessage<T> {
  return {
    id: uuidv4(),
    type,
    payload,
    timestamp: new Date(),
    correlationId, // Use provided correlationId
    sourceAgent,
    targetAgent,
    conversationId, // Assign conversationId
    priority,
    metadata,
  };
}