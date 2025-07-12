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
Tests may fail if required dependencies are not properly registered or mocked in the test setup.

### Solution
- Ensure all required dependencies are properly registered in the dependency injection container.
- For tests that require controllers or other components, create proper mocks and register them.
- Verify that all necessary imports are included in test files.

### Example
```typescript
import { mock } from 'jest-mock-extended';
import { AdminCommandController } from '../../api/controllers/AdminCommandController';

describe('Integration Tests', () => {
  const mockAdminCommandController = mock<AdminCommandController>();

  beforeAll(() => {
    container.register(TYPES.AdminCommandController, { useValue: mockAdminCommandController });
  });

  // Test code
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

### Mocking External Services
For services that involve external systems (APIs, databases, etc.), use mocks to isolate the test from external dependencies.

```typescript
container.register(TYPES.AgentCommunicationBus, {
  useValue: {
    sendMessageAndWaitForResponse: jest.fn().mockResolvedValue({ success: true, data: { payload: {} } }),
  },
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
