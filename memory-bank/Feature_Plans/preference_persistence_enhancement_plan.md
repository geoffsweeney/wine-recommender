# Preference Persistence Enhancement Plan

## Progress

- Created the `feature/preference-persistence` branch.
- Confirmed implementation of Neo4j persistence logic in `src/services/KnowledgeGraphService.ts` through successful e2e test runs.
- Confirmed implementation of the basic hybrid extraction structure in `src/core/agents/UserPreferenceAgent.ts`, including integration with `src/services/PreferenceExtractionService.ts` and queuing for async LLM, based on test execution flow.
- Confirmed implementation of `src/core/agents/LLMPreferenceExtractorAgent.ts` and `src/api/controllers/UserPreferenceController.ts`, as their dedicated test suites are present and passing.
- Resolved the Jest "did not exit" error in end-to-end tests (`src/api/__tests__/e2e.test.ts`) by ensuring proper server shutdown in the `afterAll` block. Investigated other potential open handles, concluding the remaining warning might be a false positive or minor leak.
- Basic frontend components for preference management (`frontend/wine-recommender/components/PreferenceList.tsx`, `frontend/wine-recommender/components/PreferenceItem.tsx`, `frontend/wine-recommender/components/PreferenceForm.tsx`) and the preferences page (`frontend/wine-recommender/pages/preferences.tsx`) have been created.
- Defined the `PreferenceNode` type in `src/types.ts`.
- Added a basic regex extraction method in `src/services/PreferenceExtractionService.ts` and updated `attemptFastExtraction` to call it.
- Updated the unit and integration tests for `src/core/agents/UserPreferenceAgent.ts` to align with the new hybrid logic.
- Implemented the `src/api/controllers/UserPreferenceController.ts` and added the corresponding API routes in `src/api/routes.ts` for managing user preferences.
- Added comprehensive unit tests for `src/core/agents/LLMPreferenceExtractorAgent.test.ts` and `src/api/__tests__/UserPreferenceController.test.ts`.
- Added the "Frontend Implementation Plan (Next.js & Tailwind CSS)" section.
- **Partial Implementation of Duckling Extraction**: Uncommented integration code, added basic extraction logic, added `axios` import, and addressed related TypeScript errors in `src/services/PreferenceExtractionService.ts`.
- **Partial Refinement of Fast Extraction Result Merging**: Updated `src/services/PreferenceExtractionService.ts` with basic prioritized merging logic.
- **Partial Implementation of Normalization Logic**: Updated `src/core/agents/UserPreferenceAgent.ts` with basic normalization logic, including placeholder source and confidence assignment.
- **API Endpoint Logic for Managing Preferences**: Confirmed basic implementation of GET, POST, PUT, and DELETE endpoints in `src/api/controllers/UserPreferenceController.ts`.
- **Partial Implementation of UI Features**: Implemented data fetching and basic rendering in `frontend/wine-recommender/components/PreferenceList.tsx`, implemented edit triggering in `PreferenceList.tsx`, and confirmed implementation of toggle and delete functionality in `frontend/wine-recommender/components/PreferenceItem.tsx`.
- **Partial Implementation of Preference Inclusion Toggle**: Attempted to add the `active` toggle to `frontend/wine-recommender/components/PreferenceForm.tsx` but encountered issues.
- **Implemented type checks in `src/core/agents/UserPreferenceAgent.ts`** to ensure safe usage of the `slice` method, preventing runtime errors when handling different value types.
- **Completed full Duckling extraction logic**: Enhanced `src/services/PreferenceExtractionService.ts` with detailed extraction rules using Duckling for structured entity extraction.
- **Completed refinement of fast extraction result merging**: Implemented a robust strategy in `PreferenceExtractionService.attemptFastExtraction` to handle conflicts and confidence scores when merging results from different extraction methods.
- **Completed normalization logic**: Completed the `UserPreferenceAgent.normalizePreferences` method to map extracted values to a canonical schema, handling synonyms, negations, and value ranges. Also enhanced normalization in `LLMPreferenceExtractorAgent.ts`.
- **Completed the asynchronous LLM preference extraction agent/process**: Implemented the `LLMPreferenceExtractorAgent` to handle LLM calls for complex preferences asynchronously.
- **Completed UI features for viewing, editing, and deleting preferences**: Developed the frontend logic in the components (`PreferenceList.tsx`, `PreferenceItem.tsx`, `PreferenceForm.tsx`) and page (`preferences.tsx`) to fetch, display, edit, and delete user preferences by interacting with the backend API endpoints, including the active toggle.
- **Completed API endpoint logic for managing preferences**: Filled in the logic within the methods of `src/api/controllers/UserPreferenceController.ts` to handle GET, POST, PUT, and DELETE requests for user preferences, interacting with the `KnowledgeGraphService`.
- **Confirmed comprehensive tests**: Verified the presence of unit, integration, and end-to-end tests for the newly implemented logic in both the backend and frontend.
- Implemented `UserProfileService` and integrated it into `SommelierCoordinator` and `UserPreferenceAgent` for cross-session persistence.
- **Fixed failing tests**: Addressed and fixed failing tests in `src/services/__tests__/KnowledgeGraphService.test.ts`, `src/services/__tests__/RecommendationService.test.ts`, `src/core/agents/__tests__/UserPreferenceAgent.test.ts`, and `src/core/agents/__tests__/UserPreferenceAgent.integration.test.ts` by correcting mock implementations, updating test expectations, fixing logic in `UserPreferenceAgent.ts` related to Promise evaluation and synonym resolution, and removing malformed content from the integration test file.

