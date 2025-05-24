/**
 * Simple in-memory implementation of a Dead Letter Queue for POC purposes.
 */
export class InMemoryDeadLetterQueue {
  private queue: any[] = [];

  /**
   * Adds a failed message to the dead letter queue.
   * @param message The failed message.
   */
  add(message: any): void {
    console.log('InMemoryDeadLetterQueue: Adding message to DLQ', message);
    this.queue.push(message);
  }

  /**
   * Retrieves all messages from the dead letter queue.
   * (Note: This is a simplified implementation; a real DLQ might have polling/processing mechanisms)
   * @returns An array of messages in the DLQ.
   */
  getAll(): any[] {
    console.log('InMemoryDeadLetterQueue: Retrieving all messages from DLQ.');
    return [...this.queue]; // Return a copy to prevent external modification
  }

  /**
   * Clears all messages from the dead letter queue.
   */
  clear(): void {
    console.log('InMemoryDeadLetterQueue: Clearing DLQ.');
    this.queue = [];
  }
}