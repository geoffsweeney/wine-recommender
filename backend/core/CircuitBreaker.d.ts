export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  fallback: (error: Error) => any;
}

export declare class CircuitBreaker {
  constructor(options: CircuitOptions);
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
}

export interface INeo4jCircuitWrapper<T = any> {
  execute(fn: (driver: T) => Promise<any>): Promise<any>;
  executeQuery?(query: string, params?: object): Promise<any[]>;
}