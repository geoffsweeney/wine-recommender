import { SharedContextMemory } from '../SharedContextMemory';

describe('SharedContextMemory', () => {
  let contextMemory: SharedContextMemory;
  const testOwner = { id: 'test-agent' };

  beforeEach(() => {
    contextMemory = new SharedContextMemory();
  });

  test('should store and retrieve context', () => {
    contextMemory.setContext(testOwner, 'preferences', { color: 'red' });
    const result = contextMemory.getContext(testOwner, 'preferences');
    
    expect(result?.value).toEqual({ color: 'red' });
    expect(result?.timestamp).toBeDefined();
    expect(result?.versionHash).toBeDefined();
  });

  test('should maintain separate contexts per owner', () => {
    const owner2 = { id: 'another-agent' };
    
    contextMemory.setContext(testOwner, 'key', 'value1');
    contextMemory.setContext(owner2, 'key', 'value2');
    
    expect(contextMemory.getContext(testOwner, 'key')?.value).toBe('value1');
    expect(contextMemory.getContext(owner2, 'key')?.value).toBe('value2');
  });

  test('should track version history', () => {
    contextMemory.setContext(testOwner, 'counter', 1);
    contextMemory.setContext(testOwner, 'counter', 2);
    
    const history = contextMemory.getVersionHistory('counter');
    expect(history.length).toBe(2);
    expect(history[0].value).toBe(1);
    expect(history[1].value).toBe(2);
  });

  test('should handle metadata', () => {
    contextMemory.setContext(testOwner, 'data', 'test', { 
      source: 'api',
      confidence: 0.9 
    });
    
    const result = contextMemory.getContext(testOwner, 'data');
    expect(result?.metadata.source).toBe('api');
    expect(result?.metadata.confidence).toBe(0.9);
  });
});