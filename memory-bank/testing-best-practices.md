# Testing Best Practices

This document outlines best practices for writing effective and maintainable tests within the project, with a focus on agent development.

## Integration Testing Guidelines

1.  **Test Isolation**:
    *   Each test should be completely independent.
    *   **Crucial**: Use a test container factory (e.g., `createTestContainer()` from `backend/test-setup.ts`) to provide a fresh, isolated `DependencyContainer` for each test or `beforeEach` block. This prevents state leakage between tests.
    *   Clear all mocks and container state between tests using the `resetMocks()` function provided by the test container factory.
    *   Avoid shared mutable state between test cases.

2.  **Mocking Principles**:
    *   Only mock external dependencies (databases, APIs, services).
    *   **Comprehensive Mocking**: Use `jest-mock-extended`'s `mock<T>()` for complex interfaces and classes to ensure all methods and properties are correctly mocked. This helps prevent "missing property" type errors and ensures a more robust mock.
    *   Keep mocks as simple as possible, providing just enough implementation to satisfy the test's needs.
    *   Verify mock interactions when relevant (e.g., `toHaveBeenCalledWith`).
    *   **Matching Injection Tokens**: Ensure the injection token used in `@inject()` (e.g., `TYPES.SomeService`) exactly matches the token used in `container.registerInstance()` or `container.register()`. Mismatches (e.g., injecting `TYPES.SomeService` but registering `SomeService` directly) will lead to "unregistered dependency token" errors.
    *   **Handling `Result<T, E>` Types**: When mocking services or methods that return `Result<T, E>` objects, ensure your mocks are configured to return `Result` objects (e.g., `{ success: true, data: someData }` or `{ success: false, error: someError }`) and that your assertions correctly check the `success` property and the `data` or `error` property.
    *   **Consistent Dependency Injection Tokens**: Always use `TYPES` symbols for registering and injecting dependencies in `tsyringe`. Mixing direct class registration (`container.registerSingleton(MyClass)`) with symbol-based injection (`@inject(TYPES.MyClass)`) can lead to "unregistered dependency token" errors, especially in test environments where mocks are registered using symbols. Ensure `createTestContainer` and similar test setups consistently use `TYPES` symbols.

### Integration Testing with Agent Communication Bus and Zod DTOs

When writing integration tests for API endpoints that interact with the `EnhancedAgentCommunicationBus` and use Zod schemas for Data Transfer Objects (DTOs), consider the following:

1.  **Accurate `AgentCommunicationBus` Mocking**:
    *   Ensure the `EnhancedAgentCommunicationBus` instance resolved from the `tsyringe` container in your test setup is correctly mocked using `jest-mock-extended`.
    *   When mocking methods like `sendMessageAndWaitForResponse`, explicitly cast the method to `jest.Mock` to ensure TypeScript recognizes Jest's mocking capabilities (e.g., `(communicationBus.sendMessageAndWaitForResponse as jest.Mock).mockImplementation(...)`).
    *   The mock implementation for `sendMessageAndWaitForResponse` should accurately simulate the `AgentMessage` flow:
        *   It should expect the `AgentMessage` type and payload that the API endpoint *actually sends* to the target agent (e.g., `ORCHESTRATE_RECOMMENDATION_REQUEST` with a `RecommendationRequest` DTO payload).
        *   It should return a `Result` object containing the `AgentMessage` that the target agent (e.g., `SommelierCoordinator`) would *return* (e.g., `FINAL_RECOMMENDATION` with its specific payload).
2.  **Precise DTO Payload Construction**:
    *   When sending requests in your tests (e.g., using `supertest.send()`), ensure the request body strictly conforms to the expected Zod DTO schema.
    *   Pay close attention to data types (e.g., `priceRange` as a `tuple` `[number, number]` vs. a `string`), required fields, and unrecognized keys. Zod's `strict()` method on objects will flag extra properties, which is a common source of validation errors in tests.
    *   Use the actual DTO schema definition (e.g., `RecommendationRequest.dto.ts`) as the source of truth for constructing test payloads.
3.  **Asserting Response Structure**:
    *   Carefully examine what the API endpoint *actually returns* to the client. If the endpoint extracts a specific part of an `AgentMessage` (e.g., `result.data.payload`), your test assertions should expect *only that part*, not the entire `AgentMessage` structure. Mismatched assertions can lead to confusing test failures.
