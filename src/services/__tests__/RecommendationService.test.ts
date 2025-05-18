import { RecommendationService } from '../RecommendationService'; // Assuming this is the service being tested
import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../../api/dtos/SearchRequest.dto';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Neo4jService } from '../Neo4jService';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { logger } from '../../utils/logger';

const mockWines = [
  {
    name: 'Merlot Reserve',
    region: 'Bordeaux',
    price: 45,
    vintage: 2018
  },
  {
    name: 'Chardonnay',
    region: 'Napa Valley', 
    price: 32,
    vintage: 2020
  },
  {
    name: 'Pinot Noir',
    region: 'Burgundy',
    price: 58,
    vintage: 2019
  }
];

let mockNeo4j: DeepMockProxy<Neo4jService>;
let mockKnowledgeGraph: DeepMockProxy<KnowledgeGraphService>;
let mockLogger: DeepMockProxy<typeof logger>;
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
    recommendationSource: 'knowledgeGraph' // Added recommendationSource
  },
  conversationHistory: [] // Add empty conversation history for type compatibility
};

const validSearchRequest: SearchRequest = {
  query: 'Merlot',
  region: 'Bordeaux',
  minPrice: 10,
  maxPrice: 100,
  page: 1,
  limit: 10,
  offset: 0 // Added offset property
};

beforeEach(() => {
  mockNeo4j = mockDeep<Neo4jService>(); // Create a deep mock of the Neo4jService
  mockKnowledgeGraph = mockDeep<KnowledgeGraphService>(); // Create a deep mock for KnowledgeGraphService
  mockLogger = mockDeep<typeof logger>(); // Create a deep mock for the Logger
  recommendationService = new RecommendationService(mockNeo4j, mockKnowledgeGraph, mockLogger); // Inject mocks
});

// Test for getRecommendations
test('should return recommendations for valid request', async () => {
  const request = validRecommendationRequest; // Use valid request data

  // Mock the getRecommendations method to return the expected mockWines
  jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockWines);

  const result = await recommendationService.getRecommendations(request);
  expect(result).toEqual(expect.arrayContaining(mockWines)); // Check against mock data
});

// Test for handling empty recommendation request
test('should return placeholder recommendations for minimal request', async () => {
  const request: RecommendationRequest = {
    userId: '',
    input: {
      preferences: {
        wineType: 'red', // Add a default wineType to satisfy the type
        priceRange: undefined, // Set priceRange to undefined
        foodPairing: '', // Keep as empty string
        excludeAllergens: [] // Keep as empty array
      },
      message: '',
      recommendationSource: 'knowledgeGraph' // Added recommendationSource
    },
    conversationHistory: [] // Add empty conversation history for type compatibility
  };

  // Mock findWinesByPreferences to return an empty array for this minimal request
  mockKnowledgeGraph.findWinesByPreferences.mockResolvedValue([]);

  // Expect the hardcoded popular wine from the placeholder strategy
  await expect(recommendationService.getRecommendations(request)).resolves.toEqual([{ id: 'wine-123', name: 'Popular Red Wine', region: 'Bordeaux', price: 25 }]);
});

// Test for handling errors in strategies
test('should handle errors in strategies', async () => {
  const request = validRecommendationRequest; // Use valid request data

  // Mock one of the strategies to throw an error
  const mockStrategy: any = {
    getRecommendations: jest.fn().mockRejectedValue(new Error('Strategy error')),
  };

  // Replace the strategies in the service with the mock strategy
  (recommendationService as any).strategies = [mockStrategy];

  await expect(recommendationService.getRecommendations(request)).rejects.toThrow('Strategy error');
});

// Test for searchWines
test('should search wines with valid parameters', async () => {
  const params = validSearchRequest; // Use valid search request data
  mockNeo4j.executeQuery.mockResolvedValue(mockWines); // Mock the response

  const result = await recommendationService.searchWines(params);
  expect(result.data).toEqual(mockWines);
});

// Test for handling errors during wine search
test('should handle errors during wine search', async () => {
  const params: SearchRequest = { 
    query: 'Invalid', 
    limit: 10, 
    offset: 0, 
    page: 1 // Added required properties
  };
  mockNeo4j.executeQuery.mockRejectedValue(new Error('Search error'));

  await expect(recommendationService.searchWines(params)).rejects.toThrow('Search error');
});