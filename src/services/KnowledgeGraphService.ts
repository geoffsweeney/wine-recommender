import { injectable, inject } from 'tsyringe';
import { Neo4jService } from './Neo4jService';
import { WineNode } from '../types';

@injectable()
export class KnowledgeGraphService {
  constructor(
    @inject('Neo4jService') private neo4j: Neo4jService
  ) {}

  async addWine(wine: WineNode): Promise<void> {
    const requiredFields = ['id', 'name', 'type', 'region'];
    const missingFields = requiredFields.filter(field => !wine[field as keyof WineNode]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    await this.neo4j.executeQuery(
      `MERGE (w:Wine {id: $id}) 
       SET w += $properties`,
      { id: wine.id, properties: wine }
    );
  }

  async getRecommendations(wineId: string, limit = 10): Promise<Array<{
    wine: Pick<WineNode, 'id'|'name'>,
    strength: number
  }>> {
    const result = await this.neo4j.executeQuery(
      `MATCH (w1:Wine {id: $wineId})-[p:PAIRS_WITH]->(w2:Wine)
       RETURN w2, p ORDER BY p.strength DESC LIMIT $limit`,
      { wineId, limit }
    );

    return result.map((record: any) => ({
      wine: {
        id: record.w2.properties.id,
        name: record.w2.properties.name
      },
      strength: record.p.properties.strength
    }));
  }
}