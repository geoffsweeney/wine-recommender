import { injectable, inject } from 'tsyringe';
import { IRecommendationStrategy } from '../interfaces/IRecommendationStrategy';
import { UserPreferencesStrategy } from './UserPreferencesStrategy';
import { CollaborativeFilteringStrategy } from './CollaborativeFilteringStrategy';
import { PopularWinesStrategy } from './PopularWinesStrategy';
import { TYPES } from '../../di/Types';

import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto'; // Import RecommendationRequest

@injectable()
export class RecommendationStrategyProvider implements IRecommendationStrategy { // Implement IRecommendationStrategy
    private strategies: IRecommendationStrategy[];

    constructor(
        @inject(TYPES.UserPreferencesStrategy) private userPreferencesStrategy: UserPreferencesStrategy, // Make private
        @inject(TYPES.CollaborativeFilteringStrategy) private collaborativeFilteringStrategy: CollaborativeFilteringStrategy, // Make private
        @inject(TYPES.PopularWinesStrategy) private popularWinesStrategy: PopularWinesStrategy // Make private
    ) {
        this.strategies = [
            this.userPreferencesStrategy,
            this.collaborativeFilteringStrategy,
            this.popularWinesStrategy
        ];
    }

    // Implement the execute method from IRecommendationStrategy
    async execute(request: RecommendationRequest): Promise<any[]> {
        // For simplicity, let's always use UserPreferencesStrategy for now
        // In a real scenario, you would have logic to select the appropriate strategy
        console.log('RecommendationStrategyProvider: Executing UserPreferencesStrategy');
        return this.userPreferencesStrategy.execute(request);
    }

    getStrategies(): IRecommendationStrategy[] {
        return this.strategies;
    }
}