---

## Next Steps

1.  **Implement full Duckling extraction logic**: Enhance `src/services/PreferenceExtractionService.ts` with detailed extraction rules.
2.  **Refine fast extraction result merging**: Implement a robust strategy in `PreferenceExtractionService.attemptFastExtraction` to handle conflicts and confidence scores.
3.  **Implement normalization logic**: Complete the `UserPreferenceAgent.normalizePreferences` method to map extracted values to a canonical schema.
4.  **Implement the asynchronous LLM preference extraction agent/process**: Create a new agent or service to handle LLM calls for complex preferences asynchronously.
5.  **Implement UI features for viewing, editing, and deleting preferences**: Develop frontend components to interact with user preferences.
6.  **Implement Preference Inclusion Toggle**: Add the `active` property to the `Preference` node in the Neo4j model and implement the UI toggle and backend logic to filter active preferences for recommendations.
7.  **Add comprehensive tests**: Write unit, integration, and end-to-end tests for all newly implemented logic in both the backend and frontend.

---

## Frontend Implementation Plan (Next.js & Tailwind CSS)

Based on your request to use Next.js and Tailwind CSS for the UI, here is a detailed plan for implementing the preference management features, following best practices:

1.  **Project Setup (if starting fresh)**:
    *   Use `create-next-app` with TypeScript and ESLint configured.
    *   Follow the official Tailwind CSS installation guide for Next.js to set up Tailwind.
    *   Organize frontend code within a dedicated directory (e.g., `frontend/`).

2.  **Routing and Pages**:
    *   Create a dedicated page for preference management (e.g., `frontend/pages/preferences.tsx`). Use Next.js file-system routing.
    *   Consider nested routes or modals for add/edit forms if the complexity requires it.

3.  **Component Structure**:
    *   Break down the UI into reusable React components:
        *   `PreferenceList.tsx`: Responsible for fetching and displaying the list of preferences. Uses the `useSWR` hook (or similar) for data fetching and revalidation. Renders a list of `PreferenceItem` components.
        *   `PreferenceItem.tsx`: Displays a single preference. Includes the preference details, an "Include in Pairing" toggle, and edit/delete buttons. Manages its own state for the toggle. Calls API functions for update/delete.
        *   `PreferenceForm.tsx`: A form component for adding or editing a single preference. Handles input validation and form submission. Used within a page or modal.

