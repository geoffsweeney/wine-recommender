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
```typescript
// All dependencies must be injected through constructor.
// Agent-specific configurations should also be injected via DI, promoting externalization and testability.
// All mandatory dependencies in `AgentDependencies` must be provided, even if with placeholder implementations
// if the full functionality is not yet available (e.g., `{}` as any for `IMessageQueue`).
interface AgentDependencies {
  readonly logger: ILogger;
  readonly messageQueue: IMessageQueue;
  readonly stateManager: IStateManager;
  readonly config: IAgentConfig;
  readonly cache?: ICache;
  readonly metrics?: IMetrics;
}

// Use factory pattern for agent creation
class AgentFactory {
  static createAgent<T extends BaseAgent>(
    AgentClass: new (id: string, config: unknown, deps: AgentDependencies) => T,
    id: string,
    config: unknown
  ): T {
    const dependencies = this.container.resolve<AgentDependencies>('AgentDependencies');
    return new AgentClass(id, config, dependencies);
  }
}
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