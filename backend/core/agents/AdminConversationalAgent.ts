import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { FeatureFlags, ILogger, TYPES } from '../../di/Types'; // Import FeatureFlags
import { AdminPreferenceService } from '../../services/AdminPreferenceService'; // Import AdminPreferenceService
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { LLMService } from '../../services/LLMService';
import { PromptManager } from '../../services/PromptManager';
import { UserProfileService } from '../../services/UserProfileService';
import { failure, success } from '../../utils/result-utils';
import { Result } from '../types/Result';
import { AgentError } from './AgentError';
import { CommunicatingAgent } from './CommunicatingAgent';
import { ICommunicatingAgentDependencies } from '../../di/Types';
import { AgentMessage, createAgentMessage, MessageTypes } from './communication/AgentMessage';


/**
 * Type guard to check if a Result is successful
 * @param result The Result to check
 * @returns true if the result is successful, false otherwise
 */
function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if a Result is an error
 * @param result The Result to check
 * @returns true if the result is an error, false otherwise
 */
function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

// Define the configuration interface for the AdminConversationalAgent
export interface AdminConversationalAgentConfig {
  agentId: string;
  // Add any other specific configuration parameters here
}

// Zod schema for the output of the adminPreferenceExtraction prompt
const AdminPreferenceExtractionOutputSchema = z.object({
  action: z.union([z.literal('view'), z.literal('add'), z.literal('update'), z.literal('delete')]),
  userId: z.string().min(1, 'User ID is required'),
  preferenceType: z.string().optional(),
  preferenceValue: z.string().optional(),
  preferenceId: z.string().optional(), // For composite IDs like "type:value"
  // Add other fields as needed for specific actions (e.g., new value for update)
});

import { AdminPreferenceExtractionOutput } from '../../services/PromptManager'; // Import the type from PromptManager

@injectable()
export class AdminConversationalAgent extends CommunicatingAgent {

  constructor(
    @inject(TYPES.AdminConversationalAgentConfig) private readonly agentConfig: AdminConversationalAgentConfig,
    @inject(TYPES.LLMService) private readonly llmService: LLMService,
    @inject(TYPES.PromptManager) private readonly promptManager: PromptManager,
    @inject(TYPES.AdminPreferenceService) private readonly adminPreferenceService: AdminPreferenceService,
    @inject(TYPES.KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.UserProfileService) private readonly userProfileService: UserProfileService,
    @inject(TYPES.CommunicatingAgentDependencies) dependencies: ICommunicatingAgentDependencies, // Inject dependencies
    @inject(TYPES.FeatureFlags) private readonly featureFlags: FeatureFlags // Inject FeatureFlags
  ) {
    super(agentConfig.agentId, agentConfig, dependencies); // Pass all required dependencies
    this.logger.info(`AdminConversationalAgent initialized with ID: ${this.id}`);
    this.logger.info(`AdminConversationalAgent: registerMessageHandlers called.`);
    this.registerMessageHandlers(); // Ensure handlers are registered
  }

  private registerMessageHandlers(): void {
    this.communicationBus.registerMessageHandler(this.id, MessageTypes.ADMIN_CONVERSATIONAL_COMMAND, this.handleMessage.bind(this) as any);
    this.communicationBus.registerMessageHandler(this.id, MessageTypes.ORCHESTRATE_ADMIN_COMMAND, this.handleMessage.bind(this) as any);
  }

  public getName(): string {
    return this.id; // Return the agent's ID as its name
  }

