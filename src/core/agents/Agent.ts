export interface Agent {
  /**
   * Returns the unique name of the agent.
   */
  getName(): string;

  /**
   * Handles an incoming message for the agent.
   * @param message The message to handle.
   * @returns A promise resolving with the agent's response.
   */
  handleMessage(message: any): Promise<any>;
}