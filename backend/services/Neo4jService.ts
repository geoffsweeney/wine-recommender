import neo4j, { Driver, int as neo4jInt, Session } from "neo4j-driver";
import { injectable, inject } from "tsyringe";
import { INeo4jCircuitWrapper } from "./Neo4jCircuitWrapper";
import { TYPES } from '../di/Types';
import { ILogger } from '../di/Types';
import { Result } from '../core/types/Result'; // Import Result
import { AgentError } from '../core/agents/AgentError'; // Import AgentError

@injectable()
export class Neo4jService {
  private driver: Driver | null = null;

  constructor(
    @inject(TYPES.Neo4jUri) private readonly uri: string,
    @inject(TYPES.Neo4jUser) private readonly user: string,
    @inject(TYPES.Neo4jPassword) private readonly password: string,
    @inject(TYPES.Neo4jCircuitWrapper) private readonly circuit: INeo4jCircuitWrapper,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
  }

  async init(): Promise<void> {
    if (this.driver) {
      this.logger.info('Neo4j driver already initialized.');
      return;
    }
    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.user, this.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
          disableLosslessIntegers: false
        }
      );
      this.logger.info('Neo4j driver initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Neo4j driver', { error });
      throw error;
    }
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    if (!this.driver) {
      await this.init(); // Initialize driver if not already
    }

    const processedParams = params ? this.convertToNeo4jTypes(params) : undefined;
    
    const circuitResult = await this.circuit.executeQuery<T>(query, processedParams); // Use new return type
    
    if (!circuitResult.success) {
      throw circuitResult.error; // Propagate AgentError
    }
    return circuitResult.data;
  }

  private convertToNeo4jTypes(params: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        processed[key] = value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        // Convert integers to Neo4j integer type for specific parameters
        if (Number.isInteger(value) && (
          key === 'limit' ||
          key === 'skip' ||
          key.toLowerCase().includes('count') ||
          (key.toLowerCase().includes('id') && !key.toLowerCase().includes('uuid'))
        )) {
          processed[key] = neo4jInt(Math.floor(Math.abs(value)));
        } else {
          processed[key] = value;
        }
      } else if (Array.isArray(value)) {
        processed[key] = value.map(item => {
          if (typeof item === "number" && Number.isInteger(item)) {
            return neo4jInt(item);
          }
          return typeof item === "object" && item !== null
            ? this.convertToNeo4jTypes(item)
            : item;
        });
      } else if (typeof value === "object" && value !== null && !(value instanceof Date)) {
        processed[key] = this.convertToNeo4jTypes(value);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  async verifyConnection(): Promise<Result<boolean, AgentError>> {
    if (!this.driver) {
      this.logger.warn('Cannot verify connection - driver not initialized');
      return { success: false, error: new AgentError('Neo4j driver not initialized', 'NEO4J_DRIVER_NOT_INITIALIZED', 'Neo4jService', 'N/A', false) };
    }

    const verificationResult = await this.circuit.verifyConnection();
    if (!verificationResult.success) {
      return { success: false, error: verificationResult.error };
    }
    return { success: true, data: verificationResult.data };
  }

  async close(): Promise<void> {
    if (this.driver) {
      try {
        await this.circuit.close();
        this.driver = null;
        this.logger.info('Neo4j service closed successfully');
      } catch (error) {
        this.logger.error('Failed to close Neo4j service', { error });
        throw error;
      }
    }
  }

  getCircuitState(): string {
    return this.circuit.getCircuitState();
  }

  // Health check method for monitoring
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; circuitState: string; connectionVerified: boolean }> {
    const circuitState = this.getCircuitState();
    const connectionVerificationResult = await this.verifyConnection(); // Get the Result object
    const connectionVerified = connectionVerificationResult.success && connectionVerificationResult.data;

    return {
      status: connectionVerified && circuitState === 'CLOSED' ? 'healthy' : 'unhealthy',
      circuitState,
      connectionVerified
    };
  }
}
