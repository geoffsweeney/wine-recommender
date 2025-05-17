# Plan for Implementing Conversation History (MVP - In-Memory Storage)

**Goal:** Enable the Wine Recommendation App to maintain context across multiple user interactions within a single conversation using in-memory storage.

**Phase 1: Backend Modifications (Data Model and Processing)**
  Status: Completed

1.  **Update `RecommendationRequest` DTO:**
    *   Add an optional field `conversationHistory` to [`RecommendationRequest.dto.ts`](src/api/dtos/RecommendationRequest.dto.ts). This field will be an array of objects, each representing a turn in the conversation (e.g., `{ role: 'user' | 'assistant', content: string }`).
2.  **Implement In-Memory Conversation History Storage:**
    *   Create a new class or module (e.g., `ConversationHistoryService`) to manage the in-memory storage of conversation history. This service will likely use a `Map` where the key is the `userId` and the value is an array of conversation turns.
    *   Implement methods in this service to:
        *   Add a new turn to a user's history.
        *   Retrieve a user's history.
        *   Clear a user's history (e.g., for starting a new conversation).
3.  **Modify `SommelierCoordinator`:**
    *   Update the `handleMessage` method in [`SommelierCoordinator.ts`](src/core/agents/SommelierCoordinator.ts) to receive the `conversationHistory` from the `RecommendationRequest`.
    *   Inject the new `ConversationHistoryService` into the `SommelierCoordinator`.
    *   Before processing a new request, retrieve the user's existing history from the `ConversationHistoryService` using the `userId`.
    *   Combine the retrieved history with the new user message to provide the complete conversation context to relevant agents.
    *   After receiving the recommendation response from the agents, add both the user's message and the assistant's response to the conversation history using the `ConversationHistoryService`.
    *   Pass the relevant parts of the conversation history to agents that need it (e.g., `UserPreferenceAgent`, `RecommendationAgent`).
4.  **Agent Modifications:**
    *   Update agents that will utilize conversation history (e.g., `UserPreferenceAgent`, `RecommendationAgent`) to accept and process the conversation history data. This might involve modifying their `handleMessage` signatures and internal logic to consider past interactions.

**Phase 2: API Modifications**
  Status: Completed

1.  **Update OpenAPI Specification:**
    *   Modify [`openapi.yaml`](src/api/openapi.yaml) to include the `conversationHistory` field in the `RecommendationRequest` schema, specifying its structure (array of objects with `role` and `content`).
2.  **Update API Endpoint:**
    *   Ensure the `/recommendations` endpoint in [`routes.ts`](src/api/routes.ts) correctly receives the `conversationHistory` from the request body and passes it to the `SommelierCoordinator`.

**Phase 3: Frontend Modifications**

1.  **Implement Conversation State Management:**
    *   Use browser `sessionStorage` to store the conversation history for simplicity in this MVP.
    *   Create JavaScript functions:
        *   `saveConversationTurn(userId, role, content)`: Adds a new message (user input or assistant response) to the history in `sessionStorage` for a given user ID.
        *   `getConversationHistory(userId)`: Retrieves the current conversation history array from `sessionStorage` for a given user ID.
        *   `clearConversationHistory(userId)`: Removes the conversation history from `sessionStorage` for a given user ID (e.g., for starting a new conversation).
    *   The history will be stored as a JSON string representing an array of `{ role: string, content: string }` objects.
2.  **Modify API Calls:**
    *   Locate the JavaScript function that sends the POST request to `/api/recommendations`.
    *   Before sending the request:
        *   Call `getConversationHistory(userId)` to retrieve the current history.
        *   Include the retrieved history array in the request body under the `conversationHistory` field, ensuring it matches the structure defined in the `RecommendationRequest` DTO.
        *   Include the current user input as the latest turn in the history sent with the request.
3.  **Display Conversation History:**
    *   Identify or create a dedicated HTML element (e.g., a `div` with a specific ID) where the conversation history will be displayed.
    *   Create a JavaScript function `displayConversationHistory(history)`:
        *   Takes the conversation history array as input.
        *   Clears the current content of the history display area.
        *   Iterates through the history array.
        *   For each turn, creates appropriate HTML elements (e.g., paragraphs or list items, potentially with different styling for user and assistant messages).
        *   Appends these elements to the history display area.
    *   After a new response is received from the API, update the history in `sessionStorage` using `saveConversationTurn` for both the user's input and the assistant's response, and then call `displayConversationHistory` to refresh the displayed history.

**Phase 4: Testing**

1.  **Unit Tests:**
    *   Unit tests for `SommelierCoordinator` have been reviewed and a failing test related to conversation history handling was fixed.
    *   Add unit tests for the modified DTO, the new `ConversationHistoryService`, and other relevant agents to ensure they correctly handle conversation history.
2.  **Integration Tests:**
    *   Create integration tests for the `/recommendations` endpoint to verify that conversation history is correctly passed, stored (in-memory), and utilized through the system.
3.  **Frontend Tests:**
    *   Implement frontend tests to ensure conversation history is correctly managed, sent with API calls, and displayed in the UI.

**Mermaid Diagram (Updated for In-Memory Storage):**

```mermaid
graph TD
    A[Frontend] --> B{API /recommendations};
    B --> C[SommelierCoordinator];
    C --> D[InputValidationAgent];
    C --> E[UserPreferenceAgent];
    C --> F[RecommendationAgent];
    C --> G[ExplanationAgent];
    C --> H[MCPAdapterAgent];
    C --> I[FallbackAgent];
    E --> J[SharedContextMemory];
    F --> J;
    G --> J;
    H --> J;
    I --> J;
    J --> C;
    C --> K[DeadLetterProcessor];
    C --> L[AgentCommunicationBus];
    K --> M[DLQ Storage];
    L --> D;
    L --> E;
    L --> F;
    L --> G;
    L --> H;
    L --> I;
    F --> N[RecommendationService];
    N --> O[Neo4jService];
    O --> P[Neo4j Database];
    B --> Q[RecommendationResponse];
    Q --> A;

    %% New elements for conversation history (In-Memory)
    A --> B; %% Frontend sends history to API
    B --> C; %% API passes history to Coordinator
    C --> R[ConversationHistoryService (In-Memory)]; %% Coordinator interacts with In-Memory Storage
    R --> C; %% Coordinator retrieves history from storage
    C --> E; %% Coordinator passes history to UserPreferenceAgent
    C --> F; %% Coordinator passes history to RecommendationAgent