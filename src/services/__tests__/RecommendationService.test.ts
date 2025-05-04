import 'reflect-metadata';
import { RecommendationService } from '../RecommendationService';
import { Neo4jService } from '../Neo4jService';
import { RecommendationRequest } from '../../api/dtos/RecommendationRequest.dto';
import { SearchRequest } from '../../api/dtos/SearchRequest.dto';

jest.mock('../Neo4jService');

describe('RecommendationService', () => {
  let service: RecommendationService;
  let mockNeo4j: jest.Mocked<Neo4jService>;

  beforeEach(() => {
    mockNeo4j = new Neo4jService() as jest.Mocked<Neo4jService>;
    mockNeo4j.executeQuery.mockImplementation(async () => []);
    service = new RecommendationService(mockNeo4j);
  });

  describe('getRecommendations', () => {
    it('should combine results from all strategies', async () => {
      const mockResults = [
        [{ w: { id: '1', name: 'Wine 1' }, tastingNotes: [] }],
        [
          { rec: { id: '1', name: 'Wine 1' }, score: 2, confidence: 1 },
          { rec: { id: '2', name: 'Wine 2' }, score: 1, confidence: 1 }
        ],
        [
          { w: { id: '1', name: 'Wine 1' }, popularity: 3, recentPopularity: 2 },
          { w: { id: '3', name: 'Wine 3' }, popularity: 1, recentPopularity: 1 }
        ]
      ];
      mockNeo4j.executeQuery.mockImplementation(async () => mockResults.pop() || []);

      const request: RecommendationRequest = {
        userId: 'user1',
        preferences: {
          wineTypes: [],
          regions: [],
          grapes: []
        }
      };
      const results = await service.getRecommendations(request);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('1'); // Should be first due to duplicate
      expect(mockNeo4j.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should rank recommendations by frequency', async () => {
      const mockResults = [
        [{ w: { id: '1', name: 'Wine 1' }, tastingNotes: [] }],
        [
          { rec: { id: '1', name: 'Wine 1' }, score: 2, confidence: 1 },
          { rec: { id: '2', name: 'Wine 2' }, score: 1, confidence: 1 }
        ],
        [
          { w: { id: '1', name: 'Wine 1' }, popularity: 3, recentPopularity: 2 },
          { w: { id: '3', name: 'Wine 3' }, popularity: 1, recentPopularity: 1 }
        ]
      ];
      mockNeo4j.executeQuery.mockImplementation(async () => mockResults.pop() || []);

      const request: RecommendationRequest = {
        userId: 'user1',
        preferences: {
          wineTypes: [],
          regions: [],
          grapes: []
        }
      };
      const results = await service.getRecommendations(request);

      // Check wine ID from first strategy's format
      expect(results[0].id).toBe('1');
      // Both '2' and '3' have same score so order isn't guaranteed
      expect(['2', '3']).toContain(results[1].id);
      expect(['2', '3']).toContain(results[2].id);
      expect(results[1].id).not.toBe(results[2].id);
    });

    it('should handle empty strategy results', async () => {
      mockNeo4j.executeQuery.mockResolvedValue([]);
      const request: RecommendationRequest = {
        userId: 'user1',
        preferences: {
          wineTypes: [],
          regions: [],
          grapes: []
        }
      };
      const results = await service.getRecommendations(request);
      expect(results).toEqual([]);
    });
  });

  describe('searchWines', () => {
    it('should build basic search query', async () => {
      const mockWines = [{ id: '1', name: 'Test Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(mockWines);

      const request: SearchRequest = { query: 'Test' };
      const result = await service.searchWines(request);

      expect(result.data).toEqual(mockWines);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        'MATCH (w:Wine) WHERE w.name CONTAINS $query RETURN w SKIP $skip LIMIT $limit',
        { query: 'Test', skip: 0, limit: 10 }
      );
    });

    it('should build complex search query with all params', async () => {
      const mockWines = [{ id: '1', name: 'Test Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(mockWines);

      const request: SearchRequest = {
        query: 'Test',
        region: 'Barossa',
        minPrice: 20,
        maxPrice: 100,
        page: 2,
        limit: 5
      };
      const result = await service.searchWines(request);

      expect(result.data).toEqual(mockWines);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('w.name CONTAINS $query AND w.region = $region AND w.price >= $minPrice AND w.price <= $maxPrice'),
        {
          query: 'Test',
          region: 'Barossa',
          minPrice: 20,
          maxPrice: 100,
          skip: 5,
          limit: 5
        }
      );
    });

    it('should handle pagination edge cases', async () => {
      mockNeo4j.executeQuery.mockResolvedValue([]);

      // Test page < 1
      await service.searchWines({ page: 0, limit: 5 });
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: 0, limit: 5 }));

      // Test limit > 50
      await service.searchWines({ page: 1, limit: 100 });
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: 0, limit: 50 }));
    });

    it('should handle empty search params', async () => {
      const mockWines = [{ id: '1', name: 'Test Wine' }];
      mockNeo4j.executeQuery.mockResolvedValue(mockWines);

      const result = await service.searchWines({});
      expect(result.data).toEqual(mockWines);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        'MATCH (w:Wine) WHERE RETURN w SKIP $skip LIMIT $limit',
        { skip: 0, limit: 10 }
      );
    });
  });
});