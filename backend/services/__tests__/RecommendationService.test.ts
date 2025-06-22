import { RecommendationService } from '../RecommendationService'; // Import service
import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../../api/dtos/SearchRequest.dto';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Neo4jService } from '../Neo4jService';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import winston from 'winston'; // Import winston for logger type

const mockWines = [
  {
    id: 'wine-1', // Add id for ranking tests
    name: 'Merlot Reserve',
    region: 'Bordeaux',
    price: 45,
    vintage: 2018
  },
  {
    id: 'wine-2', // Add id for ranking tests
    name: 'Chardonnay',
    region: 'Napa Valley',
    price: 32,
    vintage: 2020
  },
  {
    id: 'wine-3', // Add id for ranking tests
    name: 'Pinot Noir',
    region: 'Burgundy',
    price: 58,
    vintage: 2019
  }
];

let mockNeo4j: DeepMockProxy<Neo4jService>;
let mockKnowledgeGraph: DeepMockProxy<KnowledgeGraphService>;
let mockLogger: DeepMockProxy<winston.Logger>; // Use winston.Logger type
let mockStrategies: { execute: jest.Mock }[];
let recommendationService: RecommendationService;

// Valid mock data for requests
const validRecommendationRequest: RecommendationRequest = {
  userId: 'user-123',
  input: {
    preferences: {
      wineType: 'red',
      priceRange: [10, 50],
      foodPairing: 'pasta',
      excludeAllergens: ['sulfites']
    },
    message: 'Looking for a nice red wine.',
    recommendationSource: 'knowledgeGraph'
  },
  conversationHistory: []
};

const validSearchRequest: SearchRequest = {
  query: 'Merlot',
  region: 'Bordeaux',
  minPrice: 10,
  maxPrice: 100,
  page: 1,
  limit: 10,
  offset: 0
};

beforeEach(() => {
  mockNeo4j = mockDeep<Neo4jService>();
  mockKnowledgeGraph = mockDeep<KnowledgeGraphService>();
  mockLogger = mockDeep<winston.Logger>();

  // Create mock strategies for each strategy type
  const mockStrategy1 = { execute: jest.fn() } as any;
  const mockStrategy2 = { execute: jest.fn() } as any;
  const mockStrategy3 = { execute: jest.fn() } as any;
  mockStrategies = [mockStrategy1, mockStrategy2, mockStrategy3];

  // Instantiate service with injected mocks
  recommendationService = new RecommendationService(
    mockNeo4j,
    mockKnowledgeGraph,
    mockLogger,
    mockStrategies as any
  );
});

// Test for getRecommendations
test('should execute strategies and return combined and ranked recommendations', async () => {
  const request = validRecommendationRequest;

  // Mock the execute method of the injected strategies
  mockStrategies[0].execute.mockResolvedValue([mockWines[0], mockWines[1]]);
  mockStrategies[1].execute.mockResolvedValue([mockWines[1], mockWines[2]]);
  mockStrategies[2].execute.mockResolvedValue([]);

  // Mock KnowledgeGraphService methods used in rankRecommendations
  mockKnowledgeGraph.findSimilarWines.mockResolvedValue([]); // Simplify for this test
  mockKnowledgeGraph.getWinePairings.mockResolvedValue([]); // Simplify for this test

  const result = await recommendationService.getRecommendations(request);

  // Expect execute to have been called on each strategy
  mockStrategies.forEach(strategy => {
    expect(strategy.execute).toHaveBeenCalledWith(request);
  });

  // Verify all expected wines are present with calculated scores
  // Verify all expected wines are present with calculated scores
  const resultWineIds = result.map((w: any) => w.id);
  expect(resultWineIds).toEqual(expect.arrayContaining(['wine-1', 'wine-2', 'wine-3']));
  
  // Verify scores account for knowledge graph bonuses
  result.forEach((wine: any) => {
    expect(wine.score).toBeDefined();
    expect(typeof wine.score).toBe('number');
    // Base score is 1 + 0.5 per similar wine + 0.3 per pairing
    expect(wine.score).toBeGreaterThanOrEqual(1);
  });
});

