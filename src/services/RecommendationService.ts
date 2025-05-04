import { inject, injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';
import { RecommendationRequest } from '../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../api/dtos/SearchRequest.dto';

export interface IRecommendationStrategy {
  getRecommendations(request: RecommendationRequest): Promise<any[]>;
}

@injectable()
export class RecommendationService {
  private strategies: IRecommendationStrategy[] = [];

  constructor(
    @inject('Neo4jService') private neo4jService: Neo4jService
  ) {
    // Initialize strategies
    this.strategies = [
      new UserPreferencesStrategy(neo4jService),
      new CollaborativeFilteringStrategy(neo4jService),
      new PopularWinesStrategy(neo4jService)
    ];
  }

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const allResults = await Promise.all(
      this.strategies.map(strategy => strategy.getRecommendations(request))
    );
    return this.rankRecommendations(allResults.flat());
  }

  async searchWines(params: SearchRequest): Promise<any> {
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
    
    const results = await this.neo4jService.executeQuery(cypher, queryParams);
    
    return {
      data: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: results.length === limitNum ? limitNum + 1 : results.length
      }
    };
  }

  private rankRecommendations(wines: any[]): any[] {
    const wineScores = new Map<string, { wine: any, score: number }>();
    
    wines.forEach(wine => {
      const existing = wineScores.get(wine.id) || { wine, score: 0 };
      existing.score += 1;
      wineScores.set(wine.id, existing);
    });

    return Array.from(wineScores.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.wine);
  }
}

// Strategy Implementations
class UserPreferencesStrategy implements IRecommendationStrategy {
  constructor(private neo4jService: Neo4jService) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:PREFERS]->(w:Wine)
      RETURN w
      LIMIT 10
    `;
    return this.neo4jService.executeQuery(query, { userId: request.userId });
  }
}

class CollaborativeFilteringStrategy implements IRecommendationStrategy {
  constructor(private neo4jService: Neo4jService) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:PREFERS]->(w:Wine)<-[:PREFERS]-(other:User)
      MATCH (other)-[:PREFERS]->(rec:Wine)
      WHERE NOT (u)-[:PREFERS]->(rec)
      RETURN rec, COUNT(other) as score
      ORDER BY score DESC
      LIMIT 10
    `;
    return this.neo4jService.executeQuery(query, { userId: request.userId });
  }
}

class PopularWinesStrategy implements IRecommendationStrategy {
  constructor(private neo4jService: Neo4jService) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const query = `
      MATCH (u:User)-[:PREFERS]->(w:Wine)
      RETURN w, COUNT(u) as popularity
      ORDER BY popularity DESC
      LIMIT 10
    `;
    return this.neo4jService.executeQuery(query);
  }
}