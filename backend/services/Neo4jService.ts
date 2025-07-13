import { inject, injectable } from "tsyringe";
import { int as neo4jInt } from "neo4j-driver";
import { AgentError } from '../core/agents/AgentError'; // Import AgentError
import { Result } from '../core/types/Result'; // Import Result
import { ILogger, TYPES } from '../di/Types';
import { INeo4jCircuitWrapper } from "./Neo4jCircuitWrapper"; // Import the interface

@injectable()
export class Neo4jService {
  constructor(
    @inject(TYPES.Neo4jUri) private readonly uri: string,
    @inject(TYPES.Neo4jUser) private readonly user: string,
    @inject(TYPES.Neo4jPassword) private readonly password: string,
    @inject(TYPES.Neo4jCircuitWrapper) private readonly circuit: INeo4jCircuitWrapper,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    // The Neo4j driver is now managed by Neo4jCircuitWrapper
    // No direct driver initialization here
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    const processedParams = params ? this.convertToNeo4jTypes(params) : undefined;
    
    const circuitResult = await this.circuit.executeQuery<T>(query, processedParams);
    
    if (!circuitResult.success) {
      throw circuitResult.error;
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
    const verificationResult = await this.circuit.verifyConnection();
    if (!verificationResult.success) {
      return { success: false, error: verificationResult.error };
    }
    return { success: true, data: verificationResult.data };
  }

  async close(): Promise<void> {
    try {
      await this.circuit.close();
      this.logger.info('Neo4j service closed successfully');
    } catch (error) {
      this.logger.error('Failed to close Neo4j service', { error });
      throw error;
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
