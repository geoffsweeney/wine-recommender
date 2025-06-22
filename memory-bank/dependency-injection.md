# Dependency Injection Guidelines

## Testing Best Practices

1.  **Always mock all dependencies**:
    *   Identify all dependencies in the dependency chain.
    *   Create complete mock implementations for each, using `jest-mock-extended`'s `mock<T>()` for complex interfaces to ensure all methods and properties are correctly mocked.
    *   Register all mocks in the container before each test.

2.  **DI Container Setup for Tests - Isolation is Key**:
    *   **Use a factory function for test containers**: Instead of a global `testContainer`, create a factory function (e.g., `createTestContainer()`) that returns a fresh `DependencyContainer` instance for each test or `beforeEach` block. This prevents state leakage and ensures test isolation.
    *   **Example (`test-setup.ts` pattern)**:
        ```typescript
        // backend/test-setup.ts
        import { container, DependencyContainer } from 'tsyringe';
        import { mock } from 'jest-mock-extended';
        import { TYPES } from './di/Types';
        // ... other imports

        export const createTestContainer = (): { container: DependencyContainer; resetMocks: () => void } => {
          container.clearInstances(); // Clear global container instances
          container.reset(); // Reset global container registrations

          // Register mocks for all dependencies, including configs
          container.registerInstance(TYPES.Logger, mockLogger);
          container.registerInstance(TYPES.LlmApiUrl, 'http://mock-llm-api.com');
          container.registerInstance(TYPES.InputValidationAgentConfig, { /* ...mock config */ });
          // ... register all other mocks

          const resetMocks = () => {
            // Reset individual mock functions if needed
            mockLogger.debug.mockReset();
            // ... reset other mocks
          };

          return { container, resetMocks };
        };

        // Export for convenience in simple test files, but prefer using createTestContainer() directly
        export const { container: testContainer, resetMocks } = createTestContainer();
        ```
    *   **Example (`.test.ts` usage)**:
        ```typescript
        // backend/core/agents/__tests__/AgentCapabilities.test.ts
        import { createTestContainer } from '../../../test-setup';
        import { DependencyContainer } from 'tsyringe';

        describe('Agent Capabilities', () => {
          let container: DependencyContainer;
          let resetMocks: () => void;

          beforeEach(() => {
            ({ container, resetMocks } = createTestContainer());
            // Register agent classes with the container for resolution
            container.register('InputValidationAgent', { useClass: InputValidationAgent });
            // ... register other agents
          });

          afterEach(() => {
            resetMocks(); // Clean up mocks after each test
          });

          it('should return correct capabilities for InputValidationAgent', () => {
            const agent = container.resolve(InputValidationAgent);
            // ... assertions
          });
        });
        ```

3.  **Matching Injection Tokens - A Critical Detail**:
    *   The token used in `@inject(TOKEN)` must *exactly* match the token used in `container.registerInstance(TOKEN, instance)` or `container.register(TOKEN, { useClass: Class })`.
    *   **Common Pitfall**: Do NOT mix `TYPES.SomeService` (a Symbol) with `SomeService` (the class constructor itself) as injection tokens. If an agent's constructor uses `@inject(TYPES.SomeService)`, then you *must* register it with `TYPES.SomeService`.
    *   **Example**:
        ```typescript
        // Correct: If agent injects @inject(TYPES.KnowledgeGraphService)
        container.registerInstance(TYPES.KnowledgeGraphService, mockKnowledgeGraphService);

        // Incorrect: If agent injects @inject(TYPES.KnowledgeGraphService) but you register this way
        // container.registerInstance(KnowledgeGraphService, mockKnowledgeGraphService); // This will cause "unregistered dependency" errors
        ```

4.  **Comprehensive Mocking of Dependencies**:
    *   Ensure *all* dependencies of a service or agent are mocked, including primitive values or configuration objects that are injected via `TYPES` symbols (e.g., `TYPES.LlmApiUrl`, `TYPES.Neo4jUri`).
    *   If a service's constructor expects multiple individual injected values (e.g., `LLMService` expects `LlmApiUrl`, `LlmModel`, `LlmApiKey` separately), register each of these individually, even if they logically belong to a single "config" object.

5.  **Handling `Result<T, E>` Types in Mocks**:
    *   If your application uses a `Result<T, E>` pattern for error handling, ensure your mocks return objects that conform to this structure (`{ success: true, data: T }` or `{ success: false, error: E }`).
    *   **Example**:
        ```typescript
        // Correct: Mocking a service method that returns Result<string, AgentError>
        mockLlmService.sendPrompt.mockResolvedValue({ success: true, data: 'mock-llm-response' });

        // Incorrect: Will cause type errors if Result is expected
        // mockLlmService.sendPrompt.mockResolvedValue('mock-llm-response');
        ```

## Common DI Issues (Expanded)

*   **Missing dependency registration (No provider found errors)**: Often caused by not registering *all* required dependencies, or by using an incorrect injection token (see "Matching Injection Tokens" above).
*   **Circular dependencies**: Still a concern, but proper architecture and careful use of `tsyringe`'s `forwardRef` (if absolutely necessary) can mitigate.
*   **Improper mock clearing between tests**: Addressed by using a test container factory and `resetMocks()` in `afterEach`.
*   **Test Mocking Difficulties**: Especially when using deep mocks (e.g., `jest-mock-extended`) with `tsyringe`, `toHaveBeenCalled` assertions might not reliably track calls on injected dependencies. In such cases, consider:
    *   Explicitly mocking methods on the resolved instance after container resolution.
    *   Focusing on integration tests for verifying interactions.