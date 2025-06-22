# Plan: Refine Tsyringe Dependency Injection with Type-Safe Practices

**Goal:** Improve the manageability, stability, and type safety of the dependency injection setup using `tsyringe`, leading to simpler and smaller classes.

This plan outlines the steps to refactor the existing `tsyringe` implementation to consistently use type-safe practices, primarily focusing on constructor injection and appropriate dependency registration.

## Phase 1: Audit and Refactor Dependency Registration in `backend/server.ts`

*   **Objective:** Ensure all dependencies are registered consistently using type-safe methods (class constructors or Symbols/Tokens for interfaces/values).
*   **Steps:**
    *   Examine the `registerDependencies` function in `backend/server.ts`.
    *   Identify all instances where string tokens are used for registration (e.g., `'LLMService'`, `'KnowledgeGraphService'`, `'DeadLetterQueue'`, `'DeadLetterProcessor'`, `'logger'`).
    *   For each dependency currently registered with a string token:
        *   If it's a concrete class (like `LLMService`), change the registration to use the class constructor as the token (e.g., `container.registerSingleton(LLMService, LLMService);`).
        *   If it represents an interface or a value that doesn't have a class constructor (like the logger instance or configuration values like URLs), define a unique `Symbol` or a dedicated Injection Token to represent it and use that for registration. This provides type safety without relying on string literals.
    *   Ensure consistent use of `container.registerSingleton` for dependencies that should have a single instance throughout the application. Review if any dependencies should be transient and use `container.registerTransient` accordingly.
    *   Remove manual instantiation of dependencies within `registerDependencies` where `tsyringe` can handle the instantiation and dependency resolution automatically (e.g., instead of `const knowledgeGraphService = new KnowledgeGraphService(neo4jService); container.registerInstance('KnowledgeGraphService', knowledgeGraphService);`, you would register `KnowledgeGraphService` and `Neo4jService` and let `tsyringe` inject `Neo4jService` into `KnowledgeGraphService`'s constructor).

## Phase 2: Implement Type-Safe Constructor Injection Across the Backend

*   **Objective:** Modify classes to receive their dependencies exclusively through type-safe constructor injection, eliminating direct `container.resolve` calls within classes.
*   **Steps:**
    *   Identify classes throughout the `backend` directory that have dependencies currently being resolved via `container.resolve` calls outside of the main entry point or are using manual `new` keyword instantiation of classes that should be managed by the container.
    *   For each such class:
        *   Add a constructor that accepts its dependencies as parameters.
        *   Use the `@inject()` decorator from `tsyringe` on the constructor parameters, using the class constructor or the Symbol/Token defined in Phase 1 as the injection identifier. This tells `tsyringe` what to inject.
        *   Ensure the class itself is marked with the `@injectable()` decorator so `tsyringe` can manage its creation.
        *   Remove the manual `container.resolve` calls or `new` keyword usage for these dependencies within the class methods.

## Phase 3: Refine Container Usage and Entry Point

*   **Objective:** Limit direct `container.resolve` calls to the application's entry point (`backend/server.ts`) or composition root, where the initial top-level dependencies are resolved to start the application flow.
*   **Steps:**
    *   Review the codebase to confirm that dependency resolution using `container.resolve` only happens at the top level to get the initial instances (e.g., resolving the main router or controller that handles incoming requests).
    *   All other dependencies should be obtained through the constructor injection implemented in Phase 2.

## Phase 4: Update Tests for Type Safety and Correct Injection

*   **Objective:** Ensure existing tests pass with the new DI setup and update/add tests to verify correct dependency injection and type safety.
*   **Steps:**
    *   Run all existing unit and integration tests in the `backend` directory.
    *   Update tests that were directly instantiating classes that now have dependencies injected via the constructor. Tests should now instantiate these classes by providing mock or test dependencies to their constructors.
    *   Verify that dependencies are being injected correctly and that the application's functionality remains intact. Add new tests specifically to cover critical dependency injection points if necessary.

## Phase 5: Document the Refined DI Approach

*   **Objective:** Document the refined `tsyringe` setup, including how to register and inject dependencies using the adopted type-safe methods (class constructors, Symbols/Tokens) and the principle of constructor injection.
*   **Steps:**
    *   Update any existing documentation related to dependency injection in your project (e.g., in README files or a dedicated `memory-bank/Architecture` document).
    *   Create new documentation if necessary, explaining the chosen patterns and providing clear code examples.