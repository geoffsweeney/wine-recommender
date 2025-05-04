import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { inject, injectable } from 'tsyringe';
import { Neo4jService } from '../../services/Neo4jService';

@injectable()
export class WineRecommendationController extends BaseController {
  constructor(
    @inject('Neo4jService') private neo4jService: Neo4jService
  ) {
    super();
  }

  protected async executeImpl(req: Request, res: Response): Promise<void> {
    try {
      const { userId, preferences } = req.body;
      
      // Validate input
      if (!userId || !preferences) {
        this.clientError(res, 'Missing userId or preferences');
        return;
      }

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
}