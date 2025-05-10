# Wine Recommendation App - Minimum Plan for Wine-to-Ingredients Matching End-to-End Flow (Including All Agents)

This plan outlines the minimum steps required to implement the end-to-end flow for matching a wine to ingredients, ensuring all defined agents are included in the basic interaction flow for the Proof of Concept.

## Plan Steps

1.  **Implement/Refine Basic Agents:**
    *   Ensure basic implementations exist for all agents:
        *   `InputValidationAgent` (Refine to parse ingredients).
        *   `SommelierCoordinator` (Refine to route ingredient requests).
        *   `RecommendationAgent` (Implement core logic for ingredient matching).
        *   `ValueAnalysisAgent` (Basic placeholder or minimal interaction).
        *   `UserPreferenceAgent` (Basic placeholder or minimal interaction).
        *   `ExplanationAgent` (Basic placeholder or minimal interaction).
        *   `FallbackAgent` (Basic placeholder or simple fallback response).
        *   `MCPAdapterAgent` (Basic placeholder or minimal interaction).

2.  **Enhance Knowledge Graph Service:**
    *   Add a new method to `KnowledgeGraphService` that accepts a list of ingredients and executes a Neo4j query to find wines that pair well with those ingredients.

3.  **Simplified Agent Integration & Communication:**
    *   Establish a basic communication flow where the `SommelierCoordinator` orchestrates the interaction between agents for an ingredient-based request. This might involve:
        *   Input from API goes to `InputValidationAgent`.
        *   Validated input goes to `SommelierCoordinator`.
        *   `SommelierCoordinator` routes to `RecommendationAgent`.
        *   Include basic interaction points or calls to the placeholder agents (`ValueAnalysisAgent`, `UserPreferenceAgent`, `ExplanationAgent`, `MCPAdapterAgent`) within the flow, even if they don't perform complex logic yet. The `FallbackAgent` should be available in case of errors.

4.  **Recommendation Agent Core Logic:**
    *   Implement the core logic in the `RecommendationAgent` to take ingredient input and call the new method in `KnowledgeGraphService`.

5.  **Basic Response Generation:**
    *   The `RecommendationAgent` should format the result from the knowledge graph into a basic recommendation response.

6.  **API Endpoint Connection:**
    *   Ensure the `/api/chat` endpoint correctly receives the user's ingredient input and passes it to the `SommelierCoordinator`.
    *   Ensure the response from the `RecommendationAgent` is returned through the API endpoint.

7.  **Basic End-to-End Testing:**
    *   Write and execute tests to verify that providing ingredients via the API endpoint results in a wine recommendation from the knowledge graph, and that the basic agent flow is followed.

## Plan Visualization

```mermaid
graph TD
    A[User Input (Ingredients)] --> B[InputValidationAgent];
    B --> C[SommelierCoordinator];
    C --> D[RecommendationAgent];
    C --> E[ValueAnalysisAgent (Basic)];
    C --> F[UserPreferenceAgent (Basic)];
    C --> G[ExplanationAgent (Basic)];
    C --> H[MCPAdapterAgent (Basic)];
    D --> I[KnowledgeGraphService];
    I --> J[Neo4j Database];
    J --> I;
    I --> D;
    D --> K[Basic Recommendation Response];
    K --> L[API Endpoint (/api/chat)];
    L --> M[User];
    ErrorPath(Error) --> N[FallbackAgent (Basic)];