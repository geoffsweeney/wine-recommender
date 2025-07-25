import { injectable, inject } from 'tsyringe';
import { RetryManager } from './RetryManager';
import { InMemoryDeadLetterQueue } from './InMemoryDeadLetterQueue';
import { BasicRetryManager } from './BasicRetryManager';

/**
 * Defines the contract for dead letter processing
 * @interface
 */
export interface DeadLetterHandler {
  /**
   * Processes a failed message that couldn't be delivered
   * @param message The failed message
   * @param error The error that occurred
   * @param metadata Additional context about the failure
   */
  handle(message: unknown, error: Error, metadata: Record<string, unknown>): Promise<void>;
}

/**
 * Configuration options for DeadLetterProcessor
 * @interface
 */
export interface DeadLetterProcessorOptions {
  /**
   * Maximum number of replay attempts
   * @default 3
   */
  maxReplayAttempts: number;
  retryManager: RetryManager;
}

/**
 * Abstract base class for processing failed messages with retry capabilities.
 * Handles failed message processing by:
 * 1. Attempting to retry processing through all registered handlers
 * 2. Falling back to permanent failure handling if retries are exhausted
 *
 * @example Basic Usage
 * ```typescript
 * class MyDeadLetterProcessor extends DeadLetterProcessor {
 *   constructor() {
 *     super({
 *       maxReplayAttempts: 3,
 *       retryManager: new RetryManagerImpl()
 *     }, [new LoggingHandler(), new DatabaseHandler()]);
 *   }
 *
 *   protected async handlePermanentFailure(
 *     message: unknown,
 *     error: Error,
 *     metadata: Record<string, unknown>
 *   ): Promise<void> {
 *     // Custom permanent failure logic
 *   }
 * }
 *
 * const processor = new MyDeadLetterProcessor();
 * await processor.process(failedMessage, error);
 * ```
 *
 * @example With Metadata
 * ```typescript
 * await processor.process(message, error, {
 *   queue: 'orders',
 *   attemptCount: 2
 * });
 * ```
 */
export abstract class DeadLetterProcessor {
  protected readonly options: DeadLetterProcessorOptions;
  protected readonly handlers: DeadLetterHandler[];

  constructor(options: DeadLetterProcessorOptions, handlers: DeadLetterHandler[] = []) {
    this.options = Object.freeze({...options});
    this.handlers = [...handlers];
  }

  async process(message: unknown, error: Error, metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.options.retryManager.executeWithRetry(async () => {
        await Promise.all(
          this.handlers.map(handler => 
            handler.handle(message, error, metadata)
          )
        );
      });
    } catch (finalError) {
      await this.handlePermanentFailure(message, error, metadata);
    }
  }

  protected abstract handlePermanentFailure(
    message: unknown,
    error: Error,
    metadata: Record<string, unknown>
  ): Promise<void>;
}

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
    @inject(BasicRetryManager) retryManager: BasicRetryManager
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
