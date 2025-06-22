export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly agentId: string,
    public readonly correlationId: string,
    public readonly recoverable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}