  // Expose handleMessage for testing
  public async handleMessageForTesting<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    return this.handleMessage(message);
  }

  // Expose the protected handleMessage method for testing
  public async handleMessageForTestingProtected<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    return this.handleMessage(message);
  }

  public async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
    const { correlationId, payload, type } = message;
    this.logger.info(`[${correlationId}] AdminConversationalAgent received message type: ${type}`, { correlationId, type });

    try {
      if (type === MessageTypes.ADMIN_CONVERSATIONAL_COMMAND || type === MessageTypes.ORCHESTRATE_ADMIN_COMMAND) {
        // Check if the feature flag is enabled
        if (!this.featureFlags.adminConversationalPreferences) {
          this.logger.warn(`[${correlationId}] Admin conversational preferences feature is disabled.`, { correlationId });
          return failure(new AgentError('Admin conversational preferences feature is currently disabled.', 'FEATURE_DISABLED', this.id, correlationId, true));
        }

        let userInput: string;
        if (type === MessageTypes.ORCHESTRATE_ADMIN_COMMAND) {
          const adminCommandRequest = payload as { userInput: { message: string } };
          userInput = adminCommandRequest.userInput.message;
        } else {
          userInput = payload as string;
        }
        this.logger.debug(`[${correlationId}] Processing admin command: "${userInput}"`, { correlationId, userInput });

        // Use LLM to extract structured command from natural language
        const extractionResult = await this.llmService.sendStructuredPrompt<
          'adminPreferenceExtraction', // Task name
          AdminPreferenceExtractionOutput // Expected output type
        >(
          'adminPreferenceExtraction',
          { userInput }, // Wrap userInput in the correct type
          { correlationId, agentId: this.id, operation: 'extractAdminCommand' }
        );

        if (isSuccess(extractionResult)) {
          const extractedCommand: AdminPreferenceExtractionOutput = extractionResult.data; // Type assertion
          this.logger.debug(`[${correlationId}] Extracted command: ${JSON.stringify(extractedCommand)}`, { correlationId, extractedCommand });

          // Handle unsupported actions
          if (!['view', 'add', 'update', 'delete'].includes(extractedCommand.action)) {
            return failure(new AgentError(`Unsupported action: ${extractedCommand.action}`, 'UNSUPPORTED_ADMIN_ACTION', this.id, correlationId));
          }

          // Handle missing preference data for add/update
          if ((extractedCommand.action === 'add' || extractedCommand.action === 'update') &&
              !(extractedCommand.preferenceType && extractedCommand.preferenceValue)) {
            return failure(new AgentError('Missing preference type or value for add/update action', 'MISSING_PREFERENCE_DATA', this.id, correlationId));
          }

          let adminResponseResult: Result<any, AgentError>;

          switch (extractedCommand.action) {
            case 'view':
              adminResponseResult = await this.adminPreferenceService.viewUserPreferences(extractedCommand.userId, correlationId);
              break;
            case 'add':
            case 'update':
              adminResponseResult = await this.adminPreferenceService.addOrUpdateUserPreferences(
                extractedCommand.userId,
                [{ type: extractedCommand.preferenceType!, value: extractedCommand.preferenceValue! }],
                correlationId
              );
              break;
            case 'delete': {
              // Instead of directly deleting, return a confirmation request
              const confirmationPayload = {
                action: 'confirm_delete',
                userId: extractedCommand.userId,
                preferenceType: extractedCommand.preferenceType,
                preferenceValue: extractedCommand.preferenceValue,
                preferenceId: extractedCommand.preferenceId,
                message: `Are you sure you want to delete ${extractedCommand.preferenceType ? `${extractedCommand.preferenceType}: ${extractedCommand.preferenceValue}` : extractedCommand.preferenceId ? `preference ID: ${extractedCommand.preferenceId}` : 'all preferences'} for user ${extractedCommand.userId}?`
              };
              return success(createAgentMessage(
                MessageTypes.ADMIN_CONFIRMATION_REQUIRED, // New message type for confirmation
                confirmationPayload,
                this.id,
                message.correlationId,
                message.correlationId,
                message.sourceAgent
              ));
            }
          }

          if (isSuccess(adminResponseResult)) {
            let responsePayload: string;
            if (typeof adminResponseResult.data === 'string') {
              responsePayload = adminResponseResult.data;
            } else if (typeof adminResponseResult.data === 'object') {
              responsePayload = JSON.stringify(adminResponseResult.data, null, 2); // Pretty print JSON
            } else {
              responsePayload = 'Admin command executed successfully.';
            }

            return success(createAgentMessage(
              MessageTypes.ADMIN_RESPONSE, // Use MessageTypes enum
              responsePayload, // Send formatted string as payload
              this.id,
              message.correlationId, // Use message.correlationId as conversationId
              message.correlationId, // Use message.correlationId as correlationId
              message.sourceAgent // Target the source agent
            ));
          } else {
            // Handle specific error codes from adminPreferenceService
            const error = adminResponseResult.error;
            if (error.code === 'MISSING_PREFERENCE_DATA') {
              return failure(error);
            }
            return failure(error);
          }

        } else {
          const extractionError = extractionResult.error;
          this.logger.error(`[${correlationId}] Failed to extract admin command: ${extractionError.message}`, { correlationId, error: extractionError });
          return failure(new AgentError(`Failed to understand command: ${extractionError.message}`, 'LLM_EXTRACTION_FAILED', this.id, correlationId, true, { originalError: extractionError.message }));
        }
      }

      return failure(new AgentError(`Unhandled message type: ${type}`, 'UNHANDLED_MESSAGE_TYPE', this.id, correlationId));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${correlationId}] Error in AdminConversationalAgent: ${errorMessage}`, { correlationId, error });
      return failure(new AgentError(`Internal server error: ${errorMessage}`, 'ADMIN_AGENT_ERROR', this.id, correlationId, true, { originalError: errorMessage }));
    }
  }
}
