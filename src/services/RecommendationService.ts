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
  private rankRecommendations(wines: any[]): any[] {
    const wineScores = new Map<string, { wine: any, score: number }>();
    
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
      OPTIONAL MATCH (w)-[:HAS_TASTING_NOTES]->(n:TastingNote)
      WITH w, COLLECT(DISTINCT n) as notes
      RETURN w, notes
      ORDER BY SIZE(notes) DESC
      LIMIT 10
    `;
    const results = await this.neo4jService.executeQuery(query, { userId: request.userId });
    return results.map(r => ({
      ...r.w,
      tastingNotes: r.notes
    }));
  }
}

class CollaborativeFilteringStrategy implements IRecommendationStrategy {
  constructor(private neo4jService: Neo4jService) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:PREFERS]->(w:Wine)<-[:PREFERS]-(other:User)
      WHERE other <> u
      WITH other, COUNT(w) AS commonWines
      ORDER BY commonWines DESC
      LIMIT 5
      
      MATCH (other)-[:PREFERS]->(rec:Wine)
      WHERE NOT (u)-[:PREFERS]->(rec)
      WITH rec, COUNT(other) AS score, AVG(commonWines) AS avgCommon
      RETURN rec, score, avgCommon
      ORDER BY score * avgCommon DESC
      LIMIT 10
    `;
    const results = await this.neo4jService.executeQuery(query, { userId: request.userId });
    return results.map(r => ({
      ...r.rec,
      score: r.score,
      confidence: r.avgCommon
    }));
  }
}

class PopularWinesStrategy implements IRecommendationStrategy {
  constructor(private neo4jService: Neo4jService) {}

  async getRecommendations(request: RecommendationRequest): Promise<any[]> {
    const query = `
      MATCH (u:User)-[r:PREFERS]->(w:Wine)
      WHERE datetime().epochMillis - r.timestamp < 2592000000 // Last 30 days
      WITH w, COUNT(u) AS recentPopularity
      ORDER BY recentPopularity DESC
      LIMIT 20
      
      MATCH (u:User)-[r:PREFERS]->(w)
      RETURN w,
        COUNT(u) AS totalPopularity,
        recentPopularity,
        recentPopularity * 1.5 + COUNT(u) * 0.5 AS weightedScore
      ORDER BY weightedScore DESC
      LIMIT 10
    `;
    const results = await this.neo4jService.executeQuery(query);
    return results.map(r => ({
      ...r.w,
      popularity: r.totalPopularity,
      recentPopularity: r.recentPopularity
    }));
  }
}