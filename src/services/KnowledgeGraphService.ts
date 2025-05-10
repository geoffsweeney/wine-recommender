import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';

export interface WineNode {
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

  async findSimilarWines(wineId: string, limit: number = 5): Promise<WineNode[]> {
    // Ensure limit is a non-negative integer for the query
    const integerLimit = Math.floor(Math.max(0, parseInt(limit as any, 10)));

    if (isNaN(integerLimit)) {
       console.warn(`Invalid limit value provided: ${limit}. Defaulting to 5.`);
       return this.neo4j.executeQuery<WineNode>(`
         MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)
         RETURN similar
         LIMIT 5
       `, { wineId });
    }

    const similarWines = await this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)
      RETURN similar
      LIMIT $limit
    `, { wineId, limit: integerLimit }); // Pass the ensured integer limit

    console.log('KnowledgeGraphService - similarWines after executeQuery:', similarWines); // Debug log

    return similarWines;
  }

  async findWinesByIngredients(ingredients: string[]): Promise<WineNode[]> {
    if (!ingredients || ingredients.length === 0) {
      return [];
    }

    const wines = await this.neo4j.executeQuery<WineNode>(`
      MATCH (i:Ingredient)
      WHERE i.name IN $ingredients
      MATCH (i)-[:PAIRS_WITH]->(w:Wine)
      WITH w, count(DISTINCT i) as ingredientCount
      WHERE ingredientCount = size($ingredients)
      RETURN w
    `, { ingredients });

    console.log('KnowledgeGraphService - findWinesByIngredients after executeQuery:', wines); // Debug log

    return wines;
  }

  async findWinesByType(wineType: string): Promise<WineNode[]> {
    if (!wineType) {
      return [];
    }

    const wines = await this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {type: $wineType})
      RETURN w
    `, { wineType });

    console.log('KnowledgeGraphService - findWinesByType after executeQuery:', wines); // Debug log

    return wines;
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