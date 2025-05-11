# LLM Integration Plan

This plan outlines the steps for integrating Language Model (LLM) capabilities into the agentic AI architecture to enhance various agent functions.

## Proposed Architecture

```mermaid
graph TD
    A[User Request] --> B(API Routes);
    B --> C(Controllers);
    C --> D(SommelierCoordinator);
    D --> E(AgentCommunicationBus);
    E --> F{Agents};
    F --> G[RecommendationAgent];
    F --> H[ExplanationAgent];
    F --> I[InputValidationAgent];
    F --> J[UserPreferenceAgent];
    F --> K[ValueAnalysisAgent];
    F --> L[FallbackAgent];
    F --> M[MCPAdapterAgent];
    G,H,I,J,K,L,M --> N(LLM Service/Proxy);
    N --> O[External LLM Provider];
    N --> P(Rate Limiter/Cost Management);
    O --> N;
    N --> G,H,I,J,K,L,M;
    G,H,I,J,K,L,M --> E;
    E --> D;
    D --> C;
    C --> B;
    B --> Q[User Response];
```

## Detailed Steps

1.  **Design and Implement LLM Access Layer:**
    *   Create a new service (e.g., `LLMService.ts`) or utility module responsible for interacting with the chosen LLM provider (API calls, handling authentication, etc.).
    *   This layer should abstract the specifics of the LLM provider, allowing for potential future changes or additions of different LLMs.
    *   Implement basic error handling and potentially retry mechanisms for LLM calls.

2.  **Integrate LLM Access into Agent Communication:**
    *   Determine how agents will request LLM interactions. A centralized approach, possibly through a dedicated `LLMService` or an `LLMAgent` acting as a proxy, is recommended for managing LLM resources and decoupling agents from the LLM provider specifics.

3.  **Modify Agents to Utilize LLM:**
    *   Identify the specific points within each relevant agent's logic where LLM interaction is needed (e.g., `RecommendationAgent` for refining recommendations, `ExplanationAgent` for generating explanations, `InputValidationAgent` for understanding user queries, `SommelierCoordinator` for complex reasoning).
    *   Implement the logic within these agents to formulate prompts for the LLM based on the agent's context and the task at hand.
    *   Handle the LLM's response, parsing it and integrating the information back into the agent's workflow.

4.  **Address Cross-Cutting Concerns:**
    *   Implement rate limiting for LLM calls to avoid exceeding provider limits and managing costs.
    *   Consider cost tracking for LLM usage.
    *   Implement robust parsing and validation of LLM responses.

5.  **Testing:**
    *   Write unit tests for the LLM access layer.
    *   Write integration tests to verify agent-LLM interaction.
    *   Update end-to-end tests.

## Progress

*   **Step 1: Design and Implement LLM Access Layer:** Largely complete. `LLMService.ts` created and configured for Ollama with a configurable model.
*   **Step 2: Integrate LLM Access into Agent Communication:** Largely complete. `AgentCommunicationBus` modified and injected into `SommelierCoordinator`.
*   **Step 3: Modify Agents to Utilize LLM:** In progress. Integrated into `ExplanationAgent`, `RecommendationAgent`, `InputValidationAgent`, `UserPreferenceAgent`, `FallbackAgent`, and `ValueAnalysisAgent`.
*   **Step 4: Address Cross-Cutting Concerns:** Complete. Implemented basic rate limiting, cost tracking logging, and improved JSON parsing robustness.
*   **Step 5: Testing:** Pending.