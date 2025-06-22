import 'reflect-metadata';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { Neo4jService } from '../Neo4jService';
import { Neo4jCircuitWrapper } from '../Neo4jCircuitWrapper';
import winston from 'winston';

jest.mock('../Neo4jService');

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let mockNeo4j: jest.Mocked<Neo4jService>;

  beforeEach(() => {
    // Create proper mock for Neo4jCircuitWrapper
    const mockCircuitWrapper = {
      execute: jest.fn(),
      executeQuery: jest.fn()
    } as unknown as Neo4jCircuitWrapper;

    const mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as winston.Logger;

    mockNeo4j = new Neo4jService(
      'mock-uri',
      'mock-user',
      'mock-password',
      mockCircuitWrapper,
      mockLogger
    ) as jest.Mocked<Neo4jService>;
    
    mockNeo4j.executeQuery.mockImplementation(async () => []);
    
    service = new KnowledgeGraphService(mockNeo4j, mockLogger);
  });

  describe('createWineNode', () => {
    it('should create a wine node with all properties', async () => {
      const wine = {
        id: 'w1',
        name: 'Test Wine',
        type: 'Red',
        region: 'Barossa',
        vintage: 2018,
        price: 50,
        rating: 4.5
      };

      await service.createWineNode(wine);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MERGE (w:Wine {id: $id})
      SET w += $properties
    `,
        {
          id: 'w1',
          properties: {
            name: 'Test Wine',
            type: 'Red',
            region: 'Barossa',
            vintage: 2018,
            price: 50,
            rating: 4.5
          }
        }
      );
    });

    it('should handle minimal wine data', async () => {
      const wine = {
        id: 'w1',
        name: 'Test Wine',
        type: 'Red',
        region: 'Barossa'
      };

      await service.createWineNode(wine);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          properties: expect.not.objectContaining({
            vintage: expect.anything(),
            price: expect.anything(),
            rating: expect.anything()
          })
        })
      );
    });
  });

  describe('findSimilarWines', () => {
    it('should return similar wines', async () => {
      const mockResults = [{
        similar: {
          id: 'w2',
          name: 'Similar Wine',
          type: 'Red',
          region: 'Barossa'
        }
      }];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const results = await service.findSimilarWines('w1');

      expect(results).toEqual([{
        similar: {
          id: 'w2',
          name: 'Similar Wine',
          type: 'Red',
          region: 'Barossa'
        }
      }]);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)
      RETURN similar
      LIMIT $limit
    `,
        { wineId: 'w1', limit: 5 }
      );
    });

    it('should respect limit parameter', async () => {
      await service.findSimilarWines('w1', 10);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('getWinePairings', () => {
    it('should return wine pairings', async () => {
      const mockResults = [{
        pairing: {
          id: 'w3',
          name: 'Pairing Wine',
          type: 'White',
          region: 'Adelaide Hills'
        }
      }];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const results = await service.getWinePairings('w1');

      expect(results).toEqual([{
        pairing: {
          id: 'w3',
          name: 'Pairing Wine',
          type: 'White',
          region: 'Adelaide Hills'
        }
      }]);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (w:Wine {id: $wineId})-[:PAIRS_WITH]->(pairing:Wine)
      RETURN pairing
    `,
        { wineId: 'w1' }
      );
    });
  });

  describe('getWineById', () => {
    it('should return wine when found', async () => {
      const mockResults = [{
        w: {
          id: 'w1',
          name: 'Test Wine',
          type: 'Red',
          region: 'Barossa'
        }
      }];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const result = await service.getWineById('w1');

      expect(result).toEqual({
        w: {
          id: 'w1',
          name: 'Test Wine',
          type: 'Red',
          region: 'Barossa'
        }
      });
    });

    it('should return null when not found', async () => {
      mockNeo4j.executeQuery.mockResolvedValue([]);
      const result = await service.getWineById('w1');
      expect(result).toBeNull();
    });
  });

  describe('findWinesByIngredients', () => {
    it('should return wines matching all ingredients', async () => {
      const mockResults = [{
        w: {
          id: 'w1',
          name: 'Test Wine',
          type: 'Red',
          region: 'Barossa'
        }
      }];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const results = await service.findWinesByIngredients(['grape', 'oak']);
      
      expect(results).toEqual(mockResults);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (i:Ingredient)
      WHERE i.name IN $ingredients
      MATCH (i)-[:PAIRS_WITH]->(w:Wine)
      WITH w, count(DISTINCT i) as ingredientCount
      WHERE ingredientCount = size($ingredients)
      RETURN w
    `,
        { ingredients: ['grape', 'oak'] }
      );
    });

    it('should return empty array for empty ingredients', async () => {
      const results = await service.findWinesByIngredients([]);
      expect(results).toEqual([]);
      expect(mockNeo4j.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('findWinesByPreferences', () => {
    it('should build query with wine type preference', async () => {
      await service.findWinesByPreferences({ wineType: 'red' });
      
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('w.type = $wineType'),
        expect.objectContaining({ wineType: 'red' })
      );
    });

    it('should build query with price range', async () => {
      await service.findWinesByPreferences({
        wineType: 'red',
        priceRange: [20, 50]
      });
      
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('w.price >= $minPrice AND w.price <= $maxPrice'),
        expect.objectContaining({ minPrice: 20, maxPrice: 50 })
      );
    });

    it('should return empty array for undefined preferences', async () => {
      const results = await service.findWinesByPreferences({}); // Pass an empty object instead of undefined
      expect(results).toEqual([]);
      expect(mockNeo4j.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('findWinesByType', () => {
    it('should return wines of specified type', async () => {
      const mockResults = [{
        w: {
          id: 'w1',
          name: 'Test Wine',
          type: 'Red',
          region: 'Barossa'
        }
      }];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const results = await service.findWinesByType('Red');
      
      expect(results).toEqual(mockResults);
      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (w:Wine {type: $wineType})
      RETURN w
    `,
        { wineType: 'Red' }
      );
    });

    it('should return empty array for empty type', async () => {
      const results = await service.findWinesByType('');
      expect(results).toEqual([]);
      expect(mockNeo4j.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('Preference Management', () => {
    it('should add or update a preference', async () => {
      const userId = 'test-user';
      const preference = {
        type: 'wineType',
        value: 'red',
        source: 'manual',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        active: true,
      };

      await service.addOrUpdatePreference(userId, preference);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MERGE (u:User {id: $userId})
      MERGE (p:Preference {type: $type, value: $value})
      ON CREATE SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active
      ON MATCH SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active
      MERGE (u)-[:HAS_PREFERENCE]->(p)
    `,
        {
          userId,
          type: preference.type,
          value: preference.value,
          source: preference.source,
          confidence: preference.confidence,
          timestamp: preference.timestamp,
          active: preference.active,
        }
      );
    });

    it('should get only active preferences by default', async () => {
      const userId = 'test-user';
      const mockResults = [
        { p: { type: 'wineType', value: 'red', active: true } },
        { p: { type: 'sweetness', value: 'dry', active: false } },
      ];
      mockNeo4j.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('WHERE p.active = true')) {
          return mockResults.filter(record => record.p.active);
        }
        return mockResults;
      });

      const preferences = await service.getPreferences(userId);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)
     WHERE p.active = true RETURN p`,
        { userId }
      );
      // Expect the result to be mapped to PreferenceNode objects and filtered for active preferences
      expect(preferences).toEqual([
        { type: 'wineType', value: 'red', active: true },
      ]);
    });

    it('should get all preferences when includeInactive is true', async () => {
      const userId = 'test-user';
      const mockResults = [
        { p: { type: 'wineType', value: 'red', active: true } },
        { p: { type: 'sweetness', value: 'dry', active: false } },
      ];
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const preferences = await service.getPreferences(userId, true);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)
     RETURN p`,
        { userId }
      );
      // Expect the result to include both active and inactive preferences
      expect(preferences).toEqual([
        { type: 'wineType', value: 'red', active: true },
        { type: 'sweetness', value: 'dry', active: false },
      ]);
    });

    it('should return an empty array when no preferences are found', async () => {
      const userId = 'test-user';
      mockNeo4j.executeQuery.mockResolvedValue([]);

      const preferences = await service.getPreferences(userId);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)
     WHERE p.active = true RETURN p`,
        { userId }
      );
      expect(preferences).toEqual([]);
    });

    it('should delete a preference', async () => {
      const userId = 'test-user';
      const preferenceId = 'pref-123';

      await service.deletePreference(userId, preferenceId);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (u:User {id: $userId})-[r:HAS_PREFERENCE]->(p:Preference)
      WHERE p.id = $preferenceId
      DELETE r, p
    `,
        { userId, preferenceId }
      );
    });

  });
});
