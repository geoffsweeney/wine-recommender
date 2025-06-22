import { AgentMessage } from './AgentMessage';

export abstract class AgentCommunicationBus {
  abstract registerMessageHandler(
    agentId: string,
    messageType: string,
    handler: (message: AgentMessage) => Promise<void>
  ): void;

  abstract sendMessageAndWaitForResponse<T>(
    targetAgentId: string,
    message: AgentMessage,
    timeoutMs?: number
  ): Promise<AgentMessage<T>>;

  abstract sendResponse(targetAgentId: string, response: AgentMessage): void;
  abstract publishToAgent<T>(targetAgentId: string, message: AgentMessage<T>): void;
  
  abstract sendLLMPrompt(prompt: string): Promise<string>;
}