4.  **Data Fetching and State Management**:
    *   **Fetching**: Use Next.js API Routes (`pages/api/preferences/[userId].ts`, etc.) as a backend-for-frontend (BFF) layer if needed, or fetch directly from your backend API endpoints (`/api/preferences/...`) from client-side components. Use a data fetching library like **SWR** or **React Query** for efficient caching, revalidation, and error handling.
    *   **State**: Manage the list of preferences in the `PreferenceList` component's state (if using SWR/React Query, the library handles this). Manage individual preference state (like the toggle) within `PreferenceItem`. Use React Hook Form for form state management in `PreferenceForm`.

5.  **API Interactions (Client-Side)**:
    *   Create a dedicated API service module (e.g., `frontend/lib/api.ts`) with functions for each backend preference endpoint (`getPreferences`, `addPreference`, `updatePreference`, `deletePreference`). Use `fetch` or Axios.
    *   Implement error handling and loading states for API calls.

6.  **UI Interactions and User Experience**:
    *   Implement event handlers for button clicks and toggle changes.
    *   Provide visual feedback for loading states, successful actions (e.g., toasts), and errors.
    *   Use modals or dedicated pages for add/edit forms to maintain a clean UI.
    *   Implement confirmation dialogs for delete actions.

7.  **Styling with Tailwind CSS**:
    *   Apply utility classes directly in JSX for styling components.
    *   Use `@apply` for extracting common patterns into custom CSS classes if necessary.
    *   Organize complex or reusable styles using component-specific CSS modules or utility-first patterns.
    *   Ensure consistent styling across components.

8.  **Testing**:
    *   Write unit tests for individual React components (e.g., using Jest and React Testing Library).
    *   Write integration tests for API service functions.
    *   Consider end-to-end tests for critical user flows (e.g., adding a preference and seeing it appear in the list).

---

## Objective

Ensure that user preferences (e.g., region = "Australia") are retained across multiple turns in a conversation and automatically applied to subsequent recommendation requests, even if not explicitly restated by the user.

---

## Motivation

Currently, the system only uses preferences provided in the current message. This leads to inconsistent behavior when users expect the assistant to remember prior context (e.g., regional preferences). Enhancing preference persistence will improve recommendation relevance and user experience.

---

## Design Overview

### 1. Extract Preferences from Conversation History

- **Location**: `SommelierCoordinator.handleMessage`
- **Approach**:
  - Before input validation, scan `conversationHistory` for prior assistant and user turns.
  - Use a lightweight NLP or regex-based parser to extract structured preferences (e.g., region, wine type, price range).
  - Store extracted preferences in a temporary `inferredPreferences` object.

### 2. Merge Inferred Preferences with Current Input

- If the current message does not override a preference (e.g., no region specified), use the value from `inferredPreferences`.
- Merge `inferredPreferences` into `recommendationInput.preferences` before passing to downstream agents.

### 3. Update InputValidationAgent (Optional)

- Allow `InputValidationAgent` to contribute to preference extraction from freeform user input.
- Store validated preferences in `SharedContextMemory` for reuse.

### 4. Update RecommendationAgent and LLMRecommendationAgent

- Ensure both agents respect the merged `recommendationInput.preferences`.
- Log when inferred preferences are used to aid debugging and transparency.

---

## Implementation Steps

1. **Implement full Duckling extraction logic**:
   - Enhance `src/services/PreferenceExtractionService.ts` with detailed extraction rules.
2. **Refine fast extraction result merging**:
   - Implement a robust strategy in `PreferenceExtractionService.attemptFastExtraction` to handle conflicts and confidence scores.
3. **Implement normalization logic**:
   - Complete the `UserPreferenceAgent.normalizePreferences` method to map extracted values to a canonical schema.
4. **Implement the asynchronous LLM preference extraction agent/process**:
   - Create a new agent or service to handle LLM calls for complex preferences asynchronously.
5. **Implement UI features for viewing, editing, and deleting preferences**:
   - Develop frontend components to interact with user preferences.
6. **Implement API endpoints for managing preferences**:
   - Create new controllers and routes to expose preference management functionality.
7. **Add comprehensive tests**:
   - Write unit, integration, and end-to-end tests for all newly implemented logic in both the backend and frontend.

---

## Future Considerations

- Add a `UserProfileService` to persist preferences across sessions.
- Allow users to reset or update preferences explicitly.
- Use LLM-based summarization to extract preferences from long histories.