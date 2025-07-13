# MANDATORY CODING STANDARDS FOR AI DEVELOPMENT

This document outlines the mandatory coding standards for all AI development within the project. Adherence to these standards is critical for maintaining code quality, consistency, and ensuring successful collaboration.

**CRITICAL: Always reference this file before generating ANY code**

#### TypeScript Requirements (NON-NEGOTIABLE)
```typescript
// REQUIRED: All agent interfaces must follow this exact pattern
interface AgentMessage<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly sourceAgent: string;
  readonly targetAgent?: string;
  readonly priority?: MessagePriority;
}

// REQUIRED: All agents must extend this base class.
// Agents should implement specific message handlers for expected message types using `communicationBus.registerMessageHandler`.
// The `handleMessage` method should be used as a generic fallback for unhandled message types,
// logging a warning and returning an appropriate error.
abstract class BaseAgent<TConfig = unknown, TState = unknown> {
  protected readonly id: string;
  protected readonly config: TConfig;
  protected state: TState;
  
  constructor(
    id: string,
    config: TConfig,
    protected dependencies: AgentDependencies
  ) {
    this.id = id;
    this.config = config;
    this.state = this.getInitialState();
  }
  
  protected abstract handleMessage<T>(
    message: AgentMessage<T>
  ): Promise<AgentMessage | null>;
  
  protected abstract validateConfig(config: TConfig): void;
  protected abstract getInitialState(): TState;
}

// IMPORTANT: Always use `this.id` to refer to the agent's unique identifier. Avoid `this.agentId`.

// REQUIRED: All async operations must return Result type
type Result<T, E = AgentError> = 
  | { success: true; data: T }
  | { success: false; error: E };

// REQUIRED: Standard error class for all agent errors
class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly agentId: string,
    public readonly correlationId: string,
    public readonly recoverable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
```

**REQUIRED: Use stronger typing for data structures.**
This is crucial for type safety and code clarity. Avoid `any` where possible.
Example: For user preferences, define a specific interface.
```typescript
export interface UserPreferences {
  wineType?: string[];
  grapeVarietal?: string[];
  region?: string[];
  sweetness?: string;
  body?: string;
  [key: string]: any; // Allow for flexible preferences, but prefer specific fields
}
```

+#### Jest Testing Best Practices (MANDATORY)
+Adherence to these Jest testing best practices is crucial for maintaining test reliability, readability, and preventing common pitfalls.
+
+*   **`jest.mock` Placement:** All `jest.mock` calls **MUST** be placed at the top level of the test file, outside of any `describe` or `beforeEach` blocks. `jest.mock` calls are hoisted and processed before test execution, and placing them inside blocks can lead to unexpected behavior, re-mocking, or issues with mock resolution.
+
+*   **Avoiding Duplicate `describe` and `beforeEach` Blocks:** Test files **MUST NOT** contain duplicate `describe` or `beforeEach` blocks for the same test suite. Consolidate test setup and execution into a single, coherent structure to avoid variable re-declarations, unpredictable test execution, and maintain readability.
+
+*   **Explicit Jest Configuration:** When running specific test files or encountering `rootDir` errors, always explicitly specify the Jest configuration file using the `--config` flag (e.g., `npx jest --config jest.config.backend.js <test_file_path>`). This ensures the correct configuration is used and prevents conflicts with other potential Jest configurations or default behaviors.
+
+**Example: PromptManager and Zod Validation**
+The `PromptManager` (see `backend/services/PromptManager.ts`) serves as an excellent example of adhering to these principles. It utilizes `zod` schemas to enforce strict type validation for variables passed to LLM prompt templates, significantly enhancing type safety and data integrity beyond basic TypeScript interfaces. This pattern is highly recommended for any data structures interacting with external or untyped inputs.
+
#### Error Handling Pattern (MANDATORY)
```typescript
// Every async function (including service methods) MUST use this exact pattern.
// When communicating with other agents or services, explicitly check the `Result` type
// returned by communication methods (e.g., `sendMessageAndWaitForResponse`) to ensure
// comprehensive error management and propagation.
async function agentOperation(
  input: ValidatedInput
): Promise<Result<OutputType, AgentError>> {
  const correlationId = generateCorrelationId();
  
  try {
    // Log operation start
    this.logger.info('Starting operation', {
      correlationId,
      agentId: this.id,
      operation: 'agentOperation',
      input: sanitizeForLogging(input)
    });
    
    // Validate inputs
    const validationResult = this.validateInput(input);
    if (!validationResult.success) {
      return validationResult;
    }
    
    // Perform operation
    const result = await this.performOperation(input);
    
    // Log success
    this.logger.info('Operation completed successfully', {
      correlationId,
      agentId: this.id,
      operation: 'agentOperation',
      duration: Date.now() - startTime
    });
    
    return { success: true, data: result };
    
  } catch (error) {
    // Log error
    this.logger.error('Operation failed', {
      correlationId,
      agentId: this.id,
      operation: 'agentOperation',
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: new AgentError(
        'Operation failed',
        'AGENT_OPERATION_ERROR',
        this.id,
        correlationId,
        this.isRecoverableError(error),
        { originalError: error.message }
      )
    };
  }
}
```