test('should handle empty recommendation request by throwing an error', async () => {
  const request: RecommendationRequest = {
    userId: '',
    input: {
      preferences: undefined, // No preferences
      message: '', // No message
      recommendationSource: 'knowledgeGraph'
    },
    conversationHistory: []
  };

  mockStrategies.forEach(strategy => {
    strategy.execute.mockResolvedValue([]);
  });

  await expect(recommendationService.getRecommendations(request)).rejects.toThrow('Invalid request: Please provide some preferences or a message.');
  expect(mockLogger.warn).toHaveBeenCalledWith('RecommendationService: Received empty or invalid recommendation request.');
});

test('should handle errors in strategies by re-throwing the error', async () => {
  const request = validRecommendationRequest;
  const strategyError = new Error('Strategy failed');

  // Mock one strategy to reject
  mockStrategies[0].execute.mockRejectedValue(strategyError);
  // Mock other strategies to resolve (to ensure the error from the first is propagated)
  mockStrategies[1].execute.mockResolvedValue([]);
  mockStrategies[2].execute.mockResolvedValue([]);


  await expect(recommendationService.getRecommendations(request)).rejects.toThrow('Strategy failed');
  expect(mockLogger.error).toHaveBeenCalledWith('RecommendationService: Error getting recommendations:', strategyError);
});

test('should search wines with valid parameters by calling Neo4jService', async () => {
  const params = validSearchRequest;
  mockNeo4j.executeQuery.mockResolvedValue(mockWines);

  const result = await recommendationService.searchWines(params);

  // Expect executeQuery to have been called with the correct query and parameters
  expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
    expect.stringMatching(/MATCH\s*\(w:Wine\)\s*WHERE\s*w\.name\s*CONTAINS\s*\$\s*query\s*AND\s*w\.region\s*=\s*\$\s*region\s*AND\s*w\.price\s*>=\s*\$\s*minPrice\s*AND\s*w\.price\s*<=\s*\$\s*maxPrice\s*RETURN\s*w\s*SKIP\s*\$\s*skip\s*LIMIT\s*\$\s*limit/i),
    {
      query: 'Merlot',
      region: 'Bordeaux',
      minPrice: 10,
      maxPrice: 100,
      skip: 0,
      limit: 10
    }
  );
  expect(result.data).toEqual(mockWines);
  expect(result.pagination).toEqual({
    page: 1,
    limit: 10,
    total: mockWines.length // Simple total estimation based on mock data
  });
  expect(mockLogger.info).toHaveBeenCalledWith('RecommendationService: Searching wines with params:', params);
});

test('should handle errors during wine search by re-throwing the error', async () => {
  const params = validSearchRequest;
  const searchError = new Error('Neo4j search failed');
  mockNeo4j.executeQuery.mockRejectedValue(searchError);

  await expect(recommendationService.searchWines(params)).rejects.toThrow('Neo4j search failed');
  expect(mockLogger.error).toHaveBeenCalledWith('RecommendationService: Error searching wines:', searchError);
});

