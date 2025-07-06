import { inject, injectable } from 'tsyringe';
import { SearchRequest } from '../api/dtos/SearchRequest.dto';
import { ILogger, TYPES } from '../di/Types';
import { ISearchStrategy } from './interfaces/ISearchStrategy';
import { IWineRepository } from './interfaces/IWineRepository';

@injectable()
export class SimpleSearchStrategy implements ISearchStrategy {
  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.WineRepository) private wineRepository: IWineRepository
  ) {}

  async execute(request: SearchRequest): Promise<any[]> {
    try {
      this.logger.debug('Executing simple search strategy', { request });
      
      if (!request.query) {
        return await this.wineRepository.getAllWines();
      }

      let searchCriteria = {};
      if (typeof request.query === 'string') {
        searchCriteria = { name: request.query };
      } else {
        searchCriteria = {
          name: request.query.name,
          type: request.query.type
        };
      }
      const results = await this.wineRepository.searchWines(searchCriteria);
      this.logger.debug('Search results', { count: results.length });
      return results;
    } catch (error) {
      this.logger.error('Failed to execute search', { error });
      throw error;
    }
  }
}
