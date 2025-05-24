# System Patterns

## Architecture Overview (LLM-Driven Agent System)
```mermaid
graph TD
    subgraph User Interface
        FE[Frontend (Next.js)]
    end

    subgraph Backend (Node.js)
        API[API Route (/api/chat)]
        AgentSys[LLMDrivenAgentSystem]
        Orchestrator(LLM Orchestrator)
        AgentReg[Agent Registry]
        DB[(Database)]
        DI[DI Container (tsyringe)]
        Services[Services (Ollama, Cache, etc.)]
    end

    subgraph Agents (Implement Agent Interface)
        direction LR
        SA[SommelierAgent]
        MCPA[MCPAdapterAgent]
        OtherAgents[...]
    end
    
    subgraph External Systems
        MCPClient[MCP Client Service]
        BuyerMCP[(Buyer Agent MCP Server)]
    end

    FE -->|HTTP Request| API
    API -->|Create AgentMessage| AgentSys
    AgentSys -->|Build ContextModel| Orchestrator
    Orchestrator -->|Get State| ContextModel(Internal State)
    Orchestrator -->|Decide Action (LLM Call)| Services
    Orchestrator -->|Execute Tool| ToolExecutor(Internal) --> AgentReg
    AgentReg -->|Get Agent| SA
    AgentReg -->|Get Agent| MCPA
    ToolExecutor -->|Call Agent.receive| SA
    ToolExecutor -->|Call Agent.receive| MCPA
    MCPA -->|Call MCP Tool| MCPClient --> BuyerMCP
    SA -->|Use Services| Services
    SA -->|AgentResponse| ToolExecutor
    MCPA -->|AgentResponse| ToolExecutor
    ToolExecutor -->|Tool Result| Orchestrator
    Orchestrator -->|Update State| ContextModel
    Orchestrator -->|OrchestratorResult| AgentSys
    AgentSys -->|Map to AgentResponse| API
    API -->|Save History| DB
    API -->|HTTP Response| FE

    style AgentSys fill:#cde,stroke:#333,stroke-width:2px
    style Orchestrator fill:#f9d,stroke:#333,stroke-width:1px
```

## Key Components
1.  **Frontend:** Next.js application providing the chat interface.
2.  **Backend:** Node.js server hosting the API and core logic.
    *   **API Route (`/api/chat.ts`):** Handles requests, manages session, creates initial `AgentMessage`, interacts with `LLMDrivenAgentSystem`, saves history, formats final HTTP response. Includes feature flag (`USE_NEW_AGENT_SYSTEM`) for migration.
    *   **LLMDrivenAgentSystem (`LLMDrivenAgentSystem.ts`):** Top-level orchestrator. Receives `AgentMessage`, translates to `ContextModel` for the underlying `LLMOrchestrator`, calls `LLMOrchestrator.processTurn`, translates result back to `AgentResponse`.
    *   **LLM Orchestrator (`LLMOrchestrator.ts`):** Uses LLM (via `OllamaService`) to decide next action based on `ContextModel` state and available tools (still uses internal `ToolExecutor` and `toolRegistry`).
    *   **Agent Registry (`AgentRegistry.ts`):** Discovers and provides access to registered `Agent` implementations.
    *   **Dynamic Decision Parser (`DynamicDecisionParser.ts`):** Flexibly parses LLM responses to extract intended actions (used internally by `LLMOrchestrator` or potentially `LLMDrivenAgentSystem` in future refinements).
    *   **Context Model (`ContextModel.ts`):** Internal state representation used by `LLMOrchestrator`. Populated from `AgentMessage.context`.
    *   **Database Service:** Persists conversation history.
    *   **DI Container (`container.ts`):** Manages service/agent instantiation and injection using `tsyringe`.
    *   **Services:** Shared services like `OllamaService`, `CacheService`, `McpClientService`, `Logger`, etc.
3.  **Agents (Implement `Agent` Interface):** Encapsulate specific business logic or external system interactions.
    *   **`Agent` Interface (`AgentTypes.ts`):** Defines standard properties (`id`, `capabilities`) and the `receive(message: AgentMessage)` method.
    *   **Sommelier Agent (`SommelierAgent.ts`):** Implements `Agent`. Handles wine recommendation and value analysis logic. Invoked via its `receive` method.
    *   **MCP Adapter Agent (`MCPAdapterAgent.ts`):** Implements `Agent`. Acts as a bridge to MCP servers. Receives messages, calls `McpClientService` to invoke tools on external servers (like the Buyer Agent).
    *   **Buyer Agent (MCP Server):** External process handling price/availability research via MCP.
4.  **Data Flow:** User input triggers API -> API creates `AgentMessage` -> `LLMDrivenAgentSystem` receives message -> System builds `ContextModel` -> System calls `LLMOrchestrator.processTurn` -> Orchestrator uses LLM, decides action, executes via internal `ToolExecutor` (which might call an Agent's `receive` method via `AgentRegistry`) -> Orchestrator returns result -> System maps result to `AgentResponse` -> API saves history -> API sends HTTP response.

## Design Patterns
- **Agent-Based Architecture:** System composed of autonomous agents communicating via messages (`AgentMessage`, `AgentResponse`).
- **Agent Communication System:** Pub/Sub messaging with InMemoryBroker, Dead Letter Queue, and type-safe envelopes (see [agent-communication.md]).
- **LLM Orchestrator Pattern:** Still used internally by `LLMDrivenAgentSystem` to determine workflow steps based on state (`ContextModel`).
- **Adapter Pattern:** `MCPAdapterAgent` adapts the internal `Agent` interface to the external MCP protocol via `McpClientService`. `LLMDrivenAgentSystem` adapts the API layer to the `LLMOrchestrator`.
- **Dependency Injection:** Using `tsyringe` container (`container.ts`).
- **Strategy Pattern:** Used within `RecommendationParserService` and potentially `DynamicDecisionParser`.
- **Feature Flag:** Used in `chat.ts` for migrating between old and new orchestration logic.

## Communication Protocols
- **REST API:** Frontend-backend.
- **Agent Messages:** Internal communication between `LLMDrivenAgentSystem` and registered `Agent` implementations (via `receive` method). Standardized structure (`AgentMessage`, `AgentResponse`).
- **MCP:** For `MCPAdapterAgent` to communicate with external MCP servers (via `McpClientService`).
- **Database Interface:** Backend-to-database.