// Add tests for rankRecommendations method
describe('rankRecommendations', () => {
    // Since rankRecommendations is private, we need to access it for testing.
    // A common approach is to cast the service instance to 'any' or define a test-specific interface.
    // Using 'any' for simplicity in this example.
    let rankRecommendationsMethod: (wines: any[]) => Promise<any[]>;
    let recommendationService: any;
    let mockKnowledgeGraph: any;
    let mockLogger: any;

    beforeEach(() => {
        // Create mocks for dependencies
        mockKnowledgeGraph = {
            findSimilarWines: jest.fn(),
            getWinePairings: jest.fn(),
        };
        mockLogger = mockDeep<winston.Logger>();

        // Create the RecommendationService instance with all required mocks
        const RecommendationService = require('../RecommendationService').RecommendationService;
        const mockNeo4j = {
            executeQuery: jest.fn()
        };
        recommendationService = new RecommendationService(
            mockNeo4j,
            mockKnowledgeGraph,
            mockLogger,
            [] // Empty strategies array since we're testing ranking directly
        );

        // Get the private method using bracket notation and cast to any
        rankRecommendationsMethod = (recommendationService as any).rankRecommendations.bind(recommendationService);

        // Mock KnowledgeGraphService methods used in rankRecommendations
        mockKnowledgeGraph.findSimilarWines.mockResolvedValue([]);
        mockKnowledgeGraph.getWinePairings.mockResolvedValue([]);
    });

    it('should rank wines by frequency', async () => {
        const wines = [
            { id: 'wine-a' },
            { id: 'wine-b' },
            { id: 'wine-a' }, // wine-a appears twice
            { id: 'wine-c' },
            { id: 'wine-b' }, // wine-b appears twice
            { id: 'wine-a' }, // wine-a appears three times
        ];

        const ranked = await rankRecommendationsMethod(wines);

        // Expect wine-a to be first (highest frequency)
        expect(ranked[0].id).toBe('wine-a');
        // Remaining wines should include wine-b and wine-c
        expect(ranked.map(w => w.id)).toEqual(expect.arrayContaining(['wine-b', 'wine-c']));
    });

    it('should enhance scores based on similar and pairing relationships', async () => {
        const wines = [
            { id: 'wine-a' },
            { id: 'wine-b' },
        ];

        // Mock KnowledgeGraphService methods to return relationships
        mockKnowledgeGraph.findSimilarWines.mockImplementation(async (wineId: string) => {
            if (wineId === 'wine-a') return [{ id: 'wine-x', name: 'Mock Wine X', type: 'red', region: 'Mock Region' }]; // Add missing properties

        });
        mockKnowledgeGraph.getWinePairings.mockImplementation(async (wineId: string) => {
            if (wineId === 'wine-a') return [{ id: 'wine-x', name: 'Mock Wine X', type: 'red', region: 'Mock Region' }]; // Add missing properties

        });

        const ranked = await rankRecommendationsMethod(wines);

        // Initial scores: wine-a=1, wine-b=1
        // Enhanced scores: wine-a = 1 + 1*0.5 + 0*0.3 = 1.5
        //                   wine-b = 1 + 0*0.5 + 2*0.3 = 1 + 0.6 = 1.6
        // Expect enhanced scores to affect ranking
        expect(ranked[0].score).toBeGreaterThan(ranked[1].score);

        expect(mockKnowledgeGraph.findSimilarWines).toHaveBeenCalledWith('wine-a');
        expect(mockKnowledgeGraph.findSimilarWines).toHaveBeenCalledWith('wine-b');
        expect(mockKnowledgeGraph.getWinePairings).toHaveBeenCalledWith('wine-a');
        expect(mockKnowledgeGraph.getWinePairings).toHaveBeenCalledWith('wine-b');
    });

    it('should handle errors during score enhancement', async () => {
        const wines = [
            { id: 'wine-a' },
            { id: 'wine-b' },
        ];

        // Mock KnowledgeGraphService method to reject for one wine
        mockKnowledgeGraph.findSimilarWines.mockImplementation(async (wineId: string) => {
            if (wineId === 'wine-a') throw new Error('Enhancement failed');
            return [];
        });
        mockKnowledgeGraph.getWinePairings.mockResolvedValue([]);

        const ranked = await rankRecommendationsMethod(wines);

        // Expect both wines to still be present, even if enhancement failed for one
        expect(ranked.length).toBe(2);
        expect(ranked.map((w: any) => w.id)).toEqual(expect.arrayContaining(['wine-a', 'wine-b']));
        // The order might depend on initial frequency if enhancement failed.
        // Initial frequency is 1 for both. Order is not guaranteed.
        // Just check that the error was logged.
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('RecommendationService: Error enhancing score for wine wine-a:'), expect.any(Error));
    });
});
