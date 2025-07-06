# Pitfalls Guide

This document outlines common pitfalls and challenges encountered during development, along with strategies to mitigate them.

## General Development Pitfalls

1.  **Incomplete Requirements**:
    *   **Pitfall**: Starting development with vague or incomplete requirements leads to rework and delays.
    *   **Mitigation**: Always seek clarification. Use tools like `ask_followup_question` to get precise details. Document assumptions.

2.  **Lack of Modularity**:
    *   **Pitfall**: Tightly coupled code makes testing, maintenance, and scaling difficult.
    *   **Mitigation**: Design with modularity in mind. Use dependency injection (e.g., `tsyringe`), clear interfaces, and small, focused functions/classes.

3.  **Ignoring Error Handling**:
    *   **Pitfall**: Neglecting robust error handling leads to brittle applications and poor user experience.
    *   **Mitigation**: Implement comprehensive error handling. Use `Result` types for predictable error propagation. Log errors effectively.

4.  **Premature Optimization**:
    *   **Pitfall**: Optimizing code before identifying performance bottlenecks can lead to wasted effort and less readable code.
    *   **Mitigation**: Profile first. Optimize only when a bottleneck is identified and measured.

5.  **Inadequate Logging**:
    *   **Pitfall**: Insufficient or poorly structured logs make debugging and monitoring challenging.
    *   **Mitigation**: Implement structured logging. Log at appropriate levels (debug, info, warn, error). Include correlation IDs for tracing.

## Agent-Specific Pitfalls

1.  **Agent Communication Mismatches**:
    *   **Pitfall**: Incorrect message types, payloads, or correlation IDs can break inter-agent communication.
    *   **Mitigation**: Define clear message schemas. Use helper functions like `createAgentMessage`. Thoroughly test communication paths.

2.  **State Management Issues**:
    *   **Pitfall**: Agents maintaining mutable state without proper synchronization can lead to race conditions and inconsistent behavior.
    *   **Mitigation**: Prefer immutable data. Use `SharedContextMemory` for shared state, ensuring atomic updates.

3.  **LLM Prompt Engineering Challenges**:
    *   **Pitfall**: Poorly designed LLM prompts lead to irrelevant, inaccurate, or unparseable responses.
    *   **Mitigation**: Iterate on prompts. Use structured prompts (e.g., JSON output). Implement robust parsing and validation of LLM responses.

4.  **Over-reliance on LLM**:
    *   **Pitfall**: Using LLMs for tasks that can be solved deterministically or with traditional algorithms can be inefficient and costly.
    *   **Mitigation**: Identify appropriate use cases for LLMs. Leverage knowledge graphs and deterministic services where possible.

5.  **Hardcoded Prompt Strings in Agents**:
    *   **Pitfall**: Agents or services directly embedding LLM prompt strings within their code, bypassing the `PromptManager`. This leads to duplicated prompt logic, makes prompt versioning and A/B testing difficult, and hinders centralized prompt management and validation.
    *   **Mitigation**: Always use the `PromptManager` via `LLMService` to retrieve and render prompts. Ensure that agents call `LLMService.sendPrompt` or `LLMService.sendStructuredPrompt` with a `task` name and `variables`, rather than constructing prompt strings internally. The `PromptManager` is designed to handle prompt externalization, templating, and validation.

## Testing-Specific Pitfalls (Lessons Learned from RecommendationAgent Tests)

1.  **Inaccurate Log Expectations**:
    *   **Pitfall**: Tests expecting specific log messages fail when the log message or its context object changes slightly in the implementation. This leads to brittle tests and unnecessary debugging.
    *   **Mitigation**: Ensure test expectations for log messages match the implementation exactly, including the log message string and the context object. When the implementation changes (e.g., log message wording), update the tests accordingly to avoid false negatives. If exact matching is too brittle, consider using `expect.stringContaining()` for partial matches or focusing on the presence of logs rather than their exact content.

