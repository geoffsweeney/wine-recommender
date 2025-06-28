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