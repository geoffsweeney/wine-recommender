import neo4j, { Driver, Session } from 'neo4j-driver';
import { injectable } from 'tsyringe';
import { Neo4jCircuitWrapper } from './Neo4jCircuitWrapper';

@injectable()
export class Neo4jService {
  private readonly driver: Driver;
  private readonly circuit: Neo4jCircuitWrapper;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );
    this.circuit = new Neo4jCircuitWrapper(this.driver);
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    return this.circuit.execute(async (driver) => {
      const session = driver.session();
      try {
        const result = await session.run(query, params);
        return result.records.map(record => record.toObject() as T);
      } finally {
        await session.close();
      }
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.circuit.execute(async (driver) => {
        const session = driver.session();
        try {
          await session.run('RETURN 1');
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