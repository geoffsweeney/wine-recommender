import { mock } from 'jest-mock-extended';
import 'reflect-metadata';
import { FeatureFlags, ILogger } from '../../../di/Types';
import { AdminPreferenceService } from '../../../services/AdminPreferenceService';
import { KnowledgeGraphService } from '../../../services/KnowledgeGraphService';
import { LLMService } from '../../../services/LLMService';
import { PromptManager } from '../../../services/PromptManager';
import { UserProfileService } from '../../../services/UserProfileService';
import { failure, success } from '../../../utils/result-utils';
import { AdminConversationalAgent, AdminConversationalAgentConfig } from '../AdminConversationalAgent';
import { AgentError } from '../AgentError';
import { CommunicatingAgentDependencies } from '../CommunicatingAgent';
import { createAgentMessage, MessageTypes } from '../communication/AgentMessage';

describe('AdminConversationalAgent', () => {
  let agent: AdminConversationalAgent;
  let mockLlmService: jest.Mocked<LLMService>;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockAdminPreferenceService: jest.Mocked<AdminPreferenceService>;
  let mockKnowledgeGraphService: jest.Mocked<KnowledgeGraphService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockCommunicatingAgentDependencies: CommunicatingAgentDependencies;
  let mockFeatureFlags: FeatureFlags;

  const agentConfig: AdminConversationalAgentConfig = {
    agentId: 'test-admin-agent',
  };

  beforeEach(() => {
    mockLlmService = mock<LLMService>();
    mockPromptManager = mock<PromptManager>();
    mockAdminPreferenceService = mock<AdminPreferenceService>();
    mockKnowledgeGraphService = mock<KnowledgeGraphService>();
    mockUserProfileService = mock<UserProfileService>();
    mockLogger = mock<ILogger>();
    mockFeatureFlags = { adminConversationalPreferences: true }; // Enable feature flag by default for tests

    mockCommunicatingAgentDependencies = {
      communicationBus: mock<any>(), // Mock the communication bus
      logger: mockLogger,
      messageQueue: mock<any>(),
      stateManager: mock<any>(),
      config: mock<any>(),
    };

    agent = new AdminConversationalAgent(
      agentConfig,
      mockLlmService,
      mockPromptManager,
      mockAdminPreferenceService,
      mockKnowledgeGraphService,
      mockUserProfileService,
      mockCommunicatingAgentDependencies,
      mockLogger,
      mockFeatureFlags
    );

    // No need to mock handleMessage since we're using handleMessageForTestingProtected
  });

  it('should return agent name', () => {
    expect(agent.getName()).toBe(agentConfig.agentId);
  });

  it('should return FEATURE_DISABLED error if feature flag is disabled', async () => {
    mockFeatureFlags.adminConversationalPreferences = false;
    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      'show preferences for user123',
      'test-source',
      'test-conversation-id',
      'test-correlation-id',
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('FEATURE_DISABLED');
      expect(result.error.message).toBe('Admin conversational preferences feature is currently disabled.');
    }
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Admin conversational preferences feature is disabled.'),
      expect.objectContaining({ correlationId: 'test-correlation-id' })
    );
  });

  it('should extract and process "view" command successfully', async () => {
    const userId = 'user123';
    const userInput = `show preferences for ${userId}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'view', userId };
    const mockPreferences = [{ type: 'wineType', value: 'red' }];

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.viewUserPreferences.mockResolvedValue(success(mockPreferences));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe(JSON.stringify(mockPreferences, null, 2));
    }
    expect(mockLlmService.sendStructuredPrompt).toHaveBeenCalledWith(
      'adminPreferenceExtraction',
      { userInput },
      expect.objectContaining({ correlationId, agentId: agentConfig.agentId })
    );
    expect(mockAdminPreferenceService.viewUserPreferences).toHaveBeenCalledWith(userId, correlationId);
  });

  it('should extract and process "add" command successfully', async () => {
    const userId = 'user456';
    const preferenceType = 'wineType';
    const preferenceValue = 'white';
    const userInput = `add ${preferenceType} ${preferenceValue} for ${userId}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'add', userId, preferenceType, preferenceValue };

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.addOrUpdateUserPreferences.mockResolvedValue(success('Preference added.'));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe('Preference added.');
    }
    expect(mockAdminPreferenceService.addOrUpdateUserPreferences).toHaveBeenCalledWith(
      userId,
      [{ type: preferenceType, value: preferenceValue }],
      correlationId
    );
  });

  it('should extract and process "update" command successfully', async () => {
    const userId = 'user789';
    const preferenceType = 'sweetness';
    const preferenceValue = 'dry';
    const userInput = `update ${userId}'s ${preferenceType} to ${preferenceValue}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'update', userId, preferenceType, preferenceValue };

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.addOrUpdateUserPreferences.mockResolvedValue(success('Preference updated.'));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe('Preference updated.');
    }
    expect(mockAdminPreferenceService.addOrUpdateUserPreferences).toHaveBeenCalledWith(
      userId,
      [{ type: preferenceType, value: preferenceValue }],
      correlationId
    );
  });

  it('should extract and process "delete" command by type and value successfully', async () => {
    const userId = 'user123';
    const preferenceType = 'wineType';
    const preferenceValue = 'red';
    const userInput = `delete ${preferenceType} ${preferenceValue} for ${userId}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'delete', userId, preferenceType, preferenceValue };

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.deletePreference.mockResolvedValue(success('Preference deleted.'));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe('Preference deleted.');
    }
    expect(mockAdminPreferenceService.deletePreference).toHaveBeenCalledWith(
      userId,
      correlationId,
      preferenceType,
      preferenceValue,
      undefined
    );
  });

  it('should extract and process "delete" command by preferenceId successfully', async () => {
    const userId = 'user123';
    const preferenceId = 'wineType:red';
    const userInput = `delete preference ${preferenceId} for ${userId}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'delete', userId, preferenceId };

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.deletePreference.mockResolvedValue(success('Preference deleted by ID.'));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe('Preference deleted by ID.');
    }
    expect(mockAdminPreferenceService.deletePreference).toHaveBeenCalledWith(
      userId,
      correlationId,
      undefined,
      undefined,
      preferenceId
    );
  });

  it('should extract and process "delete all" command successfully', async () => {
    const userId = 'user999';
    const userInput = `delete all preferences for ${userId}`;
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'delete', userId };

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));
    mockAdminPreferenceService.deleteAllPreferencesForUser.mockResolvedValue(success('All preferences deleted.'));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe('ADMIN_RESPONSE');
      expect(result.data?.payload).toBe('All preferences deleted.');
    }
    expect(mockAdminPreferenceService.deleteAllPreferencesForUser).toHaveBeenCalledWith(userId, correlationId);
  });

  it('should return LLM_EXTRACTION_FAILED error if LLM extraction fails', async () => {
    const userInput = 'invalid command';
    const correlationId = 'test-correlation-id';
    const llmError = new Error('LLM could not extract command');

    mockLlmService.sendStructuredPrompt.mockResolvedValue(failure(new AgentError(llmError.message, 'LLM_ERROR', 'test-agent', correlationId)));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('LLM_EXTRACTION_FAILED');
      expect(result.error.message).toContain('Failed to understand command');
    }
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to extract admin command'),
      expect.objectContaining({ correlationId, error: llmError })
    );
  });

  it('should return UNSUPPORTED_ADMIN_ACTION error for unsupported action', async () => {
    const userId = 'user123';
    const userInput = 'do something for user123';
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'unsupported', userId }; // Unsupported action

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('UNSUPPORTED_ADMIN_ACTION');
      expect(result.error.message).toContain('Unsupported action: unsupported');
    }
  });

  it('should return MISSING_PREFERENCE_DATA error for add/update with missing data', async () => {
    const userId = 'user123';
    const userInput = 'add for user123';
    const correlationId = 'test-correlation-id';
    const mockExtractedCommand = { action: 'add', userId }; // Missing preferenceType and preferenceValue

    mockLlmService.sendStructuredPrompt.mockResolvedValue(success(mockExtractedCommand));

    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      userInput,
      'test-source',
      'test-conversation-id',
      correlationId,
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('MISSING_PREFERENCE_DATA');
      expect(result.error.message).toContain('Missing preference type or value for add/update action');
    }
  });

  it('should return ADMIN_AGENT_ERROR for unhandled message type', async () => {
    const message = createAgentMessage(
      'UNHANDLED_TYPE', // Simulate unhandled type
      'some payload',
      'test-source',
      'test-conversation-id',
      'test-correlation-id',
      agentConfig.agentId
    );

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('UNHANDLED_MESSAGE_TYPE');
      expect(result.error.message).toContain('Unhandled message type: UNHANDLED_TYPE');
    }
  });

  it('should return ADMIN_AGENT_ERROR for general internal errors', async () => {
    const message = createAgentMessage(
      MessageTypes.ADMIN_CONVERSATIONAL_COMMAND,
      'trigger error',
      'test-source',
      'test-conversation-id',
      'test-correlation-id',
      agentConfig.agentId
    );

    // Simulate an internal error by making sendStructuredPrompt throw
    mockLlmService.sendStructuredPrompt.mockImplementation(() => {
      throw new Error('Simulated internal error');
    });

    const result = await agent.handleMessageForTesting(message);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('ADMIN_AGENT_ERROR');
      expect(result.error.message).toContain('Internal server error: Simulated internal error');
    }
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in AdminConversationalAgent: Simulated internal error'),
      expect.objectContaining({ correlationId: 'test-correlation-id' })
    );
  });
});
