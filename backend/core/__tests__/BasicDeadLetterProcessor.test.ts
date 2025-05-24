import "reflect-metadata"; // Required for tsyringe decorators
import { BasicDeadLetterProcessor, LoggingDeadLetterHandler } from '../BasicDeadLetterProcessor';
import { InMemoryDeadLetterQueue } from '../InMemoryDeadLetterQueue';
import { BasicRetryManager } from '../BasicRetryManager'; // Import BasicRetryManager
import { RetryManager } from '../RetryManager'; // Import abstract RetryManager for mocking

// Mock BasicRetryManager
jest.mock('../BasicRetryManager');

describe('BasicDeadLetterProcessor', () => {
  let dlq: InMemoryDeadLetterQueue;
  let loggingHandler: LoggingDeadLetterHandler;
  let mockRetryManager: jest.Mocked<BasicRetryManager>;
  let processor: BasicDeadLetterProcessor;

  beforeEach(() => {
    dlq = new InMemoryDeadLetterQueue();
    loggingHandler = new LoggingDeadLetterHandler();
    mockRetryManager = new BasicRetryManager() as jest.Mocked<BasicRetryManager>;

    mockRetryManager.executeWithRetry.mockRejectedValue(new Error('Retry attempts exhausted'));
    processor = new BasicDeadLetterProcessor(dlq, loggingHandler, mockRetryManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should call handlePermanentFailure if retry attempts are exhausted', async () => {
    const handlePermanentFailureSpy = jest.spyOn(processor as any, 'handlePermanentFailure');
    try {
      const testMessage = { data: 'failed message' };
      const testError = new Error('Operation failed');
      const testMetadata = { source: 'TestAgent' };

      await processor.process(testMessage, testError, testMetadata);

      expect(mockRetryManager.executeWithRetry).toHaveBeenCalled();
      expect(handlePermanentFailureSpy).toHaveBeenCalledWith(testMessage, testError, testMetadata);
    } finally {
      handlePermanentFailureSpy.mockRestore();
    }
  });

  it('should add the failed message to the in-memory DLQ on permanent failure', async () => {
    const testMessage = { data: 'failed message' };
    const testError = new Error('Operation failed permanently');
    const testMetadata = { source: 'TestAgent' };

    // Directly call the protected method for isolated testing of permanent failure handling
    await (processor as any).handlePermanentFailure(testMessage, testError, testMetadata);

    const dlqContents = dlq.getAll();
    expect(dlqContents.length).toBe(1);
    expect(dlqContents[0]).toHaveProperty('message', testMessage);
    expect(dlqContents[0]).toHaveProperty('error', testError.message);
    expect(dlqContents[0]).toHaveProperty('metadata', testMetadata);
    expect(dlqContents[0]).toHaveProperty('timestamp'); // Check that timestamp is added
  });

  // Add more tests for successful retry scenarios if needed
});
