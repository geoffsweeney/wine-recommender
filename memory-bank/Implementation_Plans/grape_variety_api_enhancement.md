# Implementation Plan: Grape Variety API Enhancement (Revised)

## Objective:
Enhance the `/api/recommendations` endpoint response to include grape variety information (with percentages) for primary and alternative wine recommendations, solely relying on the LLM agent for this data. This addresses the failing end-to-end test and improves user experience.

## Completed Tasks:
*   `backend/services/models/Wine.ts` updated with `GrapeVariety` interface and `grapeVarieties` in `Wine` interface.
*   `backend/types.ts` updated with `grapeVarieties` in `WineNode` interface and import for `GrapeVariety`.
*   Neo4j changes to `backend/services/Neo4jWineRepository.ts` for grape varieties were reverted as per the decision to use LLM as the sole source.
*   `backend/core/agents/LLMRecommendationAgent.ts` updated with `WineRecommendationOutput` interface, `LLMRecommendationResponsePayload` interface, and `EnhancedRecommendationSchema` to reflect the new structure.
*   `LLMRecommendationAgent.ts`'s `buildExamplesSection()` and `buildOutputInstructions()` were modified to instruct the LLM to provide grape varieties with percentages.
*   `LLMRecommendationAgent.ts`'s `handleRecommendationRequest` method was adjusted to correctly populate `recommendations` and `alternatives` with the new `name` and `grapeVarieties` structure, including estimating percentages.
*   `backend/api/__tests__/e2e_live_recommendations.test.ts` was updated to assert the new object structure for `primaryRecommendation` and `alternatives`, including `grapeVarieties` and their percentages.
*   `backend/core/agents/SommelierCoordinator.ts` was updated to correctly handle `WineRecommendationOutput` objects and ensure grape varieties are passed through to the final API response.
*   `backend/types/agent-outputs.ts` was updated with `FinalRecommendationPayload` interface to reflect the final API response structure.

## Summary of Changes:

The `/api/recommendations` endpoint now returns wine recommendations with a richer data structure. The `primaryRecommendation` and `alternatives` fields are no longer simple strings (wine names). Instead, they are objects with the following structure:

```typescript
interface WineRecommendationOutput {
  name: string; // The brand name or general wine name
  grapeVarieties?: { name: string; percentage?: number }[]; // An array of grape varieties with optional percentages
}
```

This enhancement allows for more detailed and accurate wine recommendations, directly addressing the requirements of the end-to-end tests and improving the information provided to the user. All grape variety information is sourced directly from the LLM, with Neo4j integration deferred for future enhancements.