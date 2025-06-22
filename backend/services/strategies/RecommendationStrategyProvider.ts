import { injectable, inject } from 'tsyringe';
import { IRecommendationStrategy } from '../interfaces/IRecommendationStrategy';
import { UserPreferencesStrategy } from './UserPreferencesStrategy';
import { CollaborativeFilteringStrategy } from './CollaborativeFilteringStrategy';
import { PopularWinesStrategy } from './PopularWinesStrategy';
import { TYPES } from '../../di/Types';

@injectable()
export class RecommendationStrategyProvider {
    private strategies: IRecommendationStrategy[];

    constructor(
        @inject(TYPES.UserPreferencesStrategy) userPreferencesStrategy: UserPreferencesStrategy,
        @inject(TYPES.CollaborativeFilteringStrategy) collaborativeFilteringStrategy: CollaborativeFilteringStrategy,
        @inject(TYPES.PopularWinesStrategy) popularWinesStrategy: PopularWinesStrategy
    ) {
        this.strategies = [
            userPreferencesStrategy,
            collaborativeFilteringStrategy,
            popularWinesStrategy
        ];
    }

    getStrategies(): IRecommendationStrategy[] {
        return this.strategies;
    }
}