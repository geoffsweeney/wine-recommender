import 'reflect-metadata';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { WineNode } from '../../types';
import { Neo4jService } from '../Neo4jService';
import { container } from 'tsyringe';
import { mockDeep } from 'jest-mock-extended';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  const mockNeo4j = mockDeep<Neo4jService>();

  const baseWine: WineNode = {
    id: 'wine-123',
    name: 'Test Wine',
    type: 'Red',
    region: 'Test Region'
  };

  beforeEach(() => {
    container.clearInstances();
    container.register('Neo4jService', { useValue: mockNeo4j });
    service = container.resolve(KnowledgeGraphService);
    mockNeo4j.executeQuery.mockReset();
  });

  describe('addWine', () => {
    it('should persist valid wine data', async () => {
      const fullWine: WineNode = {
        ...baseWine,
        vintage: 2020,
        rating: 4.5,
        priceRange: '$$$'
      };

      await service.addWine(fullWine);
      
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (w:Wine {id: $id})'),
        {
          id: fullWine.id,
          properties: fullWine
        }
      );
    });

    it('should validate required fields', async () => {
      // Test missing all required fields
      const emptyWine = {
        id: undefined,
        name: undefined,
        type: undefined,
        region: undefined
      };
      await expect(service.addWine(emptyWine as unknown as WineNode))
        .rejects.toThrow('Missing required fields: id, name, type, region');
      
      // Test missing one required field
      const missingRegion = {...baseWine, region: undefined};
      await expect(service.addWine(missingRegion as unknown as WineNode))
        .rejects.toThrow('Missing required fields: region');
    });
  });

  describe('getRecommendations', () => {
    it('should format results correctly', async () => {
      mockNeo4j.executeQuery.mockResolvedValue([{
        w2: { properties: { id: 'wine-456', name: 'Recommended Wine' }},
        p: { properties: { strength: 0.92 }}
      }]);
      
      const results = await service.getRecommendations('wine-123');
      expect(results).toEqual([{
        wine: { id: 'wine-456', name: 'Recommended Wine' },
        strength: 0.92
      }]);
    });
  });
});