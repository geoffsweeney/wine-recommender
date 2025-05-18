import 'reflect-metadata';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { Neo4jService } from '../Neo4jService';

jest.mock('../Neo4jService');

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let mockNeo4j: jest.Mocked<Neo4jService>;

  beforeEach(() => {
    mockNeo4j = new Neo4jService() as jest.Mocked<Neo4jService>;
    mockNeo4j.executeQuery.mockImplementation(async () => []);
    service = new KnowledgeGraphService(mockNeo4j);
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
      mockNeo4j.executeQuery.mockResolvedValue(mockResults);

      const preferences = await service.getPreferences(userId);

      expect(mockNeo4j.executeQuery).toHaveBeenCalledWith(
        `
      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)
       WHERE p.active = true RETURN p`,
        { userId }
      );
      // Expect the result to be mapped to PreferenceNode objects
      expect(preferences).toEqual([
        { type: 'wineType', value: 'red', active: true },
        { type: 'sweetness', value: 'dry', active: false }, // The mapping logic in service.getPreferences returns all properties, filtering is done by the query
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