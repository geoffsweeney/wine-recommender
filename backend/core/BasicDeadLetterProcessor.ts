import { injectable, inject } from 'tsyringe';
import { DeadLetterProcessor, DeadLetterHandler, DeadLetterProcessorOptions } from './DeadLetterProcessor';
import { InMemoryDeadLetterQueue } from './InMemoryDeadLetterQueue';
import { BasicRetryManager } from './BasicRetryManager'; // Import BasicRetryManager

/**
 * A basic DeadLetterHandler that logs failed messages.
 */
@injectable()
export class LoggingDeadLetterHandler implements DeadLetterHandler {
  async handle(message: unknown, error: Error, metadata: Record<string, unknown>): Promise<void> {
    console.error('LoggingDeadLetterHandler: Failed message received:', {
      message,
      error: error.message,
      metadata,
    });
  }
}

/**
 * A concrete DeadLetterProcessor that uses an in-memory queue for permanent failures
 * and includes a logging handler.
 */
@injectable()
export class BasicDeadLetterProcessor extends DeadLetterProcessor {
  constructor(
    @inject(InMemoryDeadLetterQueue) private readonly dlq: InMemoryDeadLetterQueue,
    @inject(LoggingDeadLetterHandler) loggingHandler: LoggingDeadLetterHandler,
    @inject(BasicRetryManager) retryManager: BasicRetryManager // Inject BasicRetryManager
  ) {
    // Configure options for the base DeadLetterProcessor
    const options: DeadLetterProcessorOptions = {
      maxReplayAttempts: 3, // Example: allow up to 3 retry attempts
      retryManager: retryManager,
    };
    // Register the logging handler with the base processor
    super(options, [loggingHandler]);
  }

  protected async handlePermanentFailure(
    message: unknown,
    error: Error,
    metadata: Record<string, unknown>
  ): Promise<void> {
    console.error('BasicDeadLetterProcessor: Handling permanent failure. Adding to DLQ.');
    // Add the failed message to the in-memory DLQ
    this.dlq.add({
      message,
      error: error.message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  public async addToDLQ(error: Error, message: unknown, metadata: Record<string, unknown>): Promise<void> {
    console.error('BasicDeadLetterProcessor: Adding to DLQ.');
    this.dlq.add({
      message,
      error: error.message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}