4.  **Debugging Validation and Mocking Issues**:
    *   Utilize `console.log` within your test setup and mock implementations to inspect the actual values being passed and returned. This is invaluable for debugging type mismatches and unexpected validation errors.
    *   When encountering `Property 'mockImplementation' does not exist` errors, verify the `jest.Mocked<T>` cast on the dependency and consider explicit `as jest.Mock` casts on individual methods if necessary.
    *   **Complex Mocking Scenarios (e.g., Zod and Tsyringe)**:
        *   When mocking libraries like `zod` that involve dynamic code evaluation (`new Function`) or complex class structures, ensure your mocks accurately simulate the expected behavior (e.g., `parse` method throwing `ZodError` on invalid input, not just returning `undefined`).
        *   If `z.ZodError` is used in `instanceof` checks, ensure your `zod` mock explicitly provides a mock `ZodError` class with the expected properties (e.g., `errors` array).
        *   Be mindful of Jest's module resolution and how mocks are applied. If `createMockZodType` or similar helper functions are part of your mock, ensure they are correctly exported and imported.
        *   When using `tsyringe` and `container.reset()` in `afterEach` or within tests, remember that this clears *all* registered dependencies. Any mocks or services needed by subsequent `container.resolve()` calls must be re-registered after `container.reset()`. This is crucial for tests that re-initialize services or agents.
    *   For Zod validation errors, the `result.error.errors` array provides detailed information (`code`, `path`, `message`, `expected`, `received`) that directly points to the schema mismatch.

3.  **Test Structure**:
    ```typescript
    // Example using the recommended test container factory
    import { createTestContainer } from '../../../test-setup'; // Adjust path as needed
    import { DependencyContainer } from 'tsyringe';
    import { mock } from 'jest-mock-extended'; // For comprehensive mocking

    describe('Feature', () => {
      let container: DependencyContainer;
      let resetMocks: () => void;
      // Declare mocks here if they need to be accessed across tests in the describe block
      let mockDependency: any; // Use 'any' or the specific mocked type if available

      beforeEach(() => {
        // Get a fresh container and reset function for each test
        ({ container, resetMocks } = createTestContainer());

        // Setup mocks for dependencies and register them with the new container
        mockDependency = mock<MockType>(); // Use mock<T>() for comprehensive mocking
        container.registerInstance(TYPES.SomeDependency, mockDependency); // Register with the correct token

        // Initialize agent/service under test using the container
        // Example: agent = container.resolve(MyAgent);
        // Ensure all mandatory dependencies are provided via the container.
      });

      afterEach(() => {
        resetMocks(); // Clean up mocks and container state after each test
      });

      it('should do X when Y', async () => {
        // Setup specific mock behavior for this test case
        mockDependency.method.mockResolvedValue(testData);

        // Execute test
        const result = await agent.someMethod(); // Call method on agent under test

        // Verify
        expect(result).toEqual(expected);
        expect(mockDependency.method).toHaveBeenCalledTimes(1);
      });
    });
    ```

**Specific Considerations for Agent Testing:**

*   **Test Wrappers**: For testing protected methods of agents (e.g., `validateInput`), create a test-specific wrapper class that extends the agent and exposes the protected method as public.
    ```typescript
    class TestMyAgent extends MyAgent {
      public testProtectedMethod(...args: any[]) {
        return this.protectedMethod(...args);
      }
    }
    ```
*   **Mocking `sendLLMPrompt`**: When testing agents that interact with the LLMService, mock `communicationBus.sendLLMPrompt` to control LLM responses and avoid actual LLM calls during tests. Ensure the mock returns a `Result` type.
    ```typescript
    mockBus.sendLLMPrompt.mockResolvedValueOnce({
      success: true,
      data: JSON.stringify({ /* mocked LLM response */ })
    });
    ```
*   **Correlation ID Propagation**: Assert that `correlationId` is correctly propagated through messages and logged with appropriate context.
*   **Error Handling**: Thoroughly test error paths.
    *   Agents should return `Result.success: false` with appropriate `AgentError` details for structured error reporting.
    *   For unrecoverable errors within agent logic (e.g., LLM service failures), throw `AgentError` instances. This ensures proper error propagation and allows for centralized error handling.
    *   Tests should assert `result.success` is `false` and verify the `AgentError`'s `code` and `recoverable` properties.
    *   Ensure errors are processed by the `DeadLetterProcessor` when applicable.
