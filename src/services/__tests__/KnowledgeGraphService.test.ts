import 'reflect-metadata';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { WineNode } from '../../types';
import { Neo4jService } from '../Neo4jService';
import { container } from 'tsyringe';
import { mockDeep } from 'jest-mock-extended';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  const mockNeo4j = mockDeep<Neo4jService>();

  beforeEach(() => {
    container.clearInstances();
    container.register('Neo4jService', { useValue: mockNeo4j });
    service = container.resolve(KnowledgeGraphService);
  });

  describe('initializeSchema', () => {
    it('should create constraints and indexes', async () => {
      await service.initializeSchema();
      
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT wine_id_unique')
      );
    });
  });

  describe('addWine', () => {
    it('should create wine node with properties', async () => {
      const wineData: WineNode = {
        id: 'wine-123',
        name: 'Test Wine',
        type: 'Red',
        region: 'Test Region',
        vintage: 2020
      };

      await service.addWine(wineData);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (w:Wine'),
        {
          id: wineData.id,
          properties: {
            name: wineData.name,
            type: wineData.type,
            region: wineData.region,
            vintage: wineData.vintage
          }
        }
      );
    });
    
      describe('edge cases', () => {
        it('should return empty array when no recommendations exist', async () => {
          mockNeo4j.executeQuery.mockResolvedValue([]);
          const results = await service.getRecommendations('unknown-wine');
          expect(results).toEqual([]);
        });
    
        it('should handle invalid wine ID gracefully', async () => {
          mockNeo4j.executeQuery.mockResolvedValue([]);
          const results = await service.getRecommendations('');
          expect(results).toEqual([]);
          expect(mockNeo4j.executeQuery).toHaveBeenCalled();
        });
    
        it('should handle partial wine properties', async () => {
          const mockResults = [
            { w: { name: 'Test Wine', type: 'Red' } } // Missing other properties
          ];
          mockNeo4j.executeQuery.mockResolvedValue(mockResults);
          
          const results = await service.getRecommendations('wine-123');
          expect(results).toEqual([{ name: 'Test Wine', type: 'Red' }]);
        });
      });
  });

  describe('getRecommendations', () => {
    it('should query for matching wines', async () => {
      const mockResults = [
        { w: { name: 'Test Wine' } }
      ];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const results = await service.getRecommendations('wine-123', 5);

      expect(results).toEqual([{ name: 'Test Wine' }]);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w1:Wine {id: $wineId})-[p:PAIRS_WITH]->(w2:Wine)'),
        { wineId: 'wine-123', limit: 5 }
      );
    });
  });
});