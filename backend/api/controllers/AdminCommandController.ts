import { Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { createAgentMessage, MessageTypes } from '../../core/agents/communication/AgentMessage';
import { EnhancedAgentCommunicationBus } from '../../core/agents/communication/EnhancedAgentCommunicationBus';
import { ILogger, TYPES } from '../../di/Types';
import { AdminCommandRequest } from '../dtos/AdminCommandRequest.dto';
import { ValidatedRequest } from '../middleware/validation';

@injectable()
export class AdminCommandController {
  constructor(
    @inject(TYPES.AgentCommunicationBus) private communicationBus: EnhancedAgentCommunicationBus,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  public async execute(req: ValidatedRequest, res: Response): Promise<void> {
    try {
      const correlationId = uuidv4();
      const conversationId = uuidv4();

      const adminCommandRequest: AdminCommandRequest = req.validatedBody;

      const message = createAgentMessage(
        MessageTypes.ORCHESTRATE_ADMIN_COMMAND,
        {
          userInput: adminCommandRequest,
          conversationId: conversationId,
          correlationId: correlationId,
          sourceAgent: 'api'
        },
        'api',
        conversationId,
        correlationId,
        'admin-conversational-agent' // Target the new admin conversational agent
      );

      const result = await this.communicationBus.sendMessageAndWaitForResponse(
        'admin-conversational-agent',
        message
      );

      if (!result.success) {
        res.status(400).json({ error: result.error.message });
        return;
      }

      if (result.data === null || result.data.payload === null) {
        res.status(404).json({ error: 'No response from admin agent' });
        return;
      }

      res.status(200).json(result.data.payload);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Error handling admin command request:', { error });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