2.  **Mismatched Error Simulation**:
    *   **Pitfall**: Simulating errors in tests that do not align with how the actual code handles errors (e.g., mocking a function to return an error object when the code expects it to throw an exception, or vice-versa).
    *   **Mitigation**: When testing error conditions, simulate errors in a way that precisely matches the actual error handling mechanism in the code. If the code throws an error, the test should mock the function to throw; if the code returns a `Result` object with an error, the mock should return that.

3.  **Insufficient Error Path Coverage**:
    *   **Pitfall**: Only testing "happy paths" and neglecting to thoroughly test error conditions, leading to production bugs when unexpected scenarios occur.
    *   **Mitigation**: Tests should cover both positive and negative scenarios, including edge cases and error conditions. Pay special attention to error handling paths and ensure they are tested comprehensively.

4.  **Unrealistic Test Setup**:
    *   **Pitfall**: Test setups that do not accurately reflect the conditions under which the code runs, especially for asynchronous operations or complex interactions.
    *   **Mitigation**: The test setup should accurately reflect the conditions under which the code runs. For example, if an error occurs during an asynchronous operation, the test should simulate that asynchronous error using `mockRejectedValueOnce` or `mockImplementationOnce` that throws.

5.  **Neglecting Test Code Maintenance**:
    *   **Pitfall**: Allowing test code to become outdated or inconsistent with the application code, leading to false positives/negatives and increased maintenance burden.
    *   **Mitigation**: Keep test code clean, well-commented, and up-to-date. When making changes to the implementation, remember to update the tests as well. Avoid hard-coded values in tests when possible; use constants or factory functions to create test data.

6.  **Ineffective Debugging Practices**:
    *   **Pitfall**: Struggling to diagnose test failures due to a lack of systematic debugging approaches.
    *   **Mitigation**: Utilize `console.log` statements strategically within tests and mocks to understand the flow and data when tests fail. Check the order of mock calls and the arguments passed to them. Leverage Jest's built-in debugging features.

7.  **`createAgentMessage` Argument Order**:
    *   **Pitfall**: Incorrect argument order when using `createAgentMessage` can lead to subtle type errors or unexpected behavior, especially with optional parameters.
    *   **Mitigation**: Always refer to the `createAgentMessage` function signature (`type, payload, sourceAgent, conversationId, correlationId, targetAgent?, userId?, priority?, metadata?`). Explicitly pass `undefined` for optional arguments if they are not being used, to ensure subsequent arguments are correctly mapped by position.

8.  **Testing Private/Protected Methods**:
    *   **Pitfall**: Attempting to directly test private or protected methods without proper exposure can lead to TypeScript errors and hinder isolated unit testing.
    *   **Mitigation**: Create a test-specific wrapper class that extends the agent under test and exposes private/protected methods as public for testing purposes. This allows for focused unit tests on internal logic without breaking encapsulation in the main codebase.

9.  **Accurate `publishToAgent` Expectations**:
    *   **Pitfall**: Mismatched expectations for messages published via `publishToAgent` (e.g., incorrect message `type` or `payload` structure) can cause tests to fail even if the agent's logic is correct.
    *   **Mitigation**: Ensure that the expected message `type` and the structure of the `payload` in `mockBus.publishToAgent` assertions precisely match what the agent is actually broadcasting. Verify the `MessageTypes` enum for correct message type strings.

10. **Investigating `result.success: false` in Expected Success Paths**:
    *   **Pitfall**: When a test case expects a successful `Result` (`result.success` to be `true`) but receives `false`, it often indicates an unhandled exception within the `try-catch` block of the method under test, or a mismatch in mock setup that leads to an unexpected error path.
    *   **Mitigation**: If `result.success` is unexpectedly `false`, it means an error was caught and returned. Use detailed logging (`this.logger.debug`, `this.logger.error`) within the agent's methods and/or a debugger to trace the execution path. Verify that all dependencies are correctly mocked and that their mocked return values align with the expected flow of the agent's logic. Look for unhandled exceptions that might be caught by a broader `try-catch` block and converted into a `Result.failure`.

By understanding and actively mitigating these pitfalls, we can improve the robustness, maintainability, and reliability of our software.

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
