import express, { Express } from 'express';
import request from 'supertest';
import { container } from 'tsyringe';
import winston from 'winston';
import neo4j from 'neo4j-driver'; // Import neo4j
import createRouter from '../../api/routes';
import { TYPES } from '../../di/Types';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { Neo4jCircuitWrapper } from '../../services/Neo4jCircuitWrapper';
import { Neo4jService } from '../../services/Neo4jService';
import { UserProfileService } from '../../services/UserProfileService'; // Import UserProfileService
import { AdminCommandController } from '../../api/controllers/AdminCommandController'; // Import AdminCommandController
import { mock } from 'jest-mock-extended'; // Import mock

describe('E2E Admin User Preference API', () => {
  let app: Express;
  let neo4jService: Neo4jService;
  let knowledgeGraphService: KnowledgeGraphService;
  let logger: winston.Logger;

  const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

  beforeAll(async () => {
    // Configure a logger for the test environment
    logger = winston.createLogger({
      level: 'debug',
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      ],
    });

    // Clear existing registrations to ensure fresh instances for E2E
    container.clearInstances();
    container.reset();

    // Register real Neo4j dependencies
    container.registerInstance(TYPES.Neo4jUri, NEO4J_URI);
    container.registerInstance(TYPES.Neo4jUser, NEO4J_USER);
    container.registerInstance(TYPES.Neo4jPassword, NEO4J_PASSWORD);
    container.registerInstance(TYPES.Logger, logger);

    // Create and register the Neo4j Driver
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    container.registerInstance(TYPES.Neo4jDriver, driver);

    // Register CircuitOptions
    container.registerInstance(TYPES.CircuitOptions, {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 3000,
      resetTimeout: 30000,
    });

    // Register Neo4jCircuitWrapper and Neo4jService
    container.register(TYPES.Neo4jCircuitWrapper, { useClass: Neo4jCircuitWrapper });
    container.register(Neo4jService, { useClass: Neo4jService }); // Register Neo4jService as a class
    container.register(KnowledgeGraphService, { useClass: KnowledgeGraphService }); // Register KnowledgeGraphService as a class
    container.register(TYPES.UserProfileService, { useClass: UserProfileService }); // Register UserProfileService as a class

    // Register a mock for AgentCommunicationBus for E2E tests
    container.register(TYPES.AgentCommunicationBus, {
      useValue: {
        sendMessageAndWaitForResponse: jest.fn().mockResolvedValue({ success: true, data: { payload: {} } }),
      },
    });

    // Resolve and initialize Neo4jService
    neo4jService = container.resolve(Neo4jService);
    // No need to call neo4jService.init() here, as the driver is already created and injected
    await neo4jService.healthCheck(); // Verify connection

    knowledgeGraphService = container.resolve(KnowledgeGraphService);

    app = express();
    app.use(express.json());
    const mockAdminCommandController = mock<AdminCommandController>(); // Create a mock AdminCommandController
    app.use(createRouter(container, mockAdminCommandController)); // Use the main router which includes admin routes
  });

  beforeEach(async () => {
    // Clean up the database before each test
    await neo4jService.executeQuery('MATCH (n) DETACH DELETE n');
  });

  afterAll(async () => {
    await neo4jService.close();
    container.reset();
  });

  describe('Admin User Preference Management E2E', () => {
    const userId = 'e2e-test-user-1';
    const preference1 = { type: 'wineType', value: 'Red', source: 'e2e', confidence: 1.0, timestamp: Date.now(), active: true };
    const preference2 = { type: 'sweetness', value: 'Dry', source: 'e2e', confidence: 1.0, timestamp: Date.now(), active: true };
    const preference3 = { type: 'region', value: 'Bordeaux', source: 'e2e', confidence: 1.0, timestamp: Date.now(), active: false }; // Inactive

    it('should allow an admin to add, retrieve, update, and delete user preferences', async () => {
      // 1. Add preferences for a user
      const addResponse = await request(app)
        .put(`/admin/preferences/${userId}`)
        .send([preference1, preference2]);

      expect(addResponse.status).toBe(200);
      expect(addResponse.body).toEqual({ message: 'User preferences updated successfully' });

      // Verify preferences are in the database
      let dbPreferences = await knowledgeGraphService.getPreferences(userId, true);
      expect(dbPreferences).toHaveLength(2);
      expect(dbPreferences).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: preference1.type, value: preference1.value }),
        expect.objectContaining({ type: preference2.type, value: preference2.value }),
      ]));

      // 2. Retrieve preferences for a specific user (admin view, including inactive)
      const getResponse = await request(app).get(`/admin/preferences/${userId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveLength(2);
      expect(getResponse.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: preference1.type, value: preference1.value }),
        expect.objectContaining({ type: preference2.type, value: preference2.value }),
      ]));

      // 3. Add an inactive preference and verify it's retrieved with includeInactive=true
      const addInactiveResponse = await request(app)
        .put(`/admin/preferences/${userId}`)
        .send([preference3]);
      expect(addInactiveResponse.status).toBe(200);

      dbPreferences = await knowledgeGraphService.getPreferences(userId, true);
      expect(dbPreferences).toHaveLength(3);
      expect(dbPreferences).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: preference1.type, value: preference1.value }),
        expect.objectContaining({ type: preference2.type, value: preference2.value }),
        expect.objectContaining({ type: preference3.type, value: preference3.value, active: false }),
      ]));

      // 4. Retrieve all user preferences (admin view)
      const getAllResponse = await request(app).get('/admin/preferences');
      expect(getAllResponse.status).toBe(200);
      expect(getAllResponse.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          userId: userId,
          preferences: expect.arrayContaining([
            expect.objectContaining({ type: preference1.type, value: preference1.value }),
            expect.objectContaining({ type: preference2.type, value: preference2.value }),
            expect.objectContaining({ type: preference3.type, value: preference3.value, active: false }),
          ]),
        }),
      ]));

      // 5. Delete a specific preference
      // To delete by ID, we need the ID from the DB. Let's assume for E2E we can get it.
      const prefToDelete = dbPreferences.find(p => p.type === preference1.type);
      expect(prefToDelete).toBeDefined();

      const deleteSpecificResponse = await request(app).delete(`/admin/preferences/${userId}?type=${prefToDelete.type}&value=${prefToDelete.value}`);
      expect(deleteSpecificResponse.status).toBe(200);
      expect(deleteSpecificResponse.body).toEqual({ message: `Preference type: ${prefToDelete.type}, value: ${prefToDelete.value} for user ${userId} deleted successfully` });

      dbPreferences = await knowledgeGraphService.getPreferences(userId, true);
      expect(dbPreferences).toHaveLength(2); // One preference deleted
      expect(dbPreferences).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: preference1.type, value: preference1.value }),
      ]));

      // 6. Delete all preferences for the user
      const deleteAllResponse = await request(app).delete(`/admin/preferences/${userId}`);
      expect(deleteAllResponse.status).toBe(200);
      expect(deleteAllResponse.body).toEqual({ message: `All preferences for user ${userId} deleted successfully` });

      dbPreferences = await knowledgeGraphService.getPreferences(userId, true);
      expect(dbPreferences).toHaveLength(0); // All preferences deleted
    });
  });
});
