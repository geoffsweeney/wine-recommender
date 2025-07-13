import { injectable, inject } from 'tsyringe';
import { IRecommendationStrategy } from '../interfaces/IRecommendationStrategy';
import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { TYPES } from '../../di/Types';
import { logger } from '../../utils/logger';
import { Neo4jService } from '../Neo4jService';

@injectable()
export class PopularWinesStrategy implements IRecommendationStrategy {
    constructor(
        @inject(Neo4jService) private neo4jService: Neo4jService,
        @inject(TYPES.KnowledgeGraphService) private knowledgeGraph: KnowledgeGraphService
    ) {}

    async execute(request: RecommendationRequest): Promise<any[]> {
        logger.info('Executing PopularWinesStrategy');
        // TODO: Implement actual recommendation logic
        return [];
    }
}
