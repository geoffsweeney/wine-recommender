import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { inject, injectable } from 'tsyringe';
import { RecommendationService } from '../../services/RecommendationService';
import { RecommendationRequest } from '../dtos/RecommendationRequest.dto';
import { SearchRequest } from '../dtos/SearchRequest.dto';

@injectable()
export class WineRecommendationController extends BaseController {
  constructor(
    @inject('RecommendationService') private recommendationService: RecommendationService
  ) {
    super();
  }

  protected async executeImpl(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as unknown as RecommendationRequest;
      const results = await this.recommendationService.getRecommendations(request);
      this.ok(res, results);
    } catch (err) {
      this.fail(res, err as Error);
    }
  }

  async searchWines(req: Request, res: Response): Promise<void> {
    try {
      const searchParams = req.query as unknown as SearchRequest;
      const results = await this.recommendationService.searchWines(searchParams);
      this.ok(res, results);
    } catch (err) {
      this.fail(res, err as Error);
    }
  }
}