# Wine Recommendation App - Architecture Summary (Updated)

## Current System (LLM-Driven Agent Architecture)
```mermaid
graph TD
    subgraph User Interface
        FE[Frontend (Next.js)]
    end

    subgraph Backend (Node.js)
        API[API Route (/api/chat)]
        RateLimit[Rate Limiter]
        AgentSys[LLMDrivenAgentSystem]
        Orchestrator(LLM Orchestrator)
        AgentReg[Agent Registry]
        AgentBus[Agent Communication Bus]
        Context[Shared Context Memory]
        DB[(Database)]
        DI[DI Container (tsyringe)]
        Services[Services (Ollama, Cache, etc.)]
    end

    subgraph Agents
        SA[SommelierAgent]
        MCPA[MCPAdapterAgent]
    end
    
    subgraph External
        BuyerMCP[(Buyer Agent MCP Server)]
    end

    FE -->|HTTP| API
    API -->|Rate Limited| RateLimit
    API -->|AgentMessage| AgentSys
    AgentSys -->|ContextModel| Orchestrator
    Orchestrator -->|Decision| Services
    Orchestrator -->|Tool| AgentReg --> SA & MCPA
    AgentReg -->|Register| AgentBus
    AgentBus -->|Subscribe| Context
    MCPA -->|MCP| BuyerMCP
    API -->|Save| DB
    
    %% New Memory and Streaming Components
    AgentSys --> Memory[Context Memory System]
    Memory -->|Persistent| DB
    Memory -->|Ephemeral| Redis[(Redis Streams)]
    AgentBus --> WebSocketServer[WebSocket Server]
    WebSocketServer -->|WebSocket| FE
```

## Key Components
1. **Frontend**: Next.js 14 + React + Tailwind CSS
2. **Core System**:
   - `LLMDrivenAgentSystem`: Main orchestrator (uses `LLMOrchestrator` internally)
   - `AgentRegistry`: Discovers and manages agents
   - `DynamicDecisionParser`: Handles LLM action parsing
   - `KnowledgeGraphService`: Manages wine relationships
3. **Agents**:
   - `RecommendationAgent`: Core wine pairing suggestions
   - `ValueAnalysisAgent`: Price/availability evaluation
   - `UserPreferenceAgent`: Handles constraints/allergies
   - `InputValidationAgent`: Input quality/ambiguity resolution
   - `ExplanationAgent`: Wine education responses
   - `FallbackAgent`: Graceful degradation handler
   - `SommelierCoordinator`: Lightweight orchestration
   - `MCPAdapterAgent`: Bridges to MCP servers
3. **Resilience**:
   - `RateLimiter`: API request throttling
     - 100 requests/15 minutes per endpoint per IP
     - Standard headers (RateLimit-*)
     - Custom 429 responses
   - `CircuitBreaker`: Protects external services
     - States: Closed (initial), Open, Half-Open
     - Events: Emits state changes (open, half-open, closed)
     - Note: Initial closed state is not emitted
   - `RetryManager`: Sophisticated retry policies
   - `DeadLetterProcessor`: Failed message analysis
4. **Services**:
   - `McpClientService`: MCP communication
   - `OllamaService`: LLM integration
   - `CacheService`: Performance optimization

## Enhanced Agentic Patterns
1. **Agent Communication Bus**:
   - Pub/sub model for agent coordination
   - Supports direct and broadcast messaging
   - Message persistence for audit trails
   - Context sharing capabilities:
     * Set/get context with metadata
     * Share context between specific agents
     * Broadcast context to all agents
   - Integrated with Shared Context Memory

2. **Shared Context Memory**:
   - Short-term: In-memory working memory (Redis placeholder)
   - Long-term: Vector database for knowledge retention
   - Context versioning and snapshotting
   - Upgrade path to Redis via configuration

3. **LLM Reasoning Protocols**:
   - Chain-of-thought prompting
   - Reflection and self-critique steps
   - Confidence scoring for decisions

## Communication Patterns
- **Agent Messaging**:
  ```typescript
  interface AgentEnvelope<T> {
    metadata: {
      traceId: string;
      priority: 'HIGH' | 'NORMAL';
      expiration?: Date;
      correlationId: string; // Added for distributed tracing
    };
    payload: T;
  }
  ```
- **WebSocket Streaming (Agent Conversations)**:
  - A WebSocket server in the backend streams agent conversation messages from the Agent Communication Bus to the frontend in real-time.
  - This allows users to observe the internal reasoning process of the agents.
- **Message Queues**:
  - Redis Streams for high-throughput operations
  - RabbitMQ for complex routing needs
  - Message TTL policies for automatic expiration
- **MCP Integration**:
  - TLS 1.3 encrypted channels
  - Protobuf serialization
- **Error Handling**:
  - Circuit breakers with half-open state monitoring
  - Tiered retry policies (immediate, delayed, final attempt)
  - Error classification (recoverable vs fatal)
- **Observability**:
  - Structured logging with minimal OpenTelemetry API
  - Performance metrics (decision latency, error rates)
  - Basic tracing spans for agent workflows

## Technical Validation
```mermaid
graph RL
    A[Best Practice] --> B[Current Choice]
    B --> C[Justification]
    
    A1[Message Durability] --> B1[Redis+RabbitMQ]
    B1 --> C1[Guaranteed delivery]
    
    A2[Type Safety] --> B2[TypeScript+Zod]
    B2 --> C2[End-to-end validation]
    
    A3[Observability] --> B3[Minimal OpenTelemetry]
    B3 --> C3[Lightweight tracing]
    
    A4[Knowledge Management] --> B4[Neo4j Graph]
    B4 --> C4[Relationship-based reasoning]
    
    A5[Resilience] --> B5[Circuit Breakers]
    B5 --> C5[Fault isolation]
    
    A6[Agent Hierarchy] --> B6[Escalation Policies]
    B6 --> C6[Graceful degradation]
    
    A7[Streaming] --> B7[WebSocket+Redis Streams]
    B7 --> C7[Real-time updates]
```

## Implementation Status
- **Phase**: Integration and Testing
- **Current State**:
  - Basic Agent Interface and Base Agent Class implemented.
  - Input Validation Agent, Recommendation Agent, and Sommelier Coordinator implemented (basic functionality).
  - Basic Knowledge Graph Service interaction implemented.
  - Basic end-to-end flow from API endpoint through agents to Knowledge Graph Service is working.
  - Data loading script for Neo4j is available and functional.
  - Integration test for the recommendations endpoint created and is passing.
  - Existing validation tests in `validation.test.ts` are currently failing (deferred for later).
  - Tech stack validated and in use.
  - Initial API endpoints operational.

## Remaining Tasks (Following Revised POC Plan)
**Phase 4: Advanced Features (Iterative)**
1. Implement User Preference Agent
2. Implement Value Analysis Agent
3. Implement Explanation Agent
4. Implement MCP Adapter Agent
5. Implement Agent Communication Bus
6. Implement Shared Context Memory
7. Implement Circuit Breaker, Retry Manager, Dead Letter Processor
8. Address deferred failing tests in `validation.test.ts`.
9. Implement comprehensive test coverage for all new features.
10. Deployment and Monitoring setup.