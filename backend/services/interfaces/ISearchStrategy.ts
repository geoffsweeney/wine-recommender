import { SearchRequest } from '../../api/dtos/SearchRequest.dto';

export interface ISearchStrategy {
  execute(request: SearchRequest): Promise<any[]>;
}