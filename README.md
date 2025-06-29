# Wine Recommender Application

This application is a sophisticated, AI-powered wine recommendation system designed to act as an intelligent virtual sommelier. It takes natural language input from users, processes it through a series of specialized AI agents, and provides personalized wine recommendations.

## What it Does

The primary goal of this application is to guide users to suitable wine choices based on their specific needs, preferences, and even food pairings. It aims to provide a highly contextual and personalized recommendation experience.

## How it Works: The Agent-Based Architecture

The system is built on a modular, agent-based architecture, where different AI agents collaborate to fulfill a user's request. The core of this collaboration is orchestrated by the `SommelierCoordinator` agent.

### Key Components:

*   **`SommelierCoordinator` (Orchestration Agent):** This is the central brain of the system. When a user requests a wine recommendation, the `SommelierCoordinator` takes charge. It orchestrates the entire recommendation workflow, managing the flow of information and tasks between various specialized agents. Its responsibilities include:
    *   **Information Gathering:** Initiates parallel processes to validate user input and extract detailed preferences.
    *   **Decision Making:** Based on the gathered information, it makes intelligent decisions, such as handling ambiguous or invalid input, and adjusting expectations (e.g., budget) if necessary.
    *   **Recommendation Generation & Refinement:** Delegates the task of generating wine recommendations to specialized agents and manages a feedback loop to refine these recommendations until a satisfactory quality is achieved.
    *   **Availability Checking:** Coordinates with agents to find available wines that match the recommendations, even expanding the search if initial results are limited.
    *   **Final Assembly & Presentation:** Compiles the final recommendation, including a primary suggestion, alternatives, and a clear explanation, along with a confidence score.

*   **`LLM Preference Extractor Agent`:** This agent is responsible for understanding the user's intent and preferences from their natural language input. It leverages Large Language Models (LLMs) to:
    *   Parse user queries like "I prefer bold red wines under $30" or "Looking for a wine to pair with chicken and mushrooms."
    *   Extract structured preferences (e.g., wine style, color, price range) and relevant ingredients.
    *   It can also utilize a `KnowledgeGraphService` and `PreferenceNormalizationService` for more accurate and consistent preference understanding.

*   **`LLM Recommendation Agent`:** This agent is the core recommendation engine. It uses LLMs to generate wine recommendations based on the extracted user preferences, ingredients, and the ongoing conversation history. It constructs detailed prompts for the LLM to ensure relevant and contextual wine suggestions.

*   **`Shopper Agent`:** Once recommendations are generated, this agent is tasked with finding actual available wines that match the suggestions. It can perform searches and potentially expand its criteria if no suitable wines are found initially.

*   **`Explanation Agent`:** To enhance user understanding and trust, this agent generates natural language explanations for why a particular wine was recommended, linking it back to the user's preferences and input.

*   **`Input Validation Agent`:** Ensures the user's initial input is well-formed and understandable before further processing.

*   **`Fallback Agent`:** Provides alternative suggestions or handles situations where other agents encounter difficulties or cannot fulfill a request with high confidence.

### Communication and Robustness:

The agents communicate with each other via an `EnhancedAgentCommunicationBus`, which facilitates message passing and response handling. The system is designed with robustness in mind, incorporating several mechanisms to ensure reliability:

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