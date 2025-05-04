import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { inject, injectable } from 'tsyringe';
import { Neo4jService } from '../../services/Neo4jService';
import { RecommendationRequest } from '../dtos/RecommendationRequest.dto';
import { SearchRequest } from '../dtos/SearchRequest.dto';

@injectable()
export class WineRecommendationController extends BaseController {
  constructor(
    @inject('Neo4jService') private neo4jService: Neo4jService
  ) {
    super();
  }

  protected async executeImpl(req: Request, res: Response): Promise<void> {
    try {
      const { userId, preferences } = req.body as RecommendationRequest;

      // Get recommendations from Neo4j
      const query = `
        MATCH (u:User {id: $userId})-[:PREFERS]->(w:Wine)
        RETURN w
        LIMIT 10
      `;
      const results = await this.neo4jService.executeQuery(query, { userId });
      
      this.ok(res, results);
    } catch (err) {
      this.fail(res, err as Error);
    }
  }

  async searchWines(req: Request, res: Response): Promise<void> {
    try {
      const { query, region, minPrice, maxPrice, page = 1, limit = 10 } = req.query as SearchRequest;
      
      // Build search query dynamically
      let cypher = 'MATCH (w:Wine) WHERE ';
      const params: Record<string, any> = {};
      
      if (query) {
        cypher += 'w.name CONTAINS $query ';
        params.query = query;
      }
      
      if (region) {
        cypher += (query ? 'AND ' : '') + 'w.region = $region ';
        params.region = region;
      }
      
      if (minPrice || maxPrice) {
        cypher += (query || region ? 'AND ' : '') + 'w.price >= $minPrice AND w.price <= $maxPrice ';
        params.minPrice = minPrice || 0;
        params.maxPrice = maxPrice || 1000;
      }
      
      // Validate pagination params
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(50, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      cypher += 'RETURN w SKIP $skip LIMIT $limit';
      params.skip = skip;
      params.limit = limitNum;
      
      const results = await this.neo4jService.executeQuery(cypher, params);
      this.ok(res, {
        data: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: results.length === limitNum ? limitNum + 1 : results.length
        }
      });
    } catch (err) {
      this.fail(res, err as Error);
    }
  }
}