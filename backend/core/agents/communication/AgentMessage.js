"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageTypes = void 0;
exports.createAgentMessage = createAgentMessage;
var uuid_1 = require("uuid");
exports.MessageTypes = {
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
    ORCHESTRATE_ADMIN_COMMAND: 'orchestrate_admin_command',
    ADMIN_CONVERSATIONAL_COMMAND: 'admin_conversational_command',
    ADMIN_CONFIRMATION_REQUIRED: 'admin_confirmation_required', // New message type for confirmation
    ADMIN_RESPONSE: 'admin_response', // New message type for general admin responses
    PREFERENCE_EXTRACTION_REQUEST: 'preference-extraction-request',
    PREFERENCE_EXTRACTION_RESPONSE: 'preference-extraction-response',
    ERROR: 'error',
    PREFERENCE_UPDATE: 'preference-update',
    // Add other message types as needed
};
// Helper function to create an AgentMessage with default values
function createAgentMessage(type, payload, sourceAgent, conversationId, // Added conversationId
correlationId, // Made correlationId required for creation
targetAgent, userId, // Add userId parameter
priority, metadata) {
    if (priority === void 0) { priority = 'NORMAL'; }
    return {
        id: (0, uuid_1.v4)(),
        type: type,
        payload: payload,
        timestamp: new Date(),
        correlationId: correlationId, // Use provided correlationId
        sourceAgent: sourceAgent,
        targetAgent: targetAgent,
        userId: userId, // Assign userId
        conversationId: conversationId, // Assign conversationId
        priority: priority,
        metadata: metadata,
    };
}
