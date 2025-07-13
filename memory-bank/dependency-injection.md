# Refactoring Dependency Injection System - Plan

This plan outlines the steps to refactor the TypeScript Node.js application's dependency injection system using `tsyringe`, addressing circular dependencies, inconsistent registration patterns, and stability issues.

## Phase 1: Foundation Setup

This phase focuses on establishing the core components for a robust DI system.

*   **Enhance Types System:**
    *   **Objective:** Update [`di/Types.ts`](backend/di/Types.ts) to use typed symbols with `createSymbol<T>()` helper and define proper interfaces for all services. Remove concrete class dependencies and add configuration interfaces.
    *   **Key Deliverables:** Full type safety for all registrations, interface-based service definitions, configuration type definitions, and proper symbol typing.

*   **Create ContainerManager:**
    *   **Objective:** Create [`di/ContainerManager.ts`](backend/di/ContainerManager.ts) to implement a singleton pattern for container management, support for child containers, container lifecycle management, and container validation methods.
    *   **Key Deliverables:** Thread-safe singleton implementation, proper error handling, and support for container clearing/reset.

*   **Build ConfigurationRegistry:**
    *   **Objective:** Create [`di/ConfigurationRegistry.ts`](backend/di/ConfigurationRegistry.ts) for service configuration management, dependency graph validation, topological sorting for initialization order, and circular dependency detection.
    *   **Key Deliverables:** Detection of circular dependencies at setup time, clear error messages, support for different lifecycle patterns, and configuration validation.

## Phase 2: Modular Registration

This phase involves organizing service registrations into logical modules.

*   **Implement Infrastructure Module:**
    *   **Objective:** Create [`di/modules/infrastructure.ts`](backend/di/modules/infrastructure.ts) to handle logger setup (winston), database connections (Neo4j), external service connections, and circuit breaker configuration.
    *   **Key Deliverables:** Environment-based configuration, proper connection pooling, health check implementations, and graceful failure handling.

*   ****Create Services Module:**
    *   **Objective:** Create [`di/modules/services.ts`](backend/di/modules/services.ts) to register `LLMService` with proper factory, `Neo4jService` with connection management, `KnowledgeGraphService`, and `PromptManager` with configuration.
    *   **Key Deliverables:** Factory patterns for complex services, proper dependency injection, configuration-driven setup, and service validation.

*   **Build Agents Module:**
    *   **Objective:** Create [`di/modules/agents.ts`](backend/di/modules/agents.ts) to handle agent communication bus, agent registry, agent configurations, and agent lifecycle management.
    *   **Key Deliverables:** No direct agent-to-agent dependencies, communication bus pattern, configuration-driven agent setup, and proper agent initialization order.

## Phase 3: Container Setup

This phase focuses on refactoring the main container and integrating it with the server.

*   **Refactor Main Container:**
    *   **Objective:** Refactor [`di/container.ts`](backend/di/container.ts) to use a `DependencySetup` class, implement proper initialization phases, add comprehensive validation, and support graceful failure.
    *   **Key Deliverables:** Async setup with proper error handling, phase-based initialization, container validation, and environment-specific configurations.

*   **Update Server Integration:**
    *   **Objective:** Update [`server.ts`](backend/server.ts) to use async container setup, implement proper health checks, add graceful shutdown, and support container-aware routing.
    *   **Key Deliverables:** Async server startup, health check with service validation, proper error handling, and container-aware middleware.

## Phase 4: Testing and Validation

This phase ensures the correctness and stability of the refactored system.

*   **Add Comprehensive Tests:**
    *   **Objective:** Create [`tests/di/container.test.ts`](tests/di/container.test.ts) and other relevant test files for container setup validation, service resolution tests, circular dependency detection tests, and configuration validation tests.
    *   **Key Deliverables:** Comprehensive test coverage, mock external dependencies, test container lifecycle, and validation of error scenarios.

*   **Add Debugging Utilities:**
    *   **Objective:** Create [`di/utils/ContainerDebugger.ts`](backend/di/utils/ContainerDebugger.ts) to provide debugging and maintenance tools for the DI container.
    *   **Key Deliverables:** Enhanced visibility into container state and dependencies.

## Implementation Order (Summary)

1.  Enhance [`di/Types.ts`](backend/di/Types.ts)
2.  Create [`di/ContainerManager.ts`](backend/di/ContainerManager.ts)
3.  Build [`di/ConfigurationRegistry.ts`](backend/di/ConfigurationRegistry.ts)
4.  Implement [`di/modules/infrastructure.ts`](backend/di/modules/infrastructure.ts)
5.  Create [`di/modules/services.ts`](backend/di/modules/services.ts)
6.  Build [`di/modules/agents.ts`](backend/di/modules/agents.ts)
7.  Refactor main [`di/container.ts`](backend/di/container.ts)
8.  Update [`server.ts`](backend/server.ts) integration
9.  Add comprehensive tests
10. Add debugging utilities