# Wine Recommender Application

This application is a sophisticated, AI-powered wine recommendation system designed to act as an intelligent virtual sommelier. It takes natural language input from users, processes it through a series of specialized AI agents, and provides personalized wine recommendations.

## What it Does

The primary goal of this application is to guide users to suitable wine choices based on their specific needs, preferences, and even food pairings. It aims to provide a highly contextual and personalized recommendation experience.

## How it Works: The Agent-Based Architecture and Application Flow

The system is built on a modular, agent-based architecture, where different AI agents collaborate to fulfill a user's request. The core of this collaboration is orchestrated by the `SommelierCoordinator` agent, with all inter-agent communication managed by the `EnhancedAgentCommunicationBus`.

### End-to-End Application Flow:

1.  **User Request Initiation:** A user sends a request (e.g., via a `curl` POST to `/api/recommendations`) with their input (e.g., "I am having a juicy steak tonight. What wine should I drink?").
2.  **API Gateway & Controller:** The request is received by the Express.js API, which routes it to the `WineRecommendationController`. This controller acts as the entry point to the agent system.
3.  **Orchestration by `SommelierCoordinator`:** The `WineRecommendationController` sends an `ORCHESTRATE_RECOMMENDATION_REQUEST` message to the `SommelierCoordinator` via the `EnhancedAgentCommunicationBus`. This message includes the user's input, a unique `conversationId` (to track the entire interaction), and a `correlationId` (to link this specific request to its response).
4.  **Information Gathering (Phase 1):** The `SommelierCoordinator` initiates parallel requests to:
    *   **`InputValidationAgent`:** To clean and validate the user's input.
    *   **`UserPreferenceAgent`:** To extract user preferences from the natural language input. This might involve an asynchronous call to the `LLMPreferenceExtractorAgent` if fast extraction is not sufficient.
    All these inter-agent communications happen via `sendMessageAndWaitForResponse` calls on the `EnhancedAgentCommunicationBus`, ensuring that the `SommelierCoordinator` waits for a response from each agent, maintaining context using the `correlationId`.
5.  **Decision Making (Phase 2):** Based on the gathered information (validated input, extracted preferences), the `SommelierCoordinator` makes decisions. This includes checking for invalid ingredients (and potentially consulting a `FallbackAgent`) or assessing budget realism.
6.  **Recommendation Generation (Phase 3):** The `SommelierCoordinator` sends a `GENERATE_RECOMMENDATIONS` message to the `RecommendationAgent`. The `RecommendationAgent` then leverages the `LLMRecommendationAgent` (or a knowledge graph) to generate wine recommendations. The `SommelierCoordinator` might attempt multiple recommendation strategies or refinement steps if the initial recommendations are of low quality.
7.  **Shopping & Availability (Phase 4):** Once recommendations are generated, the `SommelierCoordinator` sends `FIND_WINES` messages to the `ShopperAgent` for each recommended wine to check its availability. If no wines are found, it might send an `EXPANDED_SEARCH` message to the `ShopperAgent`.
8.  **Final Assembly & Presentation (Phase 5):** The `SommelierCoordinator` assembles the final recommendation, including the primary wine, alternatives, and an explanation. It sends a `GENERATE_EXPLANATION` message to the `ExplanationAgent` to get a natural language explanation for the recommendation.
9.  **History Update (Fire and Forget):** The `SommelierCoordinator` publishes an `UPDATE_RECOMMENDATION_HISTORY` message to the `UserPreferenceAgent` using `publishToAgent`. This is a "fire and forget" message, meaning the `SommelierCoordinator` does not wait for a response, as it's primarily for logging or background processing.
10. **Response to Client:** Finally, the `SommelierCoordinator` sends the `FINAL_RECOMMENDATION` back to the `WineRecommendationController` via the `EnhancedAgentCommunicationBus`, which then sends the recommendation as an HTTP response back to the user.

### Key Components and Communication Patterns:

*   **`SommelierCoordinator` (Orchestration Agent):** The central brain, orchestrating the entire workflow. It uses `sendMessageAndWaitForResponse` for critical steps where a response is expected, and `publishToAgent` for "fire and forget" messages.
*   **`EnhancedAgentCommunicationBus`:** The central nervous system for all inter-agent communication. It handles message routing, manages `correlationId`s for request-response matching, and ensures callbacks are correctly managed. It automatically sends responses when handlers return a `Result` with data.
*   **Specialized Agents:** (`InputValidationAgent`, `UserPreferenceAgent`, `LLMPreferenceExtractorAgent`, `RecommendationAgent`, `LLMRecommendationAgent`, `ShopperAgent`, `ExplanationAgent`, `FallbackAgent`) Each agent has a specific role and communicates with the `SommelierCoordinator` and other agents via the `EnhancedAgentCommunicationBus`.
*   **`correlationId`:** A unique identifier crucial for linking requests to their corresponding responses across asynchronous agent interactions. It ensures that the correct callback is triggered when a response is received.
*   **`conversationId`:** Maintains the overall context of a user's interaction across multiple turns and agent calls.

### Robustness Mechanisms:

The system is designed with robustness in mind, incorporating several mechanisms to ensure reliability:

*   **Circuit Breakers:** Protect against cascading failures by temporarily preventing calls to agents that are experiencing issues.
*   **Dead-Letter Queues:** Capture and store messages that could not be processed successfully, allowing for later analysis and reprocessing.
*   **Retry Logic:** Agents can attempt to retry operations that fail, improving resilience against transient errors.
*   **Dependency Injection:** The application uses `tsyringe` for dependency injection, promoting a modular and testable codebase.

## Key Features and Functionality

*   **Intelligent Natural Language Processing:** Understands complex and nuanced user requests for wine recommendations.
*   **Contextual and Personalized Recommendations:** Leverages user preferences, conversation history, and specific ingredients to provide highly relevant wine suggestions.
*   **LLM-Powered Core:** Integrates Large Language Models for advanced reasoning, preference extraction, and recommendation generation.
*   **Modular and Scalable Architecture:** The agent-based design allows for easy extension and maintenance of individual components.
*   **Robust Error Handling:** Built-in mechanisms for fault tolerance and resilience ensure a stable user experience.
*   **Transparent Explanations:** Provides clear reasons behind recommendations, fostering user trust and understanding.
*   **Availability Awareness:** Attempts to recommend wines that are actually available, enhancing the practical utility of the recommendations.

This application serves as a comprehensive solution for anyone looking for personalized wine advice, powered by a sophisticated AI backend.