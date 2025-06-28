import { injectable, inject } from 'tsyringe';
import { IWineRepository } from './interfaces/IWineRepository';
import { Neo4jService } from './Neo4jService';
import { Wine } from './models/Wine';
import { TYPES } from '../di/Types';
import { ILogger } from './LLMService'; // Assuming ILogger is defined here or similar

@injectable()
export class Neo4jWineRepository implements IWineRepository {
  constructor(
    @inject(TYPES.Neo4jService) private readonly neo4jService: Neo4jService,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {}

  async getAllWines(): Promise<Wine[]> {
    this.logger.debug('Fetching all wines from Neo4j');
    const query = `
      MATCH (w:Wine)
      RETURN w.id AS id, w.name AS name, w.type AS type, w.region AS region,
             w.year AS year, w.price AS price, w.rating AS rating, w.description AS description
    `;
    const result = await this.neo4jService.executeQuery<Wine>(query);
    return result;
  }

  async searchWines(criteria: { name?: string; type?: string }): Promise<Wine[]> {
    this.logger.debug('Searching wines in Neo4j', { criteria });
    let query = `
      MATCH (w:Wine)
      WHERE 1 = 1
    `;
    const params: any = {};

    if (criteria.name) {
      query += ` AND toLower(w.name) CONTAINS toLower($name)`;
      params.name = criteria.name;
    }
    if (criteria.type) {
      query += ` AND toLower(w.type) = toLower($type)`;
      params.type = criteria.type;
    }

    query += `
      RETURN w.id AS id, w.name AS name, w.type AS type, w.region AS region,
             w.year AS year, w.price AS price, w.rating AS rating, w.description AS description
    `;
    const result = await this.neo4jService.executeQuery<Wine>(query, params);
    return result;
  }

  async getWineById(id: string): Promise<Wine | null> {
    this.logger.debug('Fetching wine by ID from Neo4j', { id });
    const query = `
      MATCH (w:Wine {id: $id})
      RETURN w.id AS id, w.name AS name, w.type AS type, w.region AS region,
             w.year AS year, w.price AS price, w.rating AS rating, w.description AS description
    `;
    const result = await this.neo4jService.executeQuery<Wine>(query, { id });
    return result.length > 0 ? result[0] : null;
  }
}