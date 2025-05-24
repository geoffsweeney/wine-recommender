import { CircuitBreaker, CircuitOptions } from '../core/CircuitBreaker';
import { logger } from '../utils/logger';
import type { Driver, Record } from 'neo4j-driver';

export interface INeo4jCircuitWrapper<T = Driver> {
  execute(fn: (driver: T) => Promise<any>): Promise<any>;
  executeQuery?(query: string, params?: object): Promise<any[]>;
}

export class Neo4jCircuitWrapper implements INeo4jCircuitWrapper<Driver> {
  private circuit: CircuitBreaker;
  private driver: Driver;

  constructor(driver: Driver, options: CircuitOptions = {
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 5000,
    fallback: () => {
      logger.warn('Circuit open - using fallback');
      return [];
    }
  }) {
    this.driver = driver;
    this.circuit = new CircuitBreaker(options);
  }

  async execute(fn: (driver: Driver) => Promise<any>): Promise<any> {
    return this.circuit.execute(() => fn(this.driver));
  }

  async executeQuery<T = Record>(query: string, params?: object): Promise<T[]> {
    const operation = async () => {
      const session = this.driver.session();
      try {
        const result = await session.run(query, params);
        return result.records.map(record => record.toObject() as T);
      } catch (error) {
        logger.error('Neo4j query failed', { query, error });
        throw error;
      } finally {
        await session.close();
      }
    };

    return this.circuit.execute(operation);
  }

  getCircuitState() {
    return this.circuit.getState();
  }
}