import { CircuitBreaker, CircuitOptions } from '../core/CircuitBreaker';
import { Driver, Record, Session } from 'neo4j-driver';
import { injectable, inject } from 'tsyringe'; // Import injectable and inject
import { TYPES } from '../di/Types'; // Import TYPES from centralized location
import { ILogger } from './LLMService'; // Import ILogger
import { Result } from '../core/types/Result'; // Import Result
import { AgentError } from '../core/agents/AgentError'; // Import AgentError


export interface INeo4jCircuitWrapper<T = Driver> {
  execute<R>(fn: (driver: T) => Promise<R>): Promise<R>;
  executeQuery<T = any>(query: string, params?: any): Promise<Result<T[], AgentError>>; // Changed return type
  verifyConnection(): Promise<Result<boolean, AgentError>>; // Changed return type
  close(): Promise<void>;
  getCircuitState(): string;
}
@injectable()
export class Neo4jCircuitWrapper implements INeo4jCircuitWrapper<Driver> {
  private readonly circuit: CircuitBreaker;

  constructor(
    @inject(TYPES.Neo4jDriver) private readonly driver: Driver,
    @inject(TYPES.CircuitOptions) options: CircuitOptions,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    const circuitOptions: CircuitOptions = {
      ...options,
      fallback: (error: Error) => {
        this.logger.warn('Circuit breaker is open - operation blocked', { error: error.message });
        throw new Error(`Circuit breaker is open: ${error.message}`);
      }
    };
    this.circuit = new CircuitBreaker(circuitOptions);
  }

  async execute<R>(fn: (driver: Driver) => Promise<R>): Promise<R> {
    return this.circuit.execute(() => fn(this.driver));
  }

  async executeQuery<T = any>(query: string, params?: any): Promise<Result<T[], AgentError>> {
    this.logger.debug('Executing Neo4j query', { query, params });

    try {
      const operation = async (): Promise<T[]> => {
        let session: Session | null = null;
        
        try {
          session = this.driver.session();
          this.logger.debug('Neo4jCircuitWrapper: Calling session.run with query and params:', { query, params }); // New log
          const result = await session.run(query, params || {});
          
          if (!result?.records) {
            this.logger.debug('Query returned no records');
            return [];
          }

          return result.records.map((record: Record) => {
            this.logger.debug('Processing Neo4j record:', { recordKeys: record.keys, recordValues: record.toObject() });
            try {
              // Attempt to extract properties from a node, regardless of its alias
              for (const key of record.keys) {
                const value = record.get(key);
                this.logger.debug(`Checking key: ${String(key)}, value: ${JSON.stringify(value)}`);
                if (value && value.properties) {
                  this.logger.debug(`Found node properties for key ${String(key)}: ${JSON.stringify(value.properties)}`);
                  return value.properties as T;
                }
              }
              // If no node with properties is found, return the whole object
              this.logger.debug('No node properties found, returning full object.');
              return record.toObject() as T;
            } catch (parseError) {
              this.logger.error('Failed to parse Neo4j record', {
                error: parseError,
                recordKeys: record.keys
              });
              return record.toObject() as T;
            }
          });
        } finally {
          if (session) {
            try {
              await session.close();
            } catch (closeError) {
              this.logger.warn('Failed to close Neo4j session', { closeError });
            }
          }
        }
      };

      const result = await this.circuit.execute(operation);
      return { success: true, data: result };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Neo4j query execution failed', {
        error,
        query,
        params,
        errorMessage: errorMessage
      });
      return { success: false, error: new AgentError(`Neo4j query failed: ${errorMessage}`, 'NEO4J_QUERY_FAILED', 'Neo4jCircuitWrapper', 'N/A', true, { originalError: errorMessage }) };
    }
  }

  async verifyConnection(): Promise<Result<boolean, AgentError>> {
    try {
      await this.circuit.execute(async () => {
        let session: Session | null = null;
        try {
          session = this.driver.session();
          await session.run('RETURN 1 as test');
          this.logger.debug('Neo4j connection verified successfully');
        } finally {
          if (session) {
            await session.close();
          }
        }
      });
      return { success: true, data: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Neo4j connection verification failed', { error: errorMessage });
      return { success: false, error: new AgentError(`Neo4j connection failed: ${errorMessage}`, 'NEO4J_CONNECTION_FAILED', 'Neo4jCircuitWrapper', 'N/A', false, { originalError: errorMessage }) };
    }
  }

  async close(): Promise<void> {
    try {
      await this.driver.close();
      this.logger.info('Neo4j driver closed successfully');
    } catch (error) {
      this.logger.error('Failed to close Neo4j driver', { error });
      throw error;
    }
  }

  getCircuitState(): string {
    return this.circuit.getState();
  }
}
