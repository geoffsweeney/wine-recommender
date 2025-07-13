# Pitfalls Guide

## Test Timeout Issues

### Problem
Tests may fail with timeout errors if the default timeout is too short, especially for integration tests that involve network calls, database operations, or complex business logic.

### Solution
- Always set appropriate timeouts for tests, especially integration tests. Use `jest.setTimeout(30000);` at the beginning of test files or set timeouts for individual tests.
- For test suites that involve multiple tests, set a default timeout for the entire suite.
- For individual tests that might take longer, set specific timeouts using the timeout parameter in the `it` function.

### Example
```typescript
describe('Integration Tests', () => {
  jest.setTimeout(30000); // Set default timeout to 30 seconds

  it('should perform complex operation', async () => {
    // Test code
  }, 30000); // Set specific timeout for this test
});
```

## Missing Dependencies in Test Setup

### Problem
Tests may fail if required dependencies are not properly registered or mocked in the `tsyringe` container during test setup.

### Solution
- Ensure all required dependencies are properly registered in the `tsyringe` dependency injection container.
- For tests that require specific implementations or mocks, use `container.registerInstance()` or `container.register()` with `useValue` to provide them.
- Always use the `setupContainer()` function from `backend/di/container.ts` to initialize the container for tests, and then override specific dependencies as needed.
- Ensure `container.reset()` is called in `beforeEach` or `afterEach` to maintain test isolation.

### Example
```typescript
import { DependencyContainer } from 'tsyringe';
import { setupContainer } from '../../backend/di/container';
import { TYPES } from '../../backend/di/Types';
import { ILogger } from '../../backend/di/Types'; // Assuming ILogger exists
import { mock } from 'jest-mock-extended'; // If using jest-mock-extended

describe('My Service Integration Test', () => {
  let container: DependencyContainer;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(async () => {
    // Initialize the full container setup
    container = await setupContainer();

    // Create a mock for a specific dependency
    mockLogger = mock<ILogger>();
    // Override the Logger registration with the mock
    container.registerInstance(TYPES.Logger, mockLogger);

    // Ensure the container is reset for each test
    container.reset(); // Call reset after setup to ensure clean state for each test
  });

  it('should log a message when performing an action', () => {
    const myService = container.resolve(TYPES.MyService); // Assuming MyService is registered
    myService.performAction();
    expect(mockLogger.info).toHaveBeenCalledWith('Action performed');
  });
});
```

## Database Connection Issues

### Problem
End-to-end tests that require database connections may fail if the database is not properly initialized or if connection parameters are incorrect.

### Solution
- Ensure database connection parameters are correctly set in environment variables or test configuration.
- Verify that the database is properly initialized and cleaned up before and after tests.
- Use proper error handling and connection verification in test setup.

### Example
```typescript
beforeAll(async () => {
  // Configure database connection
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  container.registerInstance(TYPES.Neo4jDriver, driver);

  // Verify connection
  await neo4jService.healthCheck();
});

afterAll(async () => {
  await neo4jService.close();
});
```

## Router Configuration Issues

### Problem
Tests may fail if the router is not properly configured with all required parameters.

### Solution
- Ensure that all required parameters are passed to router configuration functions.
- Verify that the router is properly set up in the test environment.

### Example
```typescript
app = express();
app.use(express.json());
const mockAdminCommandController = mock<AdminCommandController>();
app.use(createRouter(container, mockAdminCommandController));
```

## Common Test Patterns
 
### Mocking External Services with `tsyringe`
For services that involve external systems (APIs, databases, etc.), use `tsyringe`'s registration mechanisms to provide mock implementations, isolating the test from external dependencies.
 
```typescript
import { container } from 'tsyringe';
import { TYPES } from '../../backend/di/Types';
import { IAgentCommunicationBus } from '../../backend/di/Types'; // Assuming IAgentCommunicationBus exists
import { mock } from 'jest-mock-extended';

describe('Agent Interaction Test', () => {
  let mockAgentBus: jest.Mocked<IAgentCommunicationBus>;

  beforeEach(() => {
    container.reset(); // Ensure a clean container for each test

    mockAgentBus = mock<IAgentCommunicationBus>();
    mockAgentBus.publish.mockImplementation(() => {}); // Mock the publish method
    mockAgentBus.subscribe.mockImplementation(() => {}); // Mock the subscribe method

    container.registerInstance(TYPES.AgentCommunicationBus, mockAgentBus);
  });

  it('should publish a message to the agent bus', () => {
    const myAgent = container.resolve(TYPES.MyAgent); // Assuming MyAgent is registered
    myAgent.sendMessage();
    expect(mockAgentBus.publish).toHaveBeenCalledWith(expect.any(Object));
  });
});
```

### Cleaning Up Test Data
Always clean up test data between tests to ensure test isolation.

```typescript
beforeEach(async () => {
  await neo4jService.executeQuery('MATCH (n) DETACH DELETE n');
});
```

### Proper Error Handling
Include proper error handling in tests to catch and verify expected errors.

```typescript
it('should return 500 if an unexpected error occurs', async () => {
  mockCommunicationBus.sendMessageAndWaitForResponse.mockRejectedValue(new Error('Unexpected error'));

  const response = await request(app)
    .post('/admin-commands')
    .send({ userId, input: { message }, conversationHistory: [] });

  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: 'Internal server error' });
});
