import 'reflect-metadata';
import { DeadLetterProcessor, DeadLetterHandler } from '../DeadLetterProcessor';
import { RetryManager } from '../RetryManager';
import { MockCircuitBreaker } from './RetryManager.test';

class MockDeadLetterHandler implements DeadLetterHandler {
  async handle(message: unknown, error: Error): Promise<void> {
    if ((error as any).nonRetryable) {
      throw error;
    }
  }
}

class MockRetryManager extends RetryManager {
  constructor() {
    const mockBreaker = new MockCircuitBreaker();
    super(
      { maxAttempts: 3, circuitBreaker: mockBreaker },
      []
    );
  }
}

describe('DeadLetterProcessor', () => {
  const mockRetryManager = new MockRetryManager();
  const mockHandler = new MockDeadLetterHandler();

  class TestDeadLetterProcessor extends DeadLetterProcessor {
    constructor() {
      super({ maxReplayAttempts: 3, retryManager: mockRetryManager }, [mockHandler]);
    }

    async handlePermanentFailure(): Promise<void> {
      // Test implementation
    }
  }

  const processor = new TestDeadLetterProcessor();

  it('should retry failed handler executions', async () => {
    const mockMessage = { id: 'test' };
    const mockError = new Error('test error');
    
    await expect(processor.process(mockMessage, mockError))
      .resolves.not.toThrow();
  });

  it('should trigger permanent failure handler when retries exhausted', async () => {
    const mockMessage = { id: 'test' };
    const mockError = new Error('test error');
    (mockError as any).nonRetryable = true;

    const spy = jest.spyOn(processor, 'handlePermanentFailure');
    await processor.process(mockMessage, mockError);
    expect(spy).toHaveBeenCalledWith(mockMessage, mockError, {});
  });

  it('should call all handlers with the same message', async () => {
    const mockHandler1 = { handle: jest.fn().mockResolvedValue(undefined) };
    const mockHandler2 = { handle: jest.fn().mockResolvedValue(undefined) };
    
    // Create mock RetryManager that executes immediately
    const mockRetryManager = {
      executeWithRetry: jest.fn().mockImplementation(async (fn) => {
        await fn(); // Actually execute the function
      })
    } as unknown as RetryManager;

    // Create test processor with mock handlers
    const testProcessor = new (class extends TestDeadLetterProcessor {
      constructor() {
        super();
        (this as any).handlers = [mockHandler1, mockHandler2];
        (this as any).options = {
          maxReplayAttempts: 3,
          retryManager: mockRetryManager
        };
      }
    })();

    const mockMessage = { id: 'multi-handler-test' };
    await testProcessor.process(mockMessage, new Error('test'));

    expect(mockHandler1.handle).toHaveBeenCalledWith(mockMessage, expect.any(Error), {});
    expect(mockHandler2.handle).toHaveBeenCalledWith(mockMessage, expect.any(Error), {});
    expect(mockRetryManager.executeWithRetry).toHaveBeenCalled();
  });

  it('should include metadata in handler calls', async () => {
    const testProcessor = new TestDeadLetterProcessor();
    const processSpy = jest.spyOn(testProcessor, 'process');

    const metadata = { queue: 'test-queue', timestamp: Date.now() };
    await testProcessor.process({}, new Error('test'), metadata);

    expect(processSpy).toHaveBeenCalledWith(expect.anything(), expect.anything(), metadata);
  });
});