import neo4j, { Driver } from 'neo4j-driver';
import { injectable } from 'tsyringe';

interface CircuitState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
}

@injectable()
export class Neo4jCircuitWrapper {
  private readonly driver: Driver;
  private state: CircuitState;
  private readonly options = {
    failureThreshold: 3,
    resetTimeout: 10000,
    successThreshold: 2
  };

  constructor(driver: Driver) {
    this.driver = driver;
    this.state = {
      status: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0
    };
  }

  private shouldTry(): boolean {
    if (this.state.status === 'closed') return true;
    if (this.state.status === 'open') {
      const shouldTry = Date.now() - this.state.lastFailureTime >= this.options.resetTimeout;
      if (shouldTry) {
        this.state.status = 'half-open';
      }
      return shouldTry;
    }
    return true;
  }

  private onSuccess(): void {
    if (this.state.status === 'half-open') {
      this.state.successCount++;
      if (this.state.successCount >= this.options.successThreshold) {
        this.reset();
      }
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    if (this.state.failureCount >= this.options.failureThreshold) {
      this.state.status = 'open';
    }
  }

  private reset(): void {
    this.state = {
      status: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0
    };
  }

  async execute<T>(operation: (driver: Driver) => Promise<T>): Promise<T> {
    if (!this.shouldTry()) {
      throw new Error('Neo4j circuit breaker is open');
    }

    try {
      const result = await operation(this.driver);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}