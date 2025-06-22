# ARCHITECTURE PATTERNS FOR AI DEVELOPMENT

This document outlines key architectural patterns and best practices for developing robust and scalable AI agents. Adherence to these patterns ensures consistency, maintainability, and high quality across the system.

#### Agent Communication Protocol
Agents should implement specific message handlers for expected message types and use the `handleMessage` method as a generic fallback for unhandled messages. This ensures clear separation of concerns and robust error handling for unexpected inputs.

**Best Practice:** When registering message handlers, if the handler function expects a more specific payload type than `AgentMessage<unknown>`, explicitly cast the function using `as (message: AgentMessage<unknown>) => Promise<Result<AgentMessage | null, AgentError>>` to satisfy TypeScript.

```typescript
// Message routing pattern
interface MessageRouter {
  route<T>(message: AgentMessage<T>): Promise<void>;
  subscribe(agentId: string, messageType: string, handler: MessageHandler): void;
  unsubscribe(agentId: string, messageType: string): void;
}

// State management pattern
interface ConversationState {
  readonly id: string;
  readonly userId: string;
  readonly phase: ConversationPhase;
  readonly context: ConversationContext;
  readonly history: readonly StateChange[];
  readonly metadata: StateMetadata;
}

// State transitions must be atomic
class StateManager {
  async updateState(
    conversationId: string,
    updater: (current: ConversationState) => ConversationState
  ): Promise<Result<ConversationState, StateError>> {
    // Implement optimistic locking
    // Validate state transitions
    // Persist changes atomically
    // Emit state change events
  }
}
```

#### Caching Strategy
```typescript
// Multi-level caching implementation
interface CacheConfig {
  l1: InMemoryCacheConfig;  // Agent-level cache
  l2: DistributedCacheConfig; // Redis cache
  l3: QueryCacheConfig;     // Database query cache
}

const CACHE_KEYS = {
  WINE_DATA: (id: string) => `wine:${id}`,
  USER_PREFERENCES: (userId: string) => `user:prefs:${userId}`,
  AGENT_RESPONSE: (agentId: string, hash: string) => `agent:${agentId}:${hash}`,
  CONVERSATION: (id: string) => `conversation:${id}`
} as const;

const CACHE_TTL = {
  WINE_DATA: 3600,        // 1 hour
  USER_PREFERENCES: 1800,  // 30 minutes
  AGENT_RESPONSE: 300,     // 5 minutes
  CONVERSATION: 600        // 10 minutes
} as const;
```

#### Database Access Patterns
```typescript
// Repository pattern for data access
interface WineRepository {
  findByIngredients(ingredients: string[]): Promise<Wine[]>;
  findByPriceRange(min: number, max: number): Promise<Wine[]>;
  findSimilar(wineId: string): Promise<Wine[]>;
}

// Query optimization requirements
class WineRepositoryImpl implements WineRepository {
  async findByIngredients(ingredients: string[]): Promise<Wine[]> {
    // MUST: Use prepared statements
    // MUST: Implement query caching
    // MUST: Add performance monitoring
    // MUST: Handle connection pooling
    // MUST: Complete in < 200ms
  }
}

#### Backend Service Patterns
```typescript
// Service Layer Pattern
// All service methods that perform asynchronous operations or can fail MUST return a `Result` type.
// This ensures consistent error handling and propagation across the application.
interface ServiceResult<T> { // This is equivalent to the `Result` type defined in coding-standards.md
  success: boolean;
  data?: T;
  error?: ServiceError; // Or AgentError, depending on context
  metadata?: ResultMetadata;
}

