import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';
import { RecommendationRequest } from '../api/dtos/RecommendationRequest.dto';
import { WineNode, PreferenceNode, UserPreferences } from '../types'; // Import UserPreferences
import { TYPES } from '../di/Types';
import winston from 'winston';


@injectable()
export class KnowledgeGraphService {
  constructor(
    @inject(Neo4jService) private readonly neo4j: Neo4jService,
    @inject(TYPES.Logger) private readonly logger: winston.Logger
  ) {
    this.logger.info('KnowledgeGraphService initialized');
  }

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
    let integerLimit = Math.floor(Math.max(0, parseInt(limit as any, 10)));

    if (isNaN(integerLimit)) {
       this.logger.warn(`Invalid limit value provided: ${limit}. Defaulting to 5.`);
       integerLimit = 5; // Set default to 5 if invalid
    }

    const similarWines = await this.neo4j.executeQuery<WineNode>(`
      MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)
      RETURN similar
      LIMIT $limit
    `, { wineId, limit: integerLimit });

    this.logger.debug('KnowledgeGraphService - similarWines after executeQuery:', similarWines);

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

    this.logger.debug('KnowledgeGraphService - findWinesByIngredients after executeQuery:', wines);

    return wines;
  }

  async findWinesByPreferences(preferences: UserPreferences): Promise<WineNode[]> { // Use the new UserPreferences interface
    this.logger.debug('KnowledgeGraphService: Finding wines by preferences:', preferences);
      if (!preferences || Object.keys(preferences).length === 0) { // Check if preferences object is empty
        this.logger.debug('KnowledgeGraphService: No specific preferences provided, returning empty array.');
        return []; // Return empty array if preferences is undefined or empty
      }
      let query = 'MATCH (w:Wine)';
      const parameters: any = {};
    const conditions: string[] = [];

    if (preferences.wineType) {
      conditions.push('w.type = $wineType');
      parameters.wineType = preferences.wineType;
    }

    if (preferences.sweetness) {
      conditions.push('w.sweetness = $sweetness');
      parameters.sweetness = preferences.sweetness;
    }

    if (preferences.priceRange) {
      conditions.push('w.price >= $minPrice AND w.price <= $maxPrice');
      parameters.minPrice = preferences.priceRange[0];
      parameters.maxPrice = preferences.priceRange[1];
    }


    // TODO: Enhance foodPairing logic to support multiple ingredients, flavor profiles, and more nuanced matching.
    // Current implementation assumes a direct match to a single Food node by name.
    if (preferences.foodPairing) {
        // This requires matching a Food node and then finding paired wines
        // This makes a single MATCH clause more complex.
        // Let's simplify for the minimum implementation and assume foodPairing in preferences
        // is a string that can be matched against a property on the Wine node or a related Food node.
        // For now, let's assume a direct relationship to a Food node by name.
        query += ' MATCH (w)-[:PAIRS_WITH]->(f:Food)';
        conditions.push('f.name = $foodPairing');
        parameters.foodPairing = preferences.foodPairing;
    }


    // Excluding allergens requires a different pattern, potentially a negative match
    if (preferences.excludeAllergens && preferences.excludeAllergens.length > 0) {
        // This is more complex and might require a WHERE NOT EXISTS or a separate match and filter
        // For minimum implementation, let's skip excludeAllergens for now or add a basic placeholder
        this.logger.warn('Excluding allergens is not yet fully implemented.');
        // TODO: Implement allergen exclusion logic
    }


    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' RETURN w';

    this.logger.debug('KnowledgeGraphService - findWinesByPreferences query:', query);
    this.logger.debug('KnowledgeGraphService - findWinesByPreferences parameters:', parameters);


    const wines = await this.neo4j.executeQuery<WineNode>(query, parameters);

    this.logger.debug('KnowledgeGraphService - findWinesByPreferences after executeQuery:', wines);

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

    this.logger.debug('KnowledgeGraphService - findWinesByType after executeQuery:', wines);

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
async addOrUpdatePreference(userId: string, preference: PreferenceNode): Promise<void> {
    const query = `
      MERGE (u:User {id: $userId})
      MERGE (p:Preference {type: $type, value: $value})
      ON CREATE SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active
      ON MATCH SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active
      MERGE (u)-[:HAS_PREFERENCE]->(p)
    `;
    await this.neo4j.executeQuery(query, {
      userId,
      type: preference.type,
      value: preference.value,
      source: preference.source,
      confidence: preference.confidence,
      timestamp: preference.timestamp,
      active: preference.active,
    });
  }

  async getPreferences(userId: string, includeInactive: boolean = false): Promise<PreferenceNode[]> {
    let query = `
      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)
    `;
    if (!includeInactive) {
      query += ` WHERE p.active = true`;
    }
    query += ` RETURN p`;

    const results = await this.neo4j.executeQuery<PreferenceNode>(query, { userId });
    return results.map((record: any) => record.p as PreferenceNode);
  }

  async deletePreference(userId: string, preferenceId: string): Promise<void> {
    const query = `
      MATCH (u:User {id: $userId})-[r:HAS_PREFERENCE]->(p:Preference)
      WHERE p.id = $preferenceId
      DELETE r, p
    `;
    await this.neo4j.executeQuery(query, { userId, preferenceId });
  }
}
