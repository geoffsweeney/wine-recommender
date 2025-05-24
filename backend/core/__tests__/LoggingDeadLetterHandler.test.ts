import "reflect-metadata"; // Required for tsyringe decorators
import { LoggingDeadLetterHandler } from '../BasicDeadLetterProcessor'; // Assuming LoggingDeadLetterHandler is exported from BasicDeadLetterProcessor.ts

describe('LoggingDeadLetterHandler', () => {
  let handler: LoggingDeadLetterHandler;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    handler = new LoggingDeadLetterHandler();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy on console.error
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore(); // Restore console.error spy
  });

  it('should log the failed message, error, and metadata', async () => {
    const testMessage = { data: 'failed message' };
    const testError = new Error('Something went wrong');
    const testMetadata = { source: 'TestAgent', attempt: 1 };

    await handler.handle(testMessage, testError, testMetadata);

    expect(consoleErrorSpy).toHaveBeenCalledWith('LoggingDeadLetterHandler: Failed message received:', {
      message: testMessage,
      error: testError.message,
      metadata: testMetadata,
    });
  });
});