*   **Logging Expectations in Tests**:
    *   Be mindful of the logging mechanism used in the agent (e.g., `console.log` vs. `this.logger`).
    *   When testing `console.log` calls, remember that `toHaveBeenCalledWith` matches arguments exactly. If the agent logs an object as a second argument (e.g., `console.log('message', errorObject)`), the test should reflect this (e.g., `expect(console.log).toHaveBeenCalledWith('message', expect.any(Error))`).
    *   Prefer `this.logger` for structured logging in agents, and mock `this.logger` in tests to verify log calls.
*   **Dedicated Test Files**: Each agent should have its own dedicated test file (e.g., `AgentName.test.ts`) to ensure comprehensive testing of its specific functionalities and error paths.
*   **Debugging Test Failures**: When tests fail, especially due to mock expectations or logger calls, use `console.log` within `afterEach` blocks (temporarily) to inspect the actual arguments received by mocks. This can help pinpoint mismatches between expected and actual calls.
    *   For agents with retry mechanisms, ensure all retry attempts are correctly mocked. Failures in later attempts can lead to unexpected errors if not properly handled.
    *   Understand the flow of error handling: differentiate between errors that are caught and re-thrown (hitting a `catch` block) versus errors that lead to an early `return` from a method. This impacts which logger calls or dead-letter processing expectations are relevant.
    *   **Mocking Inherited Methods**: When testing methods inherited from a base class (e.g., `broadcast` from `CommunicatingAgent`), ensure you mock the method on the *instance* of the agent under test, or mock the underlying dependency that the inherited method calls (e.g., `communicationBus.publishToAgent`).
    *   **Complex Message Signatures**: When using helper functions like `createAgentMessage` with many parameters, carefully verify the order and type of arguments. Mismatches can lead to subtle bugs that are hard to debug. Use `console.log` to inspect the actual message object being created.
    *   **Consistent Error Propagation**: Ensure that `AgentError` is consistently used across all layers and methods. When an error is caught and re-thrown or returned, ensure it's always an `AgentError` to maintain a unified error handling strategy.
    *   **Error Propagation through Nested Calls**: Be aware of how errors propagate through nested method calls (e.g., `handleValueAnalysisRequest` calling `processValueAnalysis`). The `catch` block in an outer method might not be reached if an inner method returns a `Result.success: false` instead of throwing an error. This impacts where `mockLogger` expectations should be placed.
    *   **Error Wrapping and Code Mismatches**: When errors are caught and re-wrapped in new `AgentError` instances (e.g., in a higher-level `handleRequest` method), the original error code might be lost or changed. Always trace the exact error propagation path to correctly determine the expected `AgentError` code at the point of assertion.
    *   **Logger Mocking Challenges**: If `mockLogger` expectations prove persistently difficult to match, consider simplifying them or focusing on asserting the primary outcomes (e.g., `deadLetterProcessor` calls, `Result` object) rather than the exact log messages. This can indicate subtle interactions with the logging library or Jest's mocking capabilities.

4.  **Common Pitfalls**:
    *   Over-mocking (mocking internal implementation details).
    *   Under-mocking (missing critical dependencies).
    *   Flaky tests (due to shared state or timing issues).
    *   Overly complex test setups.
    *   Missing dedicated test files for agents, leading to inadequate test coverage.
    *   **Agents Handling Multiple Message Types**: Ensure that the `handleMessage` method correctly dispatches all expected message types to their respective handlers. A common pitfall is to only handle the primary message type, leading to other messages being incorrectly routed to the `UNHANDLED_MESSAGE_TYPE` fallback.
    *   **Insufficient Payload Validation**: Failing to thoroughly validate incoming message payloads can lead to unexpected runtime errors and make debugging difficult. Always ensure that required fields exist and have the correct types.
    *   **Mocking Communication Bus Interactions**: When using dependency injection (e.g., `tsyringe`) with deep mocking libraries (e.g., `jest-mock-extended`), `toHaveBeenCalled` assertions on communication bus methods (like `sendResponse` or `sendMessageAndWaitForResponse`) may not reliably track calls, even when the methods are confirmed to be executed internally. This can lead to misleading test failures. In such cases, consider:
    *   Relying on integration tests to verify end-to-end communication flows.
    *   Focusing unit tests on the agent's internal logic and state changes, rather than direct assertions on communication method calls.
    *   **Ensuring Correct Message Construction**: A common source of communication issues is incorrect `AgentMessage` construction. Always ensure that `createAgentMessage` is called with the correct `correlationId` (from the incoming request for responses) and `userId` (when user context is needed). Mismatches in these fields can lead to messages not being routed or processed correctly by the `EnhancedAgentCommunicationBus`.
    *   **Testing Services Returning `Result` Types**: When testing services that return `Result` objects, ensure your mocks are configured to return `Result` objects (e.g., `{ success: true, data: mockData }` or `{ success: false, error: mockError }`) and that your assertions correctly check the `success` property and the `data` or `error` property.

