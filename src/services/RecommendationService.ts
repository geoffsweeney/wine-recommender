import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';
import { KnowledgeGraphService } from './KnowledgeGraphService';
import { RecommendationRequest } from '../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../api/dtos/SearchRequest.dto';
import { logger } from '../utils/logger'; // Import the logger
import winston from 'winston'; // Import winston for logger type

export interface IRecommendationStrategy {
  getRecommendations(request: RecommendationRequest): Promise<any[]>;
}

@injectable()
export class RecommendationService {
  private strategies: IRecommendationStrategy[] = [];

  constructor(
    @inject('Neo4jService') private neo4jService: Neo4jService,
    @inject('KnowledgeGraphService') private knowledgeGraph: KnowledgeGraphService,
    @inject('logger') private logger: winston.Logger // Inject the logger
  ) {
    // Initialize strategies
    this.strategies = [
      new UserPreferencesStrategy(neo4jService, knowledgeGraph),
      new CollaborativeFilteringStrategy(neo4jService, knowledgeGraph),
      new PopularWinesStrategy(neo4jService, knowledgeGraph, this.logger)
    ];
  }

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    this.logger.info('RecommendationService: Getting recommendations for request:', request); // Log start

    // Basic validation: Check if preferences are provided in the input
    const hasPreferences = request.input.preferences && (
      request.input.preferences.wineType ||
      (request.input.preferences.priceRange && (request.input.preferences.priceRange[0] > 0 || request.input.preferences.priceRange[1] < Infinity)) || // Check if price range is meaningful
      request.input.preferences.foodPairing ||
      (request.input.preferences.excludeAllergens && request.input.preferences.excludeAllergens.length > 0)
    );

    // Also consider if there's a message in the input
    if (!hasPreferences && !request.input.message) {
       this.logger.warn('RecommendationService: Received empty or invalid recommendation request.');
       throw new Error('Invalid request: Please provide some preferences or a message.');
    }

    try {
      const allResults = await Promise.all(
        this.strategies.map(strategy => strategy.getRecommendations(request))
      );
      this.logger.info('RecommendationService: Received results from all strategies.'); // Log after strategies
      const rankedResults = await this.rankRecommendations(allResults.flat());
      this.logger.info('RecommendationService: Recommendations ranked successfully.'); // Log after ranking
      return rankedResults;
    } catch (error) {
      this.logger.error('RecommendationService: Error getting recommendations:', error); // Log error
      throw error; // Re-throw the error so the controller can catch it
    }
  }

  async searchWines(params: SearchRequest): Promise<any> {
    this.logger.info('RecommendationService: Searching wines with params:', params); // Log start
    try {
      // Build search query dynamically
      let cypher = 'MATCH (w:Wine) WHERE ';
      const queryParams: Record<string, any> = {};

      if (params.query) {
        cypher += 'w.name CONTAINS $query ';
        queryParams.query = params.query;
      }

      if (params.region) {
        cypher += (params.query ? 'AND ' : '') + 'w.region = $region ';
        queryParams.region = params.region;
      }

      if (params.minPrice || params.maxPrice) {
        cypher += (params.query || params.region ? 'AND ' : '') +
          'w.price >= $minPrice AND w.price <= $maxPrice ';
        queryParams.minPrice = params.minPrice || 0;
        queryParams.maxPrice = params.maxPrice || 1000;
      }

      // Validate pagination params
      const pageNum = Math.max(1, params.page || 1);
      const limitNum = Math.min(50, Math.max(1, params.limit || 10));
      const skip = (pageNum - 1) * limitNum;

      cypher += 'RETURN w SKIP $skip LIMIT $limit';
      queryParams.skip = skip;
      queryParams.limit = limitNum;

      this.logger.info('RecommendationService: Executing search query:', cypher, 'with params:', queryParams); // Log query
      const results = await this.neo4jService.executeQuery(cypher, queryParams);
      this.logger.info('RecommendationService: Search query executed successfully, results count:', results.length); // Log results count

      return {
        data: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: results.length === limitNum ? limitNum + 1 : results.length // Simple total estimation
        }
      };
    } catch (error) {
      this.logger.error('RecommendationService: Error searching wines:', error); // Log error
      throw error; // Re-throw the error
    }
  }

  /**
   * Ranks wine recommendations by frequency across different strategy formats
   * @param wines - Array of wine recommendations from different strategies
   * @returns Array of unique wines ranked by frequency (highest first)
   *
   * Handles multiple strategy formats:
   * - { w: {id, name, ...} } format
   * - { rec: {id, name, ...} } format
   * - Direct {id, name, ...} format
   */
  private async rankRecommendations(wines: any[]): Promise<any[]> {
    this.logger.info('RecommendationService: Ranking recommendations, input count:', wines.length); // Log start
    const wineScores = new Map<string, { wine: any, score: number }>();

    // First pass - count basic frequency
    wines.forEach(wine => {
      // Extract wine object based on strategy format
      let wineObj = wine;
      let wineId = wine.id;

      if (wine.w) {
        wineObj = wine.w;
        wineId = wine.w.id;
      } else if (wine.rec) {
        wineObj = wine.rec;
        wineId = wine.rec.id;
      }

      const existing = wineScores.get(wineId) || { wine: wineObj, score: 0 };
      existing.score += 1;
      wineScores.set(wineId, existing);
    });
    this.logger.info('RecommendationService: Initial frequency counting complete, unique wines:', wineScores.size); // Log unique count

    // Second pass - enhance with graph relationships
    const scoredWines = Array.from(wineScores.values());
    for (const item of scoredWines) {
      this.logger.info('RecommendationService: Enhancing score for wine:', item.wine.id); // Log wine being enhanced
      try {
        // Boost score for wines with similar/pairing relationships
        const similar = await this.knowledgeGraph.findSimilarWines(item.wine.id);
        this.logger.info(`RecommendationService: Found ${similar.length} similar wines for ${item.wine.id}`); // Log similar count
        const pairings = await this.knowledgeGraph.getWinePairings(item.wine.id);
        this.logger.info(`RecommendationService: Found ${pairings.length} pairings for ${item.wine.id}`); // Log pairings count
        item.score += similar.length * 0.5;
        item.score += pairings.length * 0.3;
      } catch (error) {
        this.logger.error(`RecommendationService: Error enhancing score for wine ${item.wine.id}:`, error); // Log enhancement error
        // Continue ranking even if enhancement fails for one wine
      }
    }
    this.logger.info('RecommendationService: Score enhancement complete.'); // Log end of enhancement

    const sortedWines = scoredWines
      .sort((a, b) => b.score - a.score)
      .map(item => item.wine);

    this.logger.info('RecommendationService: Recommendations ranked and sorted.'); // Log end of ranking
    return sortedWines;
  }
}

