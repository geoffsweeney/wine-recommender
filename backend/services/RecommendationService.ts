import { injectable, inject } from 'tsyringe';
import { Neo4jService } from './Neo4jService';
import { KnowledgeGraphService } from './KnowledgeGraphService';
import winston from 'winston';
import { RecommendationRequest } from '../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../api/dtos/SearchRequest.dto';
import { IRecommendationStrategy } from './interfaces/IRecommendationStrategy';
import { TYPES } from '../di/Types';
import { WineRecommendation, RankedWineRecommendation } from '../types';

@injectable()
export class RecommendationService {
    constructor(
        @inject(Neo4jService) private neo4jService: Neo4jService,
        @inject(TYPES.KnowledgeGraphService) private knowledgeGraph: KnowledgeGraphService,
        @inject('logger') private logger: winston.Logger,
        @inject(TYPES.IRecommendationStrategy) private strategies: IRecommendationStrategy[]
    ) {}

    async getRecommendations(request: RecommendationRequest): Promise<RankedWineRecommendation[]> {
        if (!request.input || (!request.input.preferences && !request.input.message?.trim())) {
            this.logger.warn('RecommendationService: Received empty or invalid recommendation request.');
            throw new Error('Invalid request: Please provide some preferences or a message.');
        }

        try {
            // Execute all strategies in parallel
            const results = await Promise.all(
                this.strategies.map(strategy => strategy.execute(request))
            );
            const allWines = results.flat();

            // Rank recommendations (deduplication happens inside ranking)
            return this.rankRecommendations(allWines);
        } catch (error) {
            this.logger.error('RecommendationService: Error getting recommendations:', error);
            throw error;
        }
    }

    async searchWines(params: SearchRequest): Promise<any> {
        try {
            this.logger.info('RecommendationService: Searching wines with params:', params);
            
            const query = `
                MATCH (w:Wine)
                WHERE w.name CONTAINS $query AND w.region = $region
                AND w.price >= $minPrice AND w.price <= $maxPrice
                RETURN w
                SKIP $skip
                LIMIT $limit
            `;
            
            const result = await this.neo4jService.executeQuery(query, {
                query: params.query,
                region: params.region,
                minPrice: params.minPrice,
                maxPrice: params.maxPrice,
                skip: params.offset,
                limit: params.limit
            });
            
            return {
                data: result,
                pagination: {
                    page: params.page,
                    limit: params.limit,
                    total: result.length // Simplified total count
                }
            };
        } catch (error) {
            this.logger.error('RecommendationService: Error searching wines:', error);
            throw error;
        }
    }

    private deduplicateWines(wines: WineRecommendation[]): WineRecommendation[] {
        const seen = new Set();
        return wines.filter(wine => {
            const key = wine.id;
            if (!seen.has(key)) {
                seen.add(key);
                return true;
            }
            return false;
        });
    }

    private async rankRecommendations(wines: WineRecommendation[]): Promise<RankedWineRecommendation[]> {
        try {
            // Count frequencies before deduplication
            const frequencyMap = wines.reduce((map, wine) => {
                map.set(wine.id, (map.get(wine.id) || 0) + 1);
                return map;
            }, new Map<string, number>());

            // Deduplicate first
            const uniqueWines = this.deduplicateWines(wines);
            
            // Enhance scores with knowledge graph data
            const enhancedWines = await Promise.all(uniqueWines.map(async (wine: WineRecommendation) => {
                try {
                    const similarWines = await this.knowledgeGraph.findSimilarWines(wine.id);
                    const pairings = await this.knowledgeGraph.getWinePairings(wine.id);
                    
                    // Add bonus points for relationships
                    let score = frequencyMap.get(wine.id) || 1;
                    score += similarWines.length * 0.5;
                    score += pairings.length * 0.3;
                    
                    return { ...wine, score };
                } catch (error) {
                    this.logger.error(`RecommendationService: Error enhancing score for wine ${wine.id}:`, error);
                    return { ...wine, score: frequencyMap.get(wine.id) || 1 };
                }
            }));
            
            // Calculate finalScore (initially same as score)
            const withFinalScore = enhancedWines.map(wine => ({
                ...wine,
                finalScore: wine.score || 0
            }));

            // Sort by finalScore descending and add ranking
            return withFinalScore
                .sort((a, b) => b.finalScore - a.finalScore)
                .map((wine, index) => ({
                    ...wine,
                    rank: index + 1
                }));
        } catch (error) {
            this.logger.error('RecommendationService: Error ranking recommendations:', error);
            return [];
        }
    }
}
