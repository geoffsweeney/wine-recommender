# Plan for Implementing Recommendation Source Selection UI Feature

**Goal:** Implement a user interface feature that allows users to select whether wine recommendations should be generated using the knowledge graph or directly by the LLM, and modify the backend to respect this preference.

## Frontend Changes ([`src/index.html`](src/index.html))

1.  **Add UI Element:** Introduce a UI element (e.g., a dropdown menu, radio buttons, or toggle switch) to the HTML body to allow the user to select the recommendation source. Options should include "Knowledge Graph" and "LLM".
2.  **Capture User Preference:** Add JavaScript code to capture the user's selected preference when the "Get Recommendation" button is clicked.
3.  **Include Preference in API Request:** Modify the existing JavaScript code that sends the recommendation request to the backend (`fetch('http://localhost:3000/api/recommendations', ...)`) to include the user's selected recommendation source preference in the request body. This could be a new field in the `input` object, e.g., `recommendationSource: 'knowledgeGraph' | 'llm'`.

## Backend Changes

1.  **Update DTO:** Modify the `RecommendationRequest` DTO ([`src/api/dtos/RecommendationRequest.dto.ts`](src/api/dtos/RecommendationRequest.dto.ts)) to include the new `recommendationSource` field in the `input` object. Define the possible values for this field (e.g., a Zod enum).
2.  **Modify Controller/Router:** Update the backend route handler (likely in [`src/api/routes.ts`](src/api/routes.ts) or the `WineRecommendationController`) to receive and validate the `recommendationSource` field from the incoming request.
3.  **Modify SommelierCoordinator:** Adjust the `SommelierCoordinator` ([`src/core/agents/SommelierCoordinator.ts`](src/core/agents/SommelierCoordinator.ts)) to:
    *   Receive the `recommendationSource` preference as part of the message.
    *   Based on the `recommendationSource` value, route the recommendation request to either the `RecommendationAgent` (for knowledge graph) or a different agent responsible for LLM-based recommendations.
4.  **Implement LLM-Based Recommendation Logic:**
    *   **Option A (Modify RecommendationAgent):** Add logic within the existing `RecommendationAgent` to handle LLM-only recommendations when the preference is set to "LLM". This might involve a different LLM prompt that asks the LLM to generate a recommendation directly, without querying the knowledge graph.
    *   **Option B (Create New Agent):** Create a new agent (e.g., `LLMRecommendationAgent`) specifically for handling LLM-based recommendations. This agent would receive the user input and conversation history and use the LLM to generate a recommendation directly. The `SommelierCoordinator` would route requests to this new agent when the preference is "LLM". (Option B is generally preferred for better separation of concerns).

## Implementation Steps

1.  Implement Frontend UI changes (add element, capture preference, update fetch request).
2.  Update `RecommendationRequest` DTO.
3.  Modify backend controller/router to handle the new field.
4.  Choose and implement either Option A or Option B for LLM-based recommendation logic.
5.  Update `SommelierCoordinator` to route requests based on the `recommendationSource`.
6.  Add necessary tests for the new functionality.

## Implementation Status

- **Step 1 (Implement Frontend UI changes):** Completed - UI element and JavaScript logic added to `index.html`.
- **Step 2 (Update RecommendationRequest DTO):** Completed - `recommendationSource` field added to the DTO.
- **Step 3 (Modify Controller/Router):** Completed - Controller updated to handle the new field.
- **Step 4 (Implement LLM-Based Recommendation Logic):** Completed - Core LLM logic implemented in `LLMRecommendationAgent`.
- **Step 5 (Update SommelierCoordinator to route requests):** Completed - Routing logic based on `recommendationSource` implemented.
- **Step 6 (Add necessary tests):** Completed - Necessary unit and e2e tests are in place and passing.

- **Previous Step:** Investigated and fixed failing unit test in `src/core/agents/__tests__/SommelierCoordinator.unit.test.ts`.

## Success Criteria

- The UI allows users to select the recommendation source.
- The backend successfully receives and processes the selected source.
- Recommendations are generated using the chosen source (knowledge graph or LLM).
- The system handles cases where a source is selected but cannot provide a recommendation (e.g., knowledge graph has no data, LLM fails).

## Estimated Timeline

(To be determined based on implementation complexity)

## Team/Resource Allocation

(To be determined)

## Dependencies

- Working frontend and backend setup.
- LLM service configured and accessible.
- Neo4j database configured and accessible (for knowledge graph option).