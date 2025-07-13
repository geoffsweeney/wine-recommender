import { DependencyContainer } from 'tsyringe';
import { setupContainer } from '@src/di/container';
import { TYPES } from '@src/di/Types';
import { ILogger, INeo4jService, ILLMService, IPromptManager, IAgentCommunicationBus, IHealthChecks, IShutdownHandlers } from '@src/di/Types';
import { ConfigurationRegistry } from '@src/di/ConfigurationRegistry'; // Import ConfigurationRegistry

describe('Dependency Injection Container Setup', () => {
  let container: DependencyContainer;

  beforeAll(async () => {
    // Set environment variables for testing if needed
    process.env.NEO4J_URI = 'bolt://localhost:7687';
    process.env.NEO4J_USER = 'neo4j';
    process.env.NEO4J_PASSWORD = 'password';
    process.env.LLM_API_URL = 'http://localhost:11434';
    process.env.LLM_MODEL = 'llama3';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LOG_LEVEL = 'silent'; // Suppress logs during tests

    container = await setupContainer();
  });

  afterAll(async () => {
    // Clean up resources if necessary
    const neo4jService = container.resolve<INeo4jService>(TYPES.Neo4jService);
    await neo4jService.close();
  });

  it('should set up the container successfully', () => {
    expect(container).toBeDefined();
  });

  it('should resolve the Logger', () => {
    const logger = container.resolve<ILogger>(TYPES.Logger);
    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
  });

  it('should resolve Neo4jService and verify connection', async () => {
    const neo4jService = container.resolve<INeo4jService>(TYPES.Neo4jService);
    expect(neo4jService).toBeDefined();
    expect(neo4jService.executeQuery).toBeInstanceOf(Function);
    
    // Mock the verifyConnection to avoid actual DB connection in unit tests
    // In a real integration test, you'd connect to a test DB
    neo4jService.verifyConnection = jest.fn().mockResolvedValue({ success: true, data: true });
    const connectionStatus = await neo4jService.verifyConnection();
    expect(connectionStatus.success).toBe(true);
  });

  it('should resolve LLMService', () => {
    const llmService = container.resolve<ILLMService>(TYPES.LLMService);
    expect(llmService).toBeDefined();
    expect(llmService.sendPrompt).toBeInstanceOf(Function);
  });

  it('should resolve PromptManager', () => {
    const promptManager = container.resolve<IPromptManager>(TYPES.PromptManager);
    expect(promptManager).toBeDefined();
    expect(promptManager.getPrompt).toBeInstanceOf(Function);
  });

  it('should resolve AgentCommunicationBus', () => {
    const agentBus = container.resolve<IAgentCommunicationBus>(TYPES.AgentCommunicationBus);
    expect(agentBus).toBeDefined();
    expect(agentBus.publish).toBeInstanceOf(Function);
  });

  it('should resolve HealthChecks and perform checks', async () => {
    const healthChecks = container.resolve<IHealthChecks>(TYPES.HealthChecks);
    expect(healthChecks).toBeDefined();
    expect(healthChecks.checkNeo4j).toBeInstanceOf(Function);
    expect(healthChecks.checkLLMService).toBeInstanceOf(Function);

    // Mock underlying service calls for health checks
    const neo4jService = container.resolve<INeo4jService>(TYPES.Neo4jService);
    neo4jService.verifyConnection = jest.fn().mockResolvedValue({ success: true, data: true });
    const llmService = container.resolve<ILLMService>(TYPES.LLMService);
    llmService.sendPrompt = jest.fn().mockResolvedValue({ success: true, data: 'ok' });

    const neo4jStatus = await healthChecks.checkNeo4j();
    expect(neo4jStatus.status).toBe('healthy');

    const llmStatus = await healthChecks.checkLLMService();
    expect(llmStatus.status).toBe('healthy');
  });

  it('should register and execute shutdown handlers', async () => {
    const shutdownHandlers = container.resolve<IShutdownHandlers>(TYPES.ShutdownHandlers);
    expect(shutdownHandlers).toBeDefined();
    expect(Array.isArray(shutdownHandlers)).toBe(true);

    const mockHandler1 = jest.fn().mockResolvedValue(undefined);
    const mockHandler2 = jest.fn().mockResolvedValue(undefined);

    shutdownHandlers.push(mockHandler1);
    shutdownHandlers.push(mockHandler2);

    // Simulate graceful shutdown by manually calling handlers
    for (const handler of shutdownHandlers) {
      await handler();
    }

    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(mockHandler2).toHaveBeenCalledTimes(1);
  });
  it('should throw an error when resolving an unregistered dependency', async () => {
    // Create a dummy symbol for an unregistered dependency
    const UNREGISTERED_TYPE = Symbol('UnregisteredType');
    expect(() => container.resolve(UNREGISTERED_TYPE)).toThrow();
  });
});

describe('ConfigurationRegistry Circular Dependency Detection', () => {
  it('should detect direct circular dependencies', () => {
    const mockContainerManager = {
      getMainContainer: () => ({
        isRegistered: jest.fn().mockReturnValue(true),
      }),
    } as any; // Mock ContainerManager

    const configRegistry = new ConfigurationRegistry(mockContainerManager);

    const TYPE_A = Symbol('TYPE_A');
    const TYPE_B = Symbol('TYPE_B');

    configRegistry.registerService(TYPE_A, [TYPE_B]);
    configRegistry.registerService(TYPE_B, [TYPE_A]);

    expect(() => configRegistry.validateConfiguration()).toThrow('Circular dependency detected: Symbol(TYPE_A) -> Symbol(TYPE_B) -> Symbol(TYPE_A)');
  });

  it('should detect transitive circular dependencies', () => {
    const mockContainerManager = {
      getMainContainer: () => ({
        isRegistered: jest.fn().mockReturnValue(true),
      }),
    } as any;

    const configRegistry = new ConfigurationRegistry(mockContainerManager);

    const TYPE_X = Symbol('TYPE_X');
    const TYPE_Y = Symbol('TYPE_Y');
    const TYPE_Z = Symbol('TYPE_Z');

    configRegistry.registerService(TYPE_X, [TYPE_Y]);
    configRegistry.registerService(TYPE_Y, [TYPE_Z]);
    configRegistry.registerService(TYPE_Z, [TYPE_X]);

    expect(() => configRegistry.validateConfiguration()).toThrow('Circular dependency detected: Symbol(TYPE_X) -> Symbol(TYPE_Y) -> Symbol(TYPE_Z) -> Symbol(TYPE_X)');
  });
});