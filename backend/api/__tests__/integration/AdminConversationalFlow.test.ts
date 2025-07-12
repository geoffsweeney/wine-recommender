import { mock } from 'jest-mock-extended';
import { container } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { AgentError } from '../../../core/agents/AgentError';
import { EnhancedAgentCommunicationBus } from '../../../core/agents/communication/EnhancedAgentCommunicationBus';
import { ILogger, TYPES } from '../../../di/Types';
import { failure, success } from '../../../utils/result-utils';
import { AdminCommandController } from '../../controllers/AdminCommandController';
import { ValidatedRequest } from '../../middleware/validation';

describe('Admin Conversational Flow Integration Tests', () => {
  jest.setTimeout(30000); // Set default timeout to 30 seconds

  const mockCommunicationBus = mock<EnhancedAgentCommunicationBus>();
  const mockLogger = mock<ILogger>();
  let adminCommandController: AdminCommandController;

  beforeAll(() => {
    container.register(TYPES.AgentCommunicationBus, { useValue: mockCommunicationBus });
    container.register(TYPES.Logger, { useValue: mockLogger });

    // Use the real controller instead of a mock
    adminCommandController = new AdminCommandController(mockCommunicationBus, mockLogger);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.reset();
  });

  describe('POST /admin-commands', () => {
    it('should return 200 with agent response on successful command execution', async () => {
      jest.setTimeout(60000); // Increase timeout for this specific test
      const userId = uuidv4(); // Use a valid UUID
      const message = `show preferences for ${userId}`;
      const mockAgentResponse = {
        message: `Here are the preferences for ${userId}: wineType: Red, sweetness: Dry`,
        preferences: [{ type: 'wineType', value: 'Red' }, { type: 'sweetness', value: 'Dry' }],
      };

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue(
        success({
          id: 'mock-id',
          type: 'orchestrate_admin_command', // Use lowercase to match actual implementation
          timestamp: new Date(),
          correlationId: 'mock-correlation-id',
          conversationId: 'mock-conversation-id',
          sourceAgent: 'admin-conversational-agent',
          targetAgent: 'api',
          payload: mockAgentResponse,
        })
      );

      // Create a proper mock request object
      const mockRequest = mock<ValidatedRequest>();
      mockRequest.validatedBody = { userId, input: { message }, conversationHistory: [] };

      // Create a simple mock response object
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await adminCommandController.execute(mockRequest, mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockAgentResponse);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledWith(
        'admin-conversational-agent',
        expect.objectContaining({
          type: 'orchestrate_admin_command', // Use lowercase to match actual implementation
          payload: expect.objectContaining({
            userInput: { userId, input: { message }, conversationHistory: [] },
            sourceAgent: 'api',
            conversationId: expect.any(String),
            correlationId: expect.any(String),
          }),
          sourceAgent: 'api',
          targetAgent: 'admin-conversational-agent',
          conversationId: expect.any(String),
          correlationId: expect.any(String),
          priority: 'NORMAL',
          metadata: undefined,
          id: expect.any(String),
          timestamp: expect.any(Date),
          userId: undefined,
        })
      );
    });

    it('should return 400 if communication bus returns a failure result', async () => {
      jest.setTimeout(60000); // Increase timeout for this specific test
      const userId = uuidv4(); // Use a valid UUID
      const message = 'invalid command';
      const errorMessage = 'Invalid command format';

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue(
        failure(new AgentError(errorMessage, 'INVALID_INPUT', 'AdminConversationalAgent', ''))
      );

      // Create a proper mock request object
      const mockRequest = mock<ValidatedRequest>();
      mockRequest.validatedBody = { userId, input: { message }, conversationHistory: [] };

      // Create a simple mock response object
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await adminCommandController.execute(mockRequest, mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: errorMessage });
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
    });

    it('should return 404 if agent response payload is null', async () => {
      jest.setTimeout(60000); // Increase timeout for this specific test
      const userId = uuidv4(); // Use a valid UUID
      const message = 'command with no response';

      mockCommunicationBus.sendMessageAndWaitForResponse.mockResolvedValue(
        success({
          id: 'mock-id',
          type: 'orchestrate_admin_command', // Use lowercase to match actual implementation
          timestamp: new Date(),
          correlationId: 'mock-correlation-id',
          conversationId: 'mock-conversation-id',
          sourceAgent: 'admin-conversational-agent',
          targetAgent: 'api',
          payload: null,
        })
      );

      // Create a proper mock request object
      const mockRequest = mock<ValidatedRequest>();
      mockRequest.validatedBody = { userId, input: { message }, conversationHistory: [] };

      // Create a simple mock response object
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await adminCommandController.execute(mockRequest, mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No response from admin agent' });
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
    });

    it('should return 500 if an unexpected error occurs', async () => {
      jest.setTimeout(60000); // Increase timeout for this specific test
      const userId = uuidv4(); // Use a valid UUID
      const message = 'error-inducing command';
      const errorMessage = 'Something went wrong';

      mockCommunicationBus.sendMessageAndWaitForResponse.mockRejectedValue(new Error(errorMessage));

      // Create a proper mock request object
      const mockRequest = mock<ValidatedRequest>();
      mockRequest.validatedBody = { userId, input: { message }, conversationHistory: [] };

      // Create a simple mock response object
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await adminCommandController.execute(mockRequest, mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(mockCommunicationBus.sendMessageAndWaitForResponse).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling admin command request:',
        { error: expect.any(Error) }
      );
    });
  });
});
