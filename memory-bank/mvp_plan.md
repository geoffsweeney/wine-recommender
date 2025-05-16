# Wine Recommendation App - Minimum Viable Product (MVP) Plan

This plan outlines the essential features and steps required to implement a Minimum Viable Product (MVP) for the Wine Recommendation App, focusing on a functional end-to-end recommendation flow based on user preferences or ingredients.

## MVP Features and Implementation Steps

Here are the features required for the MVP, ordered for optimal implementation flow:

### 1. Solidify Core Agentic Flow

**Goal:** Ensure the basic flow through the core agents is robust for handling user input and returning a basic recommendation.

**Status:** Completed

**Detailed Steps:**

- Review and address critical TODOs within `InputValidationAgent` ([`src/core/agents/InputValidationAgent.ts`](src/core/agents/InputValidationAgent.ts)), `SommelierCoordinator` ([`src/core/agents/SommelierCoordinator.ts`](src/core/agents/SommelierCoordinator.ts)), and `RecommendationAgent` ([`src/core/agents/RecommendationAgent.ts`](src/core/agents/RecommendationAgent.ts)) related to basic functionality and error handling.
- Verify that the `AgentCommunicationBus` ([`src/core/AgentCommunicationBus.ts`](src/core/AgentCommunicationBus.ts)) and `SharedContextMemory` ([`src/core/SharedContextMemory.ts`](src/core/SharedContextMemory.ts)) are correctly integrated and used within the core agent flow.
- Implement basic error propagation and handling within the `SommelierCoordinator` to gracefully manage issues in downstream agents.

### 2. Refine LLM Integration for Core Agents

**Goal:** Improve the reliability of LLM interactions for the core recommendation task.

**Status:** Completed

**Detailed Steps:**

- Refine the prompts used in `InputValidationAgent` ([`src/core/agents/InputValidationAgent.ts`](src/core/agents/InputValidationAgent.ts)) to improve ingredient parsing and overall input understanding by the LLM.
- Refine the prompts used in `RecommendationAgent` ([`src/core/agents/RecommendationAgent.ts`](src/core/agents/RecommendationAgent.ts)) for generating basic recommendations based on knowledge graph results.
- Enhance the parsing and validation of LLM responses within `InputValidationAgent` and `RecommendationAgent` to be more robust to variations in LLM output format.
- Implement basic error handling for LLM calls within these agents, potentially using the `DeadLetterProcessor` ([`src/core/BasicDeadLetterProcessor.ts`](src/core/BasicDeadLetterProcessor.ts)).

### 3. Enhance Knowledge Graph Interaction

**Goal:** Ensure reliable data retrieval from the knowledge graph for recommendations.

**Status:** Completed

**Detailed Steps:**

- Verify the functionality of `findWinesByIngredients` and `findWinesByPreferences` methods in `KnowledgeGraphService` ([`src/services/KnowledgeGraphService.ts`](src/services/KnowledgeGraphService.ts)).
- Ensure the basic data loading script ([`scripts/loadWineData.ts`](scripts/loadWineData.ts)) is functional and populates the Neo4j database with sufficient data for basic recommendations.

### 4. Complete Basic API Functionality

**Goal:** Ensure the API endpoint correctly handles requests and integrates with the agent system.

**Status:** Partially Completed

**Detailed Steps:**

- Verify that the `/api/recommendations` endpoint ([`src/api/routes.ts`](src/api/routes.ts)) correctly receives user input and passes it to the `SommelierCoordinator`.
- Ensure the response from the `SommelierCoordinator` is correctly formatted and returned by the API endpoint.
- Address the deferred failing tests in `src/api/middleware/__tests__/validation.test.ts` ([`src/api/middleware/__tests__/validation.test.ts`](src/api/middleware/__tests__/validation.test.ts)).
- Implement basic rate limiting for the `/api` endpoints as outlined in the `Rate Limiter Refinement Plan` ([`memory-bank/rate_limiter_refinement_plan.md`](memory-bank/rate_limiter_refinement_plan.md)), focusing on applying it to the `/api` path and basic error handling for exceeding the limit.

### 5. Implement Basic User Interface

**Goal:** Provide a simple interface for users to interact with the recommendation system.

**Status:** Remaining

**Detailed Steps:**

- Create a new frontend page (e.g., in the `src/app` directory if using Next.js App Router, or `src/pages` if using Pages Router) with a text input field and a button.
- Implement logic to capture user input from the text field.
- On button click, send a POST request with the user input (formatted as a recommendation request body) to the `/api/recommendations` endpoint.
- Display the recommendation received in the API response on the page.

### 6. Finalize Basic End-to-End Testing

**Goal:** Ensure the core end-to-end recommendation flow is verified with automated tests.

**Status:** Partially Completed

**Detailed Steps:**

- Write a specific end-to-end test case in [`src/api/__tests__/e2e.test.ts`](src/api/__tests__/e2e.test.ts) that provides ingredient-based input and asserts on the expected recommendation output.
- Ensure all existing and newly added basic end-to-end tests for the `/api/recommendations` endpoint (covering both preference and ingredient-based inputs) are passing.

## Progress Tracker

- [x] 1. Solidify Core Agentic Flow
  - Increased test coverage for `SommelierCoordinator.ts`, covering various input handling and error scenarios.
- [x] 2. Refine LLM Integration for Core Agents
  - Increased test coverage for `InputValidationAgent.ts`, including handling of invalid inputs and robust LLM response parsing.
  - Fixed test errors in `InputValidationAgent.test.ts` and `recommendations.integration.test.ts` related to `DeadLetterProcessor` integration and `tsyringe` dependency injection.
  - Applied prompt refinements to `InputValidationAgent.ts` and `RecommendationAgent.ts`.
- [ ] 3. Enhance Knowledge Graph Interaction
- [ ] 4. Complete Basic API Functionality
  - Fixed integration test errors in `recommendations.integration.test.ts`.
- [ ] 5. Implement Basic User Interface
- [ ] 6. Finalize Basic End-to-End Testing
  - Fixed integration test errors in `recommendations.integration.test.ts`.