#### Dependency Injection Pattern (MANDATORY)

The project utilizes `tsyringe` for Dependency Injection. All dependencies **MUST** be managed and injected through the `tsyringe` container. This ensures modularity, testability, and maintainability.

**Key Principles:**

1.  **Constructor Injection**: All dependencies **MUST** be injected through the constructor of a class. Avoid using property injection or setter injection.

    ```typescript
    import { injectable, inject } from 'tsyringe';
    import { ILogger, TYPES } from '../di/Types';
    import { IMyService } from './IMyService';

    @injectable()
    export class MyClass {
      constructor(
        @inject(TYPES.Logger) private readonly logger: ILogger,
        @inject(TYPES.MyService) private readonly myService: IMyService
      ) {}

      public doSomething(): void {
        this.logger.info('Doing something with MyService');
        this.myService.execute();
      }
    }
    ```

2.  **Typed Injection Tokens (`TYPES`)**: Always use the `TYPES` object (defined in `backend/di/Types.ts`) for injection tokens. This provides strong typing and prevents runtime errors due to string literal mismatches.

    ```typescript
    // backend/di/Types.ts
    export const TYPES = {
      Logger: createSymbol<ILogger>('Logger'),
      MyService: createSymbol<IMyService>('MyService'),
    };
    ```

3.  **Modular Registration**: Dependencies are registered in dedicated modules (`backend/di/modules/infrastructure.ts`, `backend/di/modules/services.ts`, `backend/di/modules/agents.ts`). When adding new services or agents, ensure they are registered in the appropriate module.

    ```typescript
    // Example: backend/di/modules/services.ts
    import { DependencyContainer } from 'tsyringe';
    import { TYPES } from '../Types';
    import { MyService } from '../../services/MyService';
    import { IMyService } from '../Types';
    import { ConfigurationRegistry } from '../ConfigurationRegistry';

    export function registerServices(container: DependencyContainer, configRegistry: ConfigurationRegistry) {
      container.registerSingleton<IMyService>(TYPES.MyService, MyService);
      configRegistry.registerService(TYPES.MyService, [TYPES.Logger]); // Register with its dependencies
    }
    ```

4.  **Configuration as Dependencies**: Agent-specific and service-specific configurations **SHOULD** also be injected via DI, promoting externalization and testability. These are typically registered as instances.

    ```typescript
    // Example: Registering an agent configuration
    container.registerInstance(TYPES.MyAgentConfig, {
      setting1: 'value',
      setting2: 123,
    });
    configRegistry.registerService(TYPES.MyAgentConfig, []);
    ```

5.  **Asynchronous Container Setup**: The main container setup (`backend/di/container.ts`) is asynchronous. Ensure that any code relying on the container being fully initialized `await`s the `setupContainer()` call.

    ```typescript
    // Example: backend/server.ts
    import { setupContainer } from './di/container';

    (async () => {
      const appContainer = await setupContainer();
      // Now appContainer is ready to be used
      const logger = appContainer.resolve(TYPES.Logger);
      logger.info('Application started');
    })();
    ```

6.  **No Direct Global `container.resolve()` Outside Setup**: While `tsyringe` provides a global `container` instance, direct `container.resolve()` calls outside of the initial application setup (e.g., in business logic files) **SHOULD BE AVOIDED**. Dependencies should be injected through constructors. The global `container` is primarily used during the initial application bootstrapping.

7.  **Interface-First Design**: Always define an interface for a service or component before implementing it. This promotes loose coupling and makes it easier to swap implementations or mock dependencies in tests.

    ```typescript
    // Example: Interface definition
    export interface IMyService {
      execute(): void;
    }
    ```
```

#### Logging Requirements (MANDATORY)
All logging must include these fields. Always use the injected `logger` instance.
```typescript
// All logging must include these fields
interface LogContext {
  correlationId: string;
  agentId: string;
  userId?: string;
  conversationId?: string;
  operation: string;
  timestamp?: Date;
  performance?: {
    duration: number;
    memoryUsage: number;
  };
}

// Standard logging calls
this.logger.info('Message', logContext);
this.logger.warn('Warning message', logContext);
this.logger.error('Error message', { ...logContext, error: error.message });

// NEVER log PII - always sanitize
function sanitizeForLogging(data: unknown): unknown {
  // Remove sensitive fields
  // Truncate large objects
  // Return safe data for logging
}
```

**Best Practice:** Always perform null/undefined checks when accessing optional properties of `AgentMessage.metadata` (e.g., `message.metadata?.traceId`).

#### Frontend Error Handling (MANDATORY FOR REACT APPS)
```typescript
// REQUIRED: All frontend errors must extend AppError
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// REQUIRED: All React apps must use ErrorBoundary at root level
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<
  PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // REQUIRED: Log to error reporting service
  }

  render() {
    if (this.state.hasError) {
      // REQUIRED: Show user-friendly error fallback
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
```