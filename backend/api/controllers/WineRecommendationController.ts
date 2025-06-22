import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { inject, injectable } from 'tsyringe';
import { TYPES } from '../../di/Types';
import { IRecommendationStrategy } from '../../services/interfaces/IRecommendationStrategy';
import { ISearchStrategy } from '../../services/interfaces/ISearchStrategy';
import { LLMService } from '../../services/LLMService';
import { RecommendationRequest } from '../dtos/RecommendationRequest.dto';
import { SearchRequest } from '../dtos/SearchRequest.dto';
import { ILogger } from '../../services/LLMService';

@injectable()
export class WineRecommendationController extends BaseController {
  constructor(
    @inject(TYPES.IRecommendationStrategy) private recommendationStrategy: IRecommendationStrategy,
    @inject(TYPES.ISearchStrategy) private searchStrategy: ISearchStrategy,
    @inject(TYPES.LLMService) private llmService: LLMService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(req: Request, res: Response): Promise<void> {
    const { method } = req;
    this.logger.info(`Received wine recommendation request [${method}]`, { body: req.body, query: req.query });

    try {
      switch (method) {
        case 'POST':
          const request = req.validatedBody as RecommendationRequest; // Use validatedBody
          const results = await this.recommendationStrategy.execute(request);
          this.logger.debug('Recommendation results', { results });
          this.ok(res, results);
          break;

        case 'GET':
          const searchParams = req.validatedQuery as SearchRequest; // Use validatedQuery
          const searchResults = await this.searchStrategy.execute(searchParams);
          this.ok(res, searchResults);
          break;

        default:
          this.fail(res, 'Method not allowed', 405);
      }
    } catch (err) {
      this.logger.error('Failed to process wine request', {
        error: err,
        method,
        body: req.body,
        query: req.query
      });
      this.fail(res, err instanceof Error ? err.message : 'Failed to process request'); // Use the actual error message
    }
  }
}