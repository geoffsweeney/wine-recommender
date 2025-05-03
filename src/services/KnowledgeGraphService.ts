import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';

interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage: number;
}

interface PairingRelationship {
  strength: number;
  description: string;
}

@injectable()
export class KnowledgeGraphService {
  constructor(
    @inject('Neo4jService') private neo4j: Neo4jService
  ) {}

  async initializeSchema(): Promise<void> {
    await this.neo4j.executeQuery(`
      CREATE CONSTRAINT wine_id_unique IF NOT EXISTS
      FOR (w:Wine) REQUIRE w.id IS UNIQUE
    `);
  }

  async addWine(wine: WineNode): Promise<void> {
    await this.neo4j.executeQuery(`
      MERGE (w:Wine {id: $id})
      SET w += $properties
    `, {
      id: wine.id,
      properties: {
        name: wine.name,
        type: wine.type,
        region: wine.region,
        vintage: wine.vintage
      }
    });
  }

  async addPairing(
    wineId1: string,
    wineId2: string,
    relationship: PairingRelationship
  ): Promise<void> {
    await this.neo4j.executeQuery(`
      MATCH (w1:Wine {id: $wineId1})
      MATCH (w2:Wine {id: $wineId2})
      MERGE (w1)-[p:PAIRS_WITH]->(w2)
      SET p += $properties
    `, {
      wineId1,
      wineId2,
      properties: {
        strength: relationship.strength,
        description: relationship.description
      }
    });
  }

  async getRecommendations(wineId: string, limit = 5): Promise<WineNode[]> {
    const results = await this.neo4j.executeQuery<{w: WineNode}>(`
      MATCH (w1:Wine {id: $wineId})-[p:PAIRS_WITH]->(w2:Wine)
      RETURN w2 as w
      ORDER BY p.strength DESC
      LIMIT $limit
    `, { wineId, limit });

    return results.map(r => r.w);
  }

  async findWinesByProperties(properties: Partial<WineNode>): Promise<WineNode[]> {
    const whereClause = Object.keys(properties)
      .map(key => `w.${key} = $${key}`)
      .join(' AND ');

    const query = `
      MATCH (w:Wine)
      ${whereClause ? 'WHERE ' + whereClause : ''}
      RETURN w
      LIMIT 50
    `;

    const results = await this.neo4j.executeQuery<{w: WineNode}>(query, properties);
    return results.map(r => r.w);
  }
}