// Strategy Implementations
class UserPreferencesStrategy implements IRecommendationStrategy {
  constructor(
    private neo4jService: Neo4jService,
    private knowledgeGraph: KnowledgeGraphService
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    // Use preferences from the request to find wines in the knowledge graph
    if (!request.input.preferences) {
      return []; // Return empty if no preferences are provided
    }
    // Assuming findWinesByPreferences can handle the structure of request.input.preferences
    return this.knowledgeGraph.findWinesByPreferences(request.input.preferences);
  }
}

class CollaborativeFilteringStrategy implements IRecommendationStrategy {
  constructor(
    private neo4jService: Neo4jService,
    private knowledgeGraph: KnowledgeGraphService
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    // Implementation...
    return []; // Placeholder
  }
}

class PopularWinesStrategy implements IRecommendationStrategy {
  constructor(
    @inject('Neo4jService') private neo4jService: Neo4jService,
    @inject('KnowledgeGraphService') private knowledgeGraph: KnowledgeGraphService,
    @inject('logger') private logger: winston.Logger // Inject the logger
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    // Basic validation: Check if preferences are provided in the input (similar to main service)
    const hasPreferences = request.input.preferences && (
      request.input.preferences.wineType ||
      (request.input.preferences.priceRange && (request.input.preferences.priceRange[0] > 0 || request.input.preferences.priceRange[1] < Infinity)) ||
      request.input.preferences.foodPairing ||
      (request.input.preferences.excludeAllergens && request.input.preferences.excludeAllergens.length > 0)
    );

    // Also consider if there's a message in the input
    if (!hasPreferences && !request.input.message) {
       this.logger.warn('PopularWinesStrategy: Received empty or invalid recommendation request.');
       throw new Error('Invalid request: Please provide some preferences or a message.'); // Throw error for invalid requests
    }

    // Placeholder implementation returning a hardcoded popular wine for valid requests
    this.logger.info('PopularWinesStrategy: Returning placeholder recommendation for valid request.');
    return [{ id: 'wine-123', name: 'Popular Red Wine', region: 'Bordeaux', price: 25 }];
  }
}