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

    if (preferences.country) {
      conditions.push('w.region = $country');
      parameters.country = preferences.country;
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


async findWinesByCombinedCriteria(ingredients: string[], preferences: UserPreferences): Promise<WineNode[]> {
    this.logger.debug('KnowledgeGraphService: Finding wines by combined criteria:', { ingredients, preferences });

    if ((!ingredients || ingredients.length === 0) && (!preferences || Object.keys(preferences).length === 0)) {
      this.logger.debug('KnowledgeGraphService: No ingredients or preferences provided for combined search, returning empty array.');
      return [];
    }

    let query = 'MATCH (w:Wine)';
    const parameters: any = {};
    const conditions: string[] = [];

    // Add ingredient matching
    if (ingredients && ingredients.length > 0) {
      query += ' MATCH (w)<-[:PAIRS_WITH]-(i:Ingredient) WHERE i.name IN $ingredients'; // Filter ingredients first
      parameters.ingredients = ingredients;
      // Ensure all ingredients are matched
      query += ' WITH w, COLLECT(DISTINCT i.name) as matchedIngredients';
      // Replace apoc.coll.intersection with standard Cypher for checking all ingredients are matched
      conditions.push('ALL(ing IN $ingredients WHERE ing IN matchedIngredients)');
    }

    // Add preference matching
    if (preferences && Object.keys(preferences).length > 0) {
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
      if (preferences.foodPairing) {
        query += ' MATCH (w)-[:PAIRS_WITH]->(f:Food)';
        conditions.push('f.name = $foodPairing');
        parameters.foodPairing = preferences.foodPairing;
      }
      if (preferences.country) {
        conditions.push('w.region = $country');
        parameters.country = preferences.country;
      }
      // Add wine characteristics from food pairing
      if (preferences.wineCharacteristics) {
        for (const charType in preferences.wineCharacteristics) {
          if (Object.prototype.hasOwnProperty.call(preferences.wineCharacteristics, charType)) {
            const values = preferences.wineCharacteristics[charType];
            if (values && values.length > 0) {
              // Assuming wine properties match characteristic types (e.g., w.color, w.style)
              conditions.push(`w.${charType} IN $${charType}`);
              parameters[charType] = values;
            }
          }
        }
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' RETURN w';

    this.logger.debug(`KnowledgeGraphService - findWinesByCombinedCriteria query: ${query}`);
    this.logger.debug(`KnowledgeGraphService - findWinesByCombinedCriteria parameters: ${JSON.stringify(parameters)}`);

    const wines = await this.neo4j.executeQuery<WineNode>(query, parameters);

    this.logger.debug(`KnowledgeGraphService - findWinesByCombinedCriteria found ${wines.length} wines: ${JSON.stringify(wines)}`);

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

  async findWinesByName(wineNames: string[]): Promise<WineNode[]> {
    if (!wineNames || wineNames.length === 0) {
      return [];
    }
    const wines = await this.neo4j.executeQuery<WineNode>(`
       MATCH (w:Wine)
       WHERE w.name IN $wineNames
       RETURN w
     `, { wineNames });

    this.logger.debug('KnowledgeGraphService - findWinesByName after executeQuery:', wines);
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
