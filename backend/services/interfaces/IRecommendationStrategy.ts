import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';

export interface IRecommendationStrategy {
  execute(request: RecommendationRequest): Promise<any[]>;
}