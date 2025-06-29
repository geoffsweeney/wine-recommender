# Implementation Plan: Grape Variety API Enhancement (Revised)

## Objective:
Enhance the `/api/recommendations` endpoint response to include grape variety information (with percentages) for primary and alternative wine recommendations, solely relying on the LLM agent for this data. This addresses the failing end-to-end test and improves user experience.

## Current Status:
*   `backend/services/models/Wine.ts` updated with `GrapeVariety` interface and `grapeVarieties` in `Wine` interface.
*   `backend/types.ts` updated with `grapeVarieties` in `WineNode` interface and import for `GrapeVariety`.
*   *Neo4j changes to `backend/services/Neo4jWineRepository.ts` for grape varieties will be reverted.*
*   `backend/core/agents/LLMRecommendationAgent.ts` updated with `WineRecommendationOutput` interface, `LLMRecommendationResponsePayload` interface, and `EnhancedRecommendationSchema` to reflect the new structure.

## Remaining Tasks:

1.  **Revert Neo4j Changes:**
    *   Revert modifications to `backend/services/Neo4jWineRepository.ts` that added `grapeVarieties` to `getAllWines`, `searchWines`, and `getWineById` queries. (This will be done in `code` mode later).

2.  **Update `LLMRecommendationAgent.ts` Examples and Instructions (LLM as Source):**
    *   Modify `buildExamplesSection()` to use the new JSON output format with grape varieties and *explicitly include percentages*, even if estimated.
    *   Modify `buildOutputInstructions()` to explicitly instruct the LLM to provide grape varieties with percentages, estimating percentages if not explicitly known.

3.  **Adjust Agent Logic to Construct New Response (LLM as Source):**
    *   Review `LLMRecommendationAgent.ts` to ensure the `handleRecommendationRequest` method correctly populates the `recommendations` and `alternatives` with the new `name` and `grapeVarieties` structure. This will involve parsing the LLM's string output into the structured `WineRecommendationOutput` objects and *estimating percentages if the LLM does not provide them*.

4.  **Update End-to-End Tests:**
    *   Modify `backend/api/__tests__/e2e_live_recommendations.test.ts` to assert the new object structure for `primaryRecommendation` and `alternatives`, including `grapeVarieties` and their percentages.