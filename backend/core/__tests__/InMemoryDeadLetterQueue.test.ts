import { InMemoryDeadLetterQueue } from '../InMemoryDeadLetterQueue';

describe('InMemoryDeadLetterQueue', () => {
  let dlq: InMemoryDeadLetterQueue;

  beforeEach(() => {
    dlq = new InMemoryDeadLetterQueue();
  });

  it('should be empty initially', () => {
    expect(dlq.getAll()).toEqual([]);
  });

  it('should add a message to the queue', () => {
    const testMessage = { data: 'failed message 1' };
    dlq.add(testMessage);
    expect(dlq.getAll()).toEqual([testMessage]);
  });

  it('should add multiple messages to the queue', () => {
    const message1 = { data: 'failed message 1' };
    const message2 = { data: 'failed message 2' };
    dlq.add(message1);
    dlq.add(message2);
    expect(dlq.getAll()).toEqual([message1, message2]);
  });

  it('should return a copy of the queue when getAll is called', () => {
    const testMessage = { data: 'failed message' };
    dlq.add(testMessage);
    const allMessages = dlq.getAll();
    expect(allMessages).toEqual([testMessage]);
    // Modify the returned array to ensure it's a copy
    allMessages.push({ data: 'new message' });
    expect(dlq.getAll()).toEqual([testMessage]); // Original queue should be unchanged
  });

  it('should clear the queue', () => {
    const message1 = { data: 'failed message 1' };
    const message2 = { data: 'failed message 2' };
    dlq.add(message1);
    dlq.add(message2);
    expect(dlq.getAll().length).toBe(2);
    dlq.clear();
    expect(dlq.getAll()).toEqual([]);
  });
});