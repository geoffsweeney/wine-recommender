import neo4j, { Driver, int as neo4jInt } from "neo4j-driver";
import { injectable } from "tsyringe";
import { Neo4jCircuitWrapper } from "./Neo4jCircuitWrapper";

@injectable()
export class Neo4jService {
  private readonly driver: Driver;
  private readonly circuit: Neo4jCircuitWrapper;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );
    this.circuit = new Neo4jCircuitWrapper(this.driver);
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    // Convert parameters that need to be integers (especially for LIMIT, SKIP, etc.)
    const processedParams = params ? this.convertToNeo4jTypes(params) : params;
    
    return this.circuit.execute(async (driver) => {
      const session = driver.session();
      try {
        console.log('Executing Neo4j Query:');
        console.log('Query:', query);
        console.log('Parameters:', processedParams);
        const result = await session.run(query, processedParams);
        return result.records.map(record => record.toObject() as T);
      } finally {
        await session.close();
      }
    });
  }

  // Helper method to convert JavaScript values to appropriate Neo4j types
  private convertToNeo4jTypes(params: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        // For numeric values, explicitly convert to Neo4j integer for known integer parameters
        if (Number.isInteger(value) || 
            key === 'limit' || 
            key === 'skip' || 
            key.toLowerCase().includes('count') ||
            key.toLowerCase().includes('id') && !Number.isNaN(parseInt(value.toString(), 10))) {
          processed[key] = neo4jInt(Math.floor(value));
        } else {
          processed[key] = value; // Keep as float if it's meant to be a float
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // Recursively process nested objects
        processed[key] = this.convertToNeo4jTypes(value);
      } else if (Array.isArray(value)) {
        // Process arrays
        processed[key] = value.map(item => 
          typeof item === "object" && item !== null 
            ? this.convertToNeo4jTypes(item) 
            : (typeof item === "number" && Number.isInteger(item) 
                ? neo4jInt(item) 
                : item)
        );
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.circuit.execute(async (driver) => {
        const session = driver.session();
        try {
          await session.run("RETURN 1");
        } finally {
          await session.close();
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}