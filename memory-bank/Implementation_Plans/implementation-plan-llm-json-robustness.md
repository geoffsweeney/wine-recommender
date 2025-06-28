# Implementation Plan: Improving LLM JSON Output Quality and Parsing Robustness

## Problem Statement
The application is encountering issues with JSON formatting and parsing of responses from the Language Model (LLM). Investigation reveals that while the LLM is prompted to output JSON and the system expects structured JSON output (as per `RecommendationResult` interface), the `LLMRecommendationAgent` currently passes the raw JSON string from the LLM directly to downstream components without proper parsing and validation. This leads to downstream parsing failures.

## Goal
Ensure robust JSON parsing of LLM responses and proper handling of structured data within the application.

## Proposed Solution

### Phase 1: Implement JSON Parsing in `LLMRecommendationAgent`
*   **Objective:** Parse the raw LLM response string into a `RecommendationResult` object immediately after receiving it from `LLMService`.
*   **Steps:**
    1.  Modify [`backend/core/agents/LLMRecommendationAgent.ts`](backend/core/agents/LLMRecommendationAgent.ts) to add a parsing step after `llmService.sendPrompt`.
    2.  Use `JSON.parse()` to convert the `llmResponse` string into an object.
    3.  Add robust error handling for `JSON.parse()` failures (e.g., try-catch block). If parsing fails, log the error and potentially send a specific error message or trigger a fallback.
    4.  Validate the parsed object against the `RecommendationResult` interface (e.g., check for required fields).
    5.  If parsing and validation are successful, send the structured `RecommendationResult` object in the `AgentMessage` payload instead of the raw string.

### Phase 2: Refine LLM Prompt for Strict JSON Output (if necessary)
*   **Objective:** If parsing issues persist due to malformed JSON from the LLM, refine the prompt to encourage stricter JSON adherence.
*   **Steps:**
    1.  Add explicit instructions to the LLM prompt for valid JSON, potentially including a JSON schema or a more detailed example.
    2.  Consider using a "JSON mode" if the LLM provider supports it (Ollama might have specific parameters for this).

### Phase 3: Downstream Consumption (Verification)
*   **Objective:** Verify that downstream agents or services correctly receive and utilize the structured `RecommendationResult` object.
*   **Steps:**
    1.  Identify where the `llm-recommendation-response` message is consumed. (This will likely be in `SommelierCoordinator.ts` or another agent that orchestrates the flow).
    2.  Ensure that these consumers are expecting and correctly handling the `RecommendationResult` object, not a raw string.

## Visual Representation of Proposed Change

```mermaid
graph TD
    A[User Request] --> B(SommelierCoordinator)
    B --> C(LLMRecommendationAgent)
    C --> D(LLMService)
    D --> E[LLM (Ollama)]
    E --> F{Raw JSON String}
    F --> G(LLMRecommendationAgent)
    G -- Current --> H[AgentMessage with Raw JSON String]
    G -- Proposed --> I{Parse & Validate JSON}
    I -- Success --> J[AgentMessage with RecommendationResult Object]
    I -- Failure --> K[DeadLetterProcessor / Error Handling]
    J --> L(Downstream Agents/Services)
    
    ## Lessons Learned and Refinements
    
    This implementation journey highlighted several key challenges and led to important refinements in our approach:
    
    ### 1. Robust LLM Structured Output is Crucial
    *   **Challenge:** Initial attempts to parse LLM-generated JSON using regex and manual string manipulation proved unreliable due to the LLM's tendency to include conversational text, comments (`//`), and Python-style `None`/`True`/`False` within the JSON output.
    *   **Solution:** The adoption of Ollama's built-in structured output feature (via the `format` parameter in `ollama.chat`) combined with explicit JSON schemas significantly improved reliability. This offloads the parsing burden to the LLM itself, ensuring cleaner, schema-compliant JSON.
    *   **Refinement:** The `extractAndParseJson` utility was developed as a fallback/pre-processing step, but the primary solution lies in leveraging the LLM's native structured output capabilities. This emphasizes that prompt engineering alone is often insufficient for strict JSON adherence.
    
    ### 2. Precise Agent Communication is Paramount
    *   **Challenge:** Persistent communication timeouts and unrouted messages between agents were traced back to incorrect usage of `correlationId` and missing `userId` in `AgentMessage` objects.
    *   **Solution:**
        *   Ensured that the `correlationId` of a response message is always the `correlationId` of the original request message. This is vital for the `EnhancedAgentCommunicationBus` to correctly match requests with responses.
        *   Added `userId` as a property to the `AgentMessage` interface and ensured it is consistently passed when creating messages, especially for preference updates. This is crucial for maintaining user context across agent interactions and for persistence.
    *   **Learning:** Meticulous attention to message structure and metadata (`correlationId`, `userId`, `conversationId`) is non-negotiable in a multi-agent system to ensure reliable and traceable communication flow.
    
    ### 3. Testing Complex Mocking Scenarios
    *   **Challenge:** Mocking the `LLMService`'s interaction with the `OllamaStructuredClient` using `ts-mockito` presented challenges, particularly with mocking nested properties and handling `ts-mockito`'s strict type inference.
    *   **Solution:** Switched to `jest.mock` for the `OllamaStructuredClient` module, allowing for more direct control over the mocked instance and its methods. This proved more robust for mocking external dependencies with complex internal structures.
    *   **Learning:** For complex mocking scenarios, especially with third-party libraries, `jest.mock` can offer more flexibility and control than `ts-mockito`'s `when`/`verify` syntax for deeply nested or private properties. Understanding the nuances of mocking frameworks is essential for effective unit testing in a multi-layered architecture.
    ```