5.  **Best Practices**:
    *   Focus on behavior over implementation.
    *   Test happy paths and error cases.
    *   Keep tests small and focused.
    *   Avoid testing multiple concerns in one test.

## Testing Express Controllers

When testing Express.js controllers, especially methods that directly handle `Request` and `Response` objects (like `executeImpl` in `BaseController` subclasses), special attention is needed for mocking the `Request` object:

1.  **Simulating `Request` Properties**:
    *   Ensure your `mockRequest` object accurately simulates all properties the controller expects, including standard Express properties (`method`, `body`, `query`, `params`) and custom properties added by middleware (e.g., `validatedBody`, `validatedQuery`).
    *   **Explicit Typing**: When using `Partial<Request>`, explicitly extend the type to include custom properties:
        ```typescript
        let mockRequest: Partial<Request> & { validatedBody?: any; validatedQuery?: any; };
        ```
    *   **Direct Initialization**: Initialize `mockRequest` with all relevant properties from the start. This is more reliable than assigning them later, especially for properties that might be accessed early in the controller's logic.
        ```typescript
        mockRequest = {
          method: 'POST', // Or 'GET', 'PUT', etc.
          body: {},
          query: {},
          params: {},
          validatedBody: {}, // Custom property
          validatedQuery: {}, // Custom property
          // ... other properties as needed
        };
        ```
    *   **Method-Specific Setup**: For controllers that use `req.method` in `switch` statements or conditional logic, ensure `mockRequest.method` is set correctly for each test case or `describe` block.
        ```typescript
        describe('executeImpl - GET /some-route', () => {
          beforeEach(() => {
            mockRequest.method = 'GET'; // Set method for all tests in this block
          });
          // ... tests
        });
        ```

2.  **Mocking `Response` Object**:
    *   Mock `res.status()` and `res.json()` (or `res.send()`, `res.end()`) to assert on the response behavior. Use `jest.fn()` and `mockReturnValue({ json: jest.fn() })` to chain calls.
    ```typescript
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      jsonSpy = jest.fn();
      statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
      mockResponse = {
        status: statusSpy,
        json: jsonSpy, // Also mock json directly if it's called without status
      };
    });
    ```
    *   **Assertions**: Assert that `statusSpy` and `jsonSpy` were called with the expected values.
    ```typescript
    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({ message: 'Success' });
    ```

## Lessons Learned from Debugging RecommendationAgent Tests

To prevent future issues and lengthy debugging exercises, the following lessons were learned from fixing the RecommendationAgent tests:

1. **Precise Log Expectations**: 
   - Ensure that test expectations for log messages match the implementation exactly, including the log message string and the context object. 
   - When the implementation changes (e.g., log message wording), update the tests accordingly to avoid false negatives.

2. **Accurate Error Simulation**:
   - When testing error conditions, simulate errors in a way that matches the actual error handling mechanism in the code. For example, if the code throws an error, the test should mock the function to throw; if the code returns a `Result` object with an error, the mock should return that.

3. **Comprehensive Test Coverage**:
     *   **Mocking Service Return Types**: Ensure that mocked service methods return data in the *exact type and structure* expected by the consuming code. For instance, if a service method returns an object (`UserPreferences`), mock it to return an empty object (`{}`) rather than an empty array (`[]`), to prevent type mismatches and unexpected runtime errors.

4. **Test Setup Reflection**:
   - Tests should cover both positive and negative scenarios, including edge cases and error conditions.
   - Pay special attention to error handling paths and ensure they are tested.

