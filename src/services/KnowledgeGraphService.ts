import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';

interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage?: number;
  price?: number;
  rating?: number;
}

@injectable()
export class KnowledgeGraphService {
  constructor(
    @inject(Neo4jService) private readonly neo4j: Neo4jService
  ) {}

  async createWineNode(wine: WineNode): Promise<void> {
    await this.neo4j.executeQuery(`
      MERGE (w:Wine {id: $id})
      SET w += $properties
    `, {
      id: wine.id,
      properties: {
        name: wine.name,
        type: wine.type,
        region: wine.region,
        vintage: wine.vintage,
        price: wine.price,
        rating: wine.rating
      }
    });
  }

  async findSimilarWines(wineId: string, limit = 5): Promise<WineNode[]> {
    return this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)
      RETURN similar
      LIMIT $limit
    `, { wineId, limit });
  }

  async getWinePairings(wineId: string): Promise<WineNode[]> {
    return this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {id: $wineId})-[:PAIRS_WITH]->(pairing:Wine)
      RETURN pairing
    `, { wineId });
  }

  async getWineById(wineId: string): Promise<WineNode | null> {
    const results = await this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {id: $wineId})
      RETURN w
    `, { wineId });
    return results[0] || null;
  }
}