interface ServiceError { // This is equivalent to the `AgentError` type defined in coding-standards.md
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

// Error Handling with Circuit Breakers for Services
// Services interacting with external dependencies (databases, APIs) should utilize Circuit Breakers
// to prevent cascading failures and provide graceful degradation.
// The `Neo4jCircuitWrapper` is an example of this pattern.

// Controller Pattern
abstract class BaseController {
  protected async handleRequest<T>(
    req: Request,
    res: Response,
    handler: () => Promise<ServiceResult<T>>
  ): Promise<void> {
    try {
      const result = await handler();
      
      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          metadata: result.metadata
        });
      } else {
        res.status(result.error?.statusCode || 400).json({
          success: false,
          error: result.error?.message || 'Unknown error',
          code: result.error?.code || 'UNKNOWN_ERROR'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

// Middleware Pattern
interface AuthenticatedRequest extends Request {
  user?: User;
}

const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Auth logic
};
```

#### Distributed Tracing with traceId

Trace IDs are essential for correlating logs across multiple agents in distributed systems. The following standards govern their implementation:

##### Propagation Rules
1. The originating agent generates the initial `correlationId` (used as `traceId`).
2. All subsequent agents must preserve the original `correlationId`.
3. `correlationId`s must be propagated through all message metadata.
4. External service calls must include `correlationId` in headers (e.g., `X-Trace-Id`).

**Best Practice:** Always perform null/undefined checks when accessing optional properties of `AgentMessage.metadata` (e.g., `message.metadata?.traceId`).

##### Logging Requirements
- Every log statement must include `correlationId` (used as `traceId`) in the log context.
- Example: `this.logger.info('Processing recommendation', { correlationId, agentId: this.id, operation: 'process' });`
- Error logs must include `correlationId` and relevant context, including the original error message.
- Log formats must be consistent across all services, adhering to the `LogContext` interface.

##### Implementation
```typescript
// In CommunicatingAgent base class
protected generateTraceId(): string {
  return `${this.agentId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Message handling with traceId context
async handleMessage<T>(message: AgentMessage<T>) {
  const correlationId = message.correlationId; // Use correlationId as traceId
  this.logger.info(`[${correlationId}] Handling ${message.type}`, {
    agentId: this.id,
    operation: `handleMessage:${message.type}`,
    correlationId: correlationId
  });
  
  try {
    // Message processing logic
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`[${correlationId}] Processing failed: ${errorMessage}`, {
      agentId: this.id,
      operation: `handleMessage:${message.type}`,
      correlationId: correlationId,
      originalError: errorMessage
    });
    // this.sendToDLQ(message, error); // Assuming DLQ handling is external or part of specific handlers
  }
}

// Propagating traceId to downstream services
const response = await fetch(serviceUrl, {
  headers: {
    'X-Trace-Id': traceId,
    // ... other headers
  }
});
```

##### Best Practices
- Generate `correlationId`s in a collision-resistant format.
- Include `correlationId` in all error responses.
- Configure log aggregators to index by `correlationId`.
- Validate `correlationId` propagation in integration tests.

#### Agent Configuration Pattern
Agent-specific configurations should be externalized and injected via Dependency Injection. This promotes modularity, testability, and allows for easy modification of agent behavior without code changes.

```typescript
// Example: Injecting agent-specific configuration
@injectable()
export class MyAgent extends CommunicatingAgent {
  constructor(
    // ... other dependencies
    @inject(TYPES.MyAgentConfig) private readonly agentConfig: MyAgentConfig
  ) {
    super('my-agent-id', agentConfig, { /* ... dependencies */ });
    // ...
  }
}

// Configuration interface
export interface MyAgentConfig {
  param1: string;
  param2: number;
}

// In DI container setup (e.g., container.ts)
container.registerInstance(TYPES.MyAgentConfig, {
  param1: 'value',
  param2: 123
});
```

#### Agent Configuration Pattern
Agent-specific configurations should be externalized and injected via Dependency Injection. This promotes modularity, testability, and allows for easy modification of agent behavior without code changes.

**Best Practice:** Define a specific interface for each agent's configuration and register it as an instance in the DI container (`container.ts`).

```typescript
// Example: Injecting agent-specific configuration
@injectable()
export class MyAgent extends CommunicatingAgent {
  constructor(
    // ... other dependencies
    @inject(TYPES.MyAgentConfig) private readonly agentConfig: MyAgentConfig // Inject the specific agent config
  ) {
    // Pass the injected agentConfig to the super constructor as the agent's config
    const dependencies: CommunicatingAgentDependencies = {
      // ... other dependencies
      config: agentConfig as any // Use the injected config
    };
    super('my-agent-id', agentConfig, dependencies);
    // ...
  }
}

// Configuration interface (e.g., in Types.ts or agent's file)
export interface MyAgentConfig {
  param1: string;
  param2: number;
}

// In DI container setup (e.g., container.ts)
// Add TYPES.MyAgentConfig: Symbol.for('MyAgentConfig') to Types.ts
container.registerInstance(TYPES.MyAgentConfig, {
  param1: 'value',
  param2: 123
});
```

#### Frontend Architecture Patterns
```typescript
// Component Architecture Pattern
interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Server Component Pattern
interface ServerComponentProps {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

// API Route Pattern
interface APIRouteContext {
  params: { [key: string]: string };
}

type APIResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// State Management Pattern (Zustand)
interface AppState {
  user: User | null;
  wines: Wine[];
  preferences: UserPreferences;
  loading: boolean;
  error: string | null;
}

interface AppActions {
  setUser: (user: User | null) => void;
  addWine: (wine: Wine) => void;
  updatePreferences: (preferences: UserPreferences) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type AppStore = AppState & AppActions;
```

#### Test Patterns for Agent Development
```typescript
// Service Mocking Pattern
const mockLLMService = {
  generateResponse: jest.fn()
    .mockResolvedValueOnce(validResponse) // Happy path
    .mockRejectedValueOnce(new Error('Service unavailable')) // Error case
} as unknown as LLMService;

// Knowledge Graph Mocking Pattern
const mockKnowledgeGraph = {
  findSimilarWines: jest.fn()
    .mockImplementation(async (wineId: string) => {
      return testWines.filter(w => w.id !== wineId);
    })
} as unknown as KnowledgeGraphService;

// Message Handler Test Pattern
describe('handleRecommendationRequest', () => {
  it('should process valid requests', async () => {
    // Arrange
    const agent = new RecommendationAgent(mockLLMService, mockKnowledgeGraph);
    const message = createTestMessage(validRequest);
    
    // Act
    const result = await agent.handle(message);
    
    // Assert
    expect(result).toMatchObject(expectedResponse);
    expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(1);
  });

  it('should handle service errors', async () => {
    // Arrange
    const agent = new RecommendationAgent(mockLLMService, mockKnowledgeGraph);
    const message = createTestMessage(validRequest);
    
    // Act & Assert
    await expect(agent.handle(message))
      .rejects.toThrow('Failed to generate recommendation');
  });
});

// Input Validation Test Patterns
describe('InputValidationAgent', () => {
  it('should validate structured input', async () => {
    const agent = new InputValidationAgent(mockBus);
    const message = createTestMessage(validInput);
    
    await agent.handle(message);
    expect(mockBus.sendToAgent).toHaveBeenCalledWith(
      'RecommendationAgent',
      expect.objectContaining({ validated: true }),
      'validated-input'
    );
  });

  it('should reject invalid input format', async () => {
    const agent = new InputValidationAgent(mockBus);
    const message = createTestMessage(invalidInput);
    
    await expect(agent.handle(message))
      .rejects.toThrow('Invalid input format');
    expect(mockBus.sendToDeadLetter).toHaveBeenCalled();
  });

  it('should forward preferences when present', async () => {
    const agent = new InputValidationAgent(mockBus);
    const message = createTestMessage(inputWithPreferences);
    
    await agent.handle(message);
    expect(mockBus.sendToAgent).toHaveBeenCalledWith(
      'UserPreferenceAgent',
      expect.objectContaining({ preferences }),
      'preference-update'
    );
  });
});

// LLM Validation Test Pattern
describe('LLM-based validation', () => {
  it('should validate free-text input via LLM', async () => {
    mockBus.sendLLMPrompt.mockResolvedValue(JSON.stringify({
      isValid: true,
      processedInput: { /*...*/ }
    }));
    
    const agent = new InputValidationAgent(mockBus);
    const message = createTestMessage(freeTextInput);
    
    await agent.handle(message);
    expect(mockBus.sendLLMPrompt).toHaveBeenCalledWith(
      expect.stringContaining('Validate this wine request')
    );
  });
});

// Test Helper Pattern
function createTestMessage<T>(content: T): AgentMessage<T> {
  return {
    id: uuid(),
    timestamp: new Date(),
    sender: 'test-agent',
    recipient: 'recommendation-agent',
    content,
    metadata: { testRun: true }
  };
}
```