4. **Test Setup Reflection**:
   - The test setup should accurately reflect the conditions under which the code runs. For example, if an error occurs during an asynchronous operation, the test should simulate that asynchronous error.

5. **Maintain Test Code**:
   - Keep test code clean and well-commented. When making changes to the implementation, remember to update the tests as well.
   - Avoid hard-coded values in tests when possible; use constants or factory functions to create test data.

6. **Debugging Techniques**:
   - Use `console.log` statements in tests and mocks to understand the flow and data when tests fail.
   - Check the order of mock calls and the arguments passed to them.

7. **`createAgentMessage` Argument Order**:
   - The `createAgentMessage` helper function has a specific argument order: `type, payload, sourceAgent, conversationId, correlationId, targetAgent?, userId?, priority?, metadata?`.
   - When calling this function in tests, ensure arguments are passed in the correct positional order. If an optional argument (like `targetAgent` or `userId`) is not being used, explicitly pass `undefined` for it to ensure subsequent arguments are correctly mapped. For example, if `targetAgent` is omitted but `userId` is needed, the call should be `createAgentMessage(..., undefined, userId, ...)`.

8. **Testing Private/Protected Methods**:
   - To directly test private or protected methods of an agent, create a test-specific wrapper class that extends the agent and exposes these methods as public for testing purposes. This allows for isolated unit testing of internal logic.

9. **Accurate `publishToAgent` Expectations**:
   - When asserting calls to `mockBus.publishToAgent`, ensure that the expected message `type` and `payload` precisely match what the agent is broadcasting. Mismatches in message types (e.g., expecting `'preferences-updated'` when the agent sends `'preference-update'`) or payload structure will cause test failures.

10. **Investigating `result.success: false` in Expected Success Paths**:
    - If a test case expects a successful `Result` (`result.success` to be `true`) but receives `false`, it often indicates an unhandled exception within the `try-catch` block of the method under test. This can be due to:
        - An unmocked dependency throwing an error.
        - A mock returning an unexpected value or structure that causes a runtime error in the agent's logic.
        - A logical flaw in the agent's code that leads to an exception.
    - Use detailed logging or a debugger to trace the execution path and identify the exact point of failure.

By adhering to these practices, we can reduce debugging time and improve the reliability of our tests.

### Recent Debugging Learnings

1.  **Incomplete Dependency Mocking in Tests**:
    *   **Pitfall**: Tests failing due to uninitialized or missing dependencies in the test setup, especially when using `tsyringe` and `mockDeep`. This often manifests as `TypeError: Cannot read properties of undefined` or similar errors when the agent/service under test tries to access a method on a dependency that was not properly mocked or injected.
    *   **Mitigation**: Always ensure *all* constructor dependencies of the class being tested are explicitly mocked and registered with the `tsyringe` container in the `beforeEach` block. Use `mockDeep<T>()` for complex interfaces/classes. Verify that the `container.resolve()` calls correctly provide the mocked instances.
2.  **`LLMService.sendStructuredPrompt` Signature Change**:
    *   **Pitfall**: After refactoring `LLMService.sendStructuredPrompt` to internally retrieve the output schema from `PromptManager`, existing calls in agents (e.g., `LLMRecommendationAgent`, `SommelierCoordinator`, `InputValidationAgent`, `LLMPreferenceExtractorAgent`) continued to pass the schema as an argument, leading to `Expected 3 arguments, but got 4` TypeScript errors.
    *   **Mitigation**: When a method signature changes, update all its call sites. For `LLMService.sendStructuredPrompt`, remove the `outputSchema` argument from the call.
3.  **Accessing Private Methods**:
    *   **Pitfall**: Attempting to access `private` methods (e.g., `PromptManager.getOutputSchemaForTask`) from outside their defining class results in TypeScript errors (`Property '...' is private and only accessible within class '...'`).
    *   **Mitigation**: Design public interfaces for services. If a method needs to be consumed by other services, it must be `public`.
4.  **Test Expectation Mismatches**:
    *   **Pitfall**: Tests failing because `jest.fn().toHaveBeenCalledWith()` expectations do not precisely match the arguments received by the mocked function, especially for log messages or complex object structures.
    *   **Mitigation**: Review the actual arguments received by the mock (e.g., using `console.log(mock.mock.calls)`) and adjust `expect.objectContaining()` or `expect.stringContaining()` as needed. Ensure log message expectations are updated when log messages change.
