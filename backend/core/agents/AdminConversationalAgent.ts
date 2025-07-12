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
import { AgentMessage, MessageTypes } from './communication/AgentMessage';

// Define the configuration interface for the AdminConversationalAgent
export interface AdminConversationalAgentConfig {
  agentId: string;
  // Add any other specific configuration parameters here
}

// Define a type for the dependencies that CommunicatingAgent expects
import { CommunicatingAgentDependencies } from './CommunicatingAgent';
import { createAgentMessage } from './communication/AgentMessage';

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
  protected readonly logger: ILogger; // Change to protected

  constructor(
    @inject(TYPES.AdminConversationalAgentConfig) private readonly agentConfig: AdminConversationalAgentConfig,
    @inject(TYPES.LLMService) private readonly llmService: LLMService,
    @inject(TYPES.PromptManager) private readonly promptManager: PromptManager,
    @inject(TYPES.AdminPreferenceService) private readonly adminPreferenceService: AdminPreferenceService,
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(UserProfileService) private readonly userProfileService: UserProfileService,
    @inject(TYPES.CommunicatingAgentDependencies) dependencies: CommunicatingAgentDependencies, // Inject dependencies
    @inject(TYPES.Logger) logger: ILogger, // Inject logger separately for direct use
    @inject(TYPES.FeatureFlags) private readonly featureFlags: FeatureFlags // Inject FeatureFlags
  ) {
    super(agentConfig.agentId, agentConfig, dependencies); // Pass all required dependencies
    this.logger = logger; // Assign injected logger
    this.logger.info(`AdminConversationalAgent initialized with ID: ${this.id}`);
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

  protected async handleMessage<T>(message: AgentMessage<T>): Promise<Result<AgentMessage | null, AgentError>> {
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
          { userInput },
          { correlationId, agentId: this.id, operation: 'extractAdminCommand' }
        );

        if (extractionResult.success) {
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
            case 'delete':
              if (extractedCommand.preferenceType && extractedCommand.preferenceValue) {
                adminResponseResult = await this.adminPreferenceService.deletePreference(
                  extractedCommand.userId,
                  correlationId,
                  extractedCommand.preferenceType,
                  extractedCommand.preferenceValue,
                  undefined // Explicitly pass undefined for preferenceId
                );
              } else if (extractedCommand.preferenceId) {
                adminResponseResult = await this.adminPreferenceService.deletePreference(
                  extractedCommand.userId,
                  correlationId,
                  undefined,
                  undefined,
                  extractedCommand.preferenceId
                );
              } else {
                adminResponseResult = await this.adminPreferenceService.deleteAllPreferencesForUser(extractedCommand.userId, correlationId);
              }
              break;
          }

          if (adminResponseResult.success) {
            let responsePayload: string;
            if (typeof adminResponseResult.data === 'string') {
              responsePayload = adminResponseResult.data;
            } else if (adminResponseResult.data && typeof adminResponseResult.data === 'object') {
              responsePayload = JSON.stringify(adminResponseResult.data, null, 2); // Pretty print JSON
            } else {
              responsePayload = 'Admin command executed successfully.';
            }

            return success(createAgentMessage(
              'ADMIN_RESPONSE',
              responsePayload, // Send formatted string as payload
              this.id,
              message.correlationId, // Use message.correlationId as conversationId
              message.correlationId, // Use message.correlationId as correlationId
              message.sourceAgent // Target the source agent
            ));
          } else {
            // Handle specific error codes from adminPreferenceService
            if (adminResponseResult.error.code === 'MISSING_PREFERENCE_DATA') {
              return failure(adminResponseResult.error);
            }
            return failure(adminResponseResult.error);
          }

        } else {
          this.logger.error(`[${correlationId}] Failed to extract admin command: ${extractionResult.error.message}`, { correlationId, error: extractionResult.error });
          return failure(new AgentError(`Failed to understand command: ${extractionResult.error.message}`, 'LLM_EXTRACTION_FAILED', this.id, correlationId, true, { originalError: extractionResult.error.message }));
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
