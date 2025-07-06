# Testing Requirements

This document outlines the testing requirements for all components within the project, ensuring quality, reliability, and maintainability.

## General Testing Requirements

1.  **Code Coverage**:
    *   All new code must have a minimum of 80% line and branch coverage.
    *   Critical components (e.g., agents, core services) should aim for 90%+ coverage.

2.  **Test Types**:
    *   **Unit Tests**: Focus on individual functions, methods, or classes in isolation. Mock all external dependencies.
    *   **Integration Tests**: Verify interactions between multiple components (e.g., agent communication, service-to-database interactions).
    *   **End-to-End (E2E) Tests**: Simulate real user scenarios to ensure the entire system functions as expected (e.g., API calls, UI interactions).

3.  **Test Naming Conventions**:
    *   Tests should be named clearly and descriptively, following the pattern: `should [expected outcome] when [condition]`.
    *   Test files should be named `[ComponentName].test.ts`.

4.  **Assertions**:
    *   Use clear and specific assertions. Avoid overly broad assertions.
    *   Assert on both positive (success) and negative (error) paths.

5.  **Performance Tests**:
    *   Key API endpoints and computationally intensive operations should have performance tests to monitor latency and throughput.

6.  **Security Tests**:
    *   All components handling sensitive data or exposed to external networks must undergo security testing (e.g., penetration testing, vulnerability scanning).

## Agent-Specific Testing Requirements

1.  **Message Handling**:
    *   Each agent must have tests verifying its `handleMessage` method correctly processes all expected message types.
    *   Tests must ensure unhandled message types are appropriately logged and/or dead-lettered.

2.  **Input Validation**:
    *   Agents receiving external input must have tests for input validation, ensuring invalid inputs are rejected and handled gracefully.

3.  **Output Consistency**:
    *   Tests must verify that agent outputs conform to defined schemas and types.

4.  **Error Propagation**:
    *   Tests must ensure that errors are correctly propagated through the agent communication bus using `AgentError` types.
    *   Verify that critical errors lead to appropriate dead-letter processing.

5.  **Idempotency**:
    *   For operations that should be idempotent, tests must confirm that repeated calls produce the same result without unintended side effects.

## Lessons Learned from RecommendationAgent Test Failures

To enhance future testing efforts and prevent similar issues, the following specific requirements are added based on recent debugging experiences:

1.  **Strict Log Expectation Management**:
    *   **Requirement**: All tests asserting on log messages (`logger.info`, `logger.warn`, `logger.error`, `logger.debug`) must use `expect.stringContaining()` for the message string and `expect.objectContaining()` for the context object, or `expect.any(Object)` if the context is not strictly defined.
    *   **Rationale**: Exact string matching for log messages is brittle and leads to frequent test failures when minor changes are made to log content. Using partial matches for strings and object containing for context allows for more robust tests that are less sensitive to minor refactorings.

2.  **Explicit Error Simulation Strategy**:
    *   **Requirement**: When testing error handling, the mock implementation for the failing dependency must precisely mimic the error propagation mechanism of the actual code (e.g., throwing an `Error`, returning a `Result.failure`, or rejecting a Promise).
    *   **Rationale**: Mismatched error simulation (e.g., mocking a function to return a failed `Result` when the actual code throws an exception) leads to tests that pass but do not accurately reflect real-world error handling, making them ineffective at catching bugs.

3.  **Comprehensive Error Path Testing**:
    *   **Requirement**: For every function or method that can produce an error, there must be at least one test case specifically designed to trigger and verify the handling of that error. This includes internal errors, external service failures, and invalid inputs.
    *   **Rationale**: Focusing only on "happy paths" leaves critical error handling logic untested, leading to unexpected behavior and crashes in production.

4.  **Realistic Asynchronous Error Simulation**:
    *   **Requirement**: When testing asynchronous operations that can fail, use `mockRejectedValueOnce()` for Promises or `mockImplementationOnce(() => { throw new Error('...'); })` for synchronous errors within asynchronous flows to accurately simulate failures.
    *   **Rationale**: Incorrectly simulating asynchronous errors can lead to false positives where tests pass but the error handling logic is never truly exercised.

5.  **Regular Test Review and Refinement**:
    *   **Requirement**: As part of code reviews and feature development, tests must be reviewed for accuracy, relevance, and adherence to current best practices. Outdated or brittle tests should be refactored or removed.
    *   **Rationale**: Tests are living documents that need to evolve with the codebase. Neglecting test maintenance leads to a decaying test suite that provides diminishing value and increases development overhead.

6.  **`createAgentMessage` Argument Order Adherence**:
    *   **Requirement**: When using the `createAgentMessage` helper function, always ensure arguments are passed in the correct positional order as defined by its signature (`type, payload, sourceAgent, conversationId, correlationId, targetAgent?, userId?, priority?, metadata?`).
    *   **Rationale**: Incorrect argument order, especially with optional parameters, can lead to subtle type errors and unexpected behavior. Explicitly pass `undefined` for optional arguments if they are not being used to maintain correct positional mapping for subsequent arguments.

7.  **Test Wrapper for Private/Protected Methods**:
    *   **Requirement**: For unit testing private or protected methods of agents, a test-specific wrapper class extending the agent must be created. This wrapper should expose the private/protected methods as public for direct testing.
    *   **Rationale**: This practice allows for isolated and thorough testing of internal agent logic while preserving encapsulation in the production code.

8.  **Precise `publishToAgent` and `sendResponse` Expectations**:
    *   **Requirement**: Assertions involving `mockBus.publishToAgent` and `mockBus.sendResponse` must accurately reflect the message `type` and the complete structure of the `payload` that the agent is expected to send.
    *   **Rationale**: Mismatches in message types (e.g., expecting `'preferences-updated'` when the agent sends `'preference-update'`) or payload content can lead to false test failures. Verify the `MessageTypes` enum for correct message type strings and ensure payload objects match the expected structure.

9.  **Robust Handling of Expected Success Paths**:
    *   **Requirement**: Test cases designed to verify successful execution paths must ensure that `Result.success` is `true`. If `Result.success` is unexpectedly `false`, it indicates an underlying issue that needs investigation.
    *   **Rationale**: An unexpected `Result.failure` in a success path often points to an unhandled exception within the method's `try-catch` block, or a misconfigured mock that leads to an unintended error flow. Debugging should focus on identifying the source of the exception or the incorrect mock behavior.

By adhering to these enhanced testing requirements, we aim to significantly reduce the occurrence of hard-to-debug issues and improve the overall quality and stability of the wine recommender system.