5.  **Agent Message Payload Structure**:
    *   **Pitfall**: `AgentMessage` payloads using incorrect property names (e.g., `message` instead of `userInput`) for expected data, leading to type errors or runtime issues.
    *   **Mitigation**: Strictly adhere to defined interface types for `AgentMessage` payloads. Use the correct property names (e.g., `userInput` when the interface expects `userInput`).

## Dependency Injection and Express Testing Pitfalls (Learnings from Recent Debugging)

This section outlines specific pitfalls encountered during recent debugging sessions, particularly concerning `tsyringe` dependency injection in Jest tests and Express.js route setup.

1.  **Comprehensive Dependency Registration in Tests**:
    *   **Pitfall**: Integration tests often fail with "Attempted to resolve unregistered dependency token" errors when not all transitive dependencies are explicitly registered in the `tsyringe` container within the test setup (`beforeEach` or `beforeAll`). This is especially true for complex services or agents that have many layers of dependencies.
    *   **Learning**: Always ensure *all* dependencies, including nested ones (e.g., `LLMService` depends on `PromptManager`, `LlmApiUrl`, `LlmModel`, `LlmApiKey`), are mocked and registered in the test container. Even if a service is mocked using `mockDeep`, its constructor might still attempt to resolve its own dependencies, leading to errors if those are missing.
    *   **Mitigation**: Create a comprehensive `beforeEach` block that registers mocks for every dependency that could be resolved by the container during the test run. Use `mock<T>()` from `jest-mock-extended` for complex objects.

2.  **Protected Methods in Express Controllers**:
    *   **Pitfall**: Attempting to use `protected` methods of Express controllers (e.g., `executeImpl` in `BaseController` subclasses) directly as route handlers (`router.post('/', controller.executeImpl.bind(controller))`) results in TypeScript errors ("Property 'executeImpl' is protected").
    *   **Learning**: `protected` methods are not accessible from outside the class hierarchy. Express route handlers need to be publicly accessible.
    *   **Mitigation**: Change the visibility of such methods from `protected` to `public` if they are intended to be used as direct route handlers.

3.  **`validateRequest` Middleware Signature**:
    *   **Pitfall**: The `validateRequest` middleware expects a `source` argument (e.g., `'body'`, `'query'`, `'params'`) to specify where the validation schema should be applied. Omitting this argument leads to TypeScript errors ("Expected 2 arguments, but got 1").
    *   **Learning**: Always provide the `source` argument when using `validateRequest` middleware.
    *   **Mitigation**: Ensure calls to `validateRequest` include the appropriate source, e.g., `validateRequest(RecommendationRequest, 'body')` for POST requests or `validateRequest(SearchRequest, 'query')` for GET requests.

4.  **Express Route Registration in Tests (404 Errors)**:
    *   **Pitfall**: Even with correct route definitions and controller methods, integration tests using `supertest` might return 404 errors if the Express application's routes are not correctly mounted or if there's a fundamental issue with the test setup.
    *   **Learning**: A 404 in `supertest` often means the route was not found. This can happen if:
        *   The router is not correctly `app.use()`'d in the Express app.
        *   The base path for `app.use()` is incorrect (e.g., mounting at `/api` but testing at `/`).
        *   There's an issue with the `supertest` request itself (e.g., wrong HTTP method, incorrect URL).
    *   **Mitigation**:
        *   Verify the `app.use()` calls in the test's `beforeAll` block, ensuring the router is mounted at the expected path.
        *   Add a very simple, direct test route (e.g., `app.get('/test', (req, res) => res.status(200).send('OK'))`) to the Express app in `beforeAll`. If this simple route also returns 404 when tested with `supertest`, it indicates a deeper problem with the basic Express app initialization or `supertest` usage in the test environment. Debug this fundamental setup first.

5.  **TypeScript Import Mismatches**:
    *   **Pitfall**: Importing types or modules from incorrect paths (e.g., `ILogger` from `LLMService` instead of `di/Types`) or having duplicate import statements can lead to compilation errors.
    *   **Learning**: Always verify import paths and ensure no duplicate imports exist, especially after refactoring or merging code.
    *   **Mitigation**: Pay close attention to compiler errors related to imports. Use IDE features for auto-import and import organization.
