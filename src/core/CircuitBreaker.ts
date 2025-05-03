import { EventEmitter } from 'events';

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  successThreshold: number;
}

export abstract class CircuitBreaker {
  protected state: CircuitBreakerState;
  protected readonly options: CircuitBreakerOptions;
  public readonly events: EventEmitter;

  constructor(options: CircuitBreakerOptions) {
    this.options = Object.freeze({...options});
    this.events = new EventEmitter();
    this.state = {
      status: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0
    };
  }

  async protect<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.shouldTry()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
  
  protected reset(): void {
    this.state = {
      status: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0
    };
    this.events.emit('close');
    this.events.emit('stateChange', this.state);
  }

  protected shouldTry(): boolean {
    const now = Date.now();
    
    if (this.state.status === 'closed') {
      return true;
    }

    if (this.state.status === 'open') {
      const timeSinceLastFailure = now - this.state.lastFailureTime;
      if (timeSinceLastFailure >= this.options.resetTimeout) {
        this.state.status = 'half-open';
        this.state.lastFailureTime = now;
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.events.emit('half-open');
        this.events.emit('stateChange', this.state);
      }
      return this.state.status === 'half-open';
    }

    // half-open state
    return true;
  }

  protected onSuccess(): void {
    if (this.state.status === 'half-open') {
      this.state.successCount++;
      if (this.state.successCount >= this.options.successThreshold) {
        this.reset();
      }
    }
  }

  protected onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    if (this.state.failureCount >= this.options.failureThreshold) {
      this.state.status = 'open';
      this.events.emit('open');
      this.events.emit('stateChange', this.state);
    }
  }
}