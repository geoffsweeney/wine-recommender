# Sommelier Agent Orchestration Logic - Detailed Explanation

## Overview of Orchestration

The Sommelier Agent acts as the **conductor of an orchestra** - it doesn't play every instrument, but it coordinates when each agent "plays" and ensures they work together harmoniously to create the final recommendation.

## Core Orchestration Principles

### 1. State-Driven Coordination
The orchestrator maintains a conversation state that tracks:
- What information has been gathered
- Which agents have responded
- What decisions are pending
- User feedback and preferences

### 2. Phase-Based Execution
The process is broken into distinct phases that can run sequentially or in parallel based on dependencies.

### 3. Dynamic Decision Making
The orchestrator makes real-time decisions about which agents to involve based on the current state and requirements.

## Detailed Orchestration Flow

### Phase 1: Information Gathering (Parallel Execution)

```javascript
class SommelierAgent {
  async orchestrateRecommendation(userInput, conversationId) {
    // Initialize conversation state
    const state = this.initializeConversationState(userInput, conversationId);
    
    // PARALLEL EXECUTION - Both agents work simultaneously
    console.log("🎭 Phase 1: Gathering information in parallel...");
    
    const [validationPromise, preferencePromise] = [
      this.sendMessage('InputValidation', MessageTypes.VALIDATE_INPUT, userInput),
      this.sendMessage('Preference', MessageTypes.GET_PREFERENCES, userInput)
    ];

    // Wait for both to complete
    const [validationResult, preferenceResult] = await Promise.all([
      validationPromise,
      preferencePromise
    ]);

    // Update state with results
    state.validatedIngredients = validationResult.validIngredients;
    state.userPreferences = preferenceResult.preferences;
    state.phase = 'VALIDATION_COMPLETE';
  }
}
```

**Why Parallel?** These operations are independent - validating ingredients doesn't require knowing user preferences, and vice versa. Running them in parallel reduces total execution time.

### Phase 2: Conditional Logic & Decision Making

```javascript
async orchestrateRecommendation(userInput, conversationId) {
  // ... Phase 1 code above ...

  console.log("🎭 Phase 2: Making decisions based on gathered data...");

  // CONDITIONAL LOGIC - Orchestrator makes decisions
  if (validationResult.hasInvalidIngredients) {
    console.log("⚠️ Invalid ingredients detected, consulting Fallback Agent...");
    
    const fallbackResult = await this.sendMessage('Fallback', 
      MessageTypes.FALLBACK_REQUEST, 
      { 
        invalidIngredients: validationResult.invalidIngredients,
        validIngredients: validationResult.validIngredients 
      }
    );
    
    // Decision: Should we proceed or ask user for clarification?
    if (fallbackResult.confidence < 0.7) {
      return this.requestUserClarification(conversationId, fallbackResult);
    }
    
    // Update state with fallback suggestions
    state.ingredients = [...validationResult.validIngredients, ...fallbackResult.suggestedIngredients];
  }

  // BUDGET VALIDATION
  if (this.isBudgetRealistic(state.ingredients, userInput.budget)) {
    console.log("💰 Budget seems appropriate for ingredients");
  } else {
    console.log("💸 Budget mismatch detected, adjusting expectations...");
    
    const budgetAdjustment = await this.sendMessage('Preference', 
      MessageTypes.ADJUST_BUDGET_EXPECTATIONS, 
      { ingredients: state.ingredients, budget: userInput.budget }
    );
    
    state.budgetStrategy = budgetAdjustment.strategy; // 'value_focused' or 'premium_alternatives'
  }
}
```

**Key Orchestration Decision**: The Sommelier Agent evaluates results and decides the next course of action rather than blindly following a fixed sequence.

### Phase 3: Recommendation Generation (Sequential with Feedback Loop)

```javascript
async orchestrateRecommendation(userInput, conversationId) {
  // ... Previous phases ...

  console.log("🎭 Phase 3: Generating recommendations...");

  let recommendationAttempt = 0;
  const maxAttempts = 3;
  let recommendations;

  // ITERATIVE REFINEMENT LOOP
  while (recommendationAttempt < maxAttempts) {
    console.log(`🔄 Recommendation attempt ${recommendationAttempt + 1}`);

    const recommendationRequest = {
      validatedIngredients: state.ingredients,
      userPreferences: state.userPreferences,
      budget: userInput.budget,
      budgetStrategy: state.budgetStrategy,
      previousAttempts: state.previousRecommendations || []
    };

    recommendations = await this.sendMessage(
      'Recommendation', 
      MessageTypes.GENERATE_RECOMMENDATIONS, 
      recommendationRequest
    );

    // QUALITY CHECK - Orchestrator evaluates recommendation quality
    const qualityScore = this.evaluateRecommendationQuality(recommendations, state);
    
    if (qualityScore > 0.8) {
      console.log("✅ High quality recommendations generated");
      break;
    } else if (qualityScore > 0.6) {
      console.log("⚠️ Moderate quality, checking if we can improve...");
      
      // Ask Recommendation Agent to refine
      const refinementSuggestions = await this.sendMessage(
        'Recommendation',
        MessageTypes.REFINE_RECOMMENDATIONS,
        { 
          currentRecommendations: recommendations,
          qualityIssues: this.identifyQualityIssues(recommendations, state)
        }
      );
      
      recommendations = refinementSuggestions.improvedRecommendations;
      break;
    } else {
      console.log("❌ Low quality recommendations, trying different approach...");
      
      // Store failed attempt
      state.previousRecommendations = state.previousRecommendations || [];
      state.previousRecommendations.push(recommendations);
      
      recommendationAttempt++;
    }
  }

  // FALLBACK IF ALL ATTEMPTS FAIL
  if (recommendationAttempt >= maxAttempts) {
    console.log("🆘 All recommendation attempts failed, using fallback...");
    recommendations = await this.sendMessage('Fallback', 
      MessageTypes.EMERGENCY_RECOMMENDATIONS, 
      state
    );
  }

  state.recommendations = recommendations;
  state.phase = 'RECOMMENDATIONS_READY';
}
```

**Key Orchestration Features**:
- **Quality Gates**: Orchestrator evaluates each recommendation
- **Retry Logic**: Attempts refinement before giving up
- **Fallback Strategy**: Has a backup plan when primary agents fail

### Phase 4: Shopping & Availability (Parallel with Prioritization)

```javascript
async orchestrateRecommendation(userInput, conversationId) {
  // ... Previous phases ...

  console.log("🎭 Phase 4: Finding available wines...");

  const wineRecommendations = state.recommendations.wines;
  
  // PRIORITIZED PARALLEL SHOPPING
  // Start with top recommendations, but search others in parallel
  const shoppingPromises = wineRecommendations.map((wine, index) => 
    this.sendMessage('Shopper', MessageTypes.FIND_WINES, {
      wine: wine,
      budget: userInput.budget,
      priority: index, // Lower number = higher priority
      maxResults: index === 0 ? 10 : 5 // More options for top recommendation
    })
  );

  // Wait for all shopping results
  const shoppingResults = await Promise.all(shoppingPromises);

  // INTELLIGENT RESULT PROCESSING
  const availableOptions = this.processShoppingResults(shoppingResults, state);

  if (availableOptions.length === 0) {
    console.log("😱 No wines available! Expanding search...");
    
    // ESCALATION STRATEGY - Broaden search criteria
    const expandedSearch = await this.sendMessage('Shopper', 
      MessageTypes.EXPANDED_SEARCH, 
      {
        originalCriteria: state.recommendations,
        budget: userInput.budget * 1.2, // Slight budget flexibility
        alternativeVarietals: true
      }
    );
    
    availableOptions.push(...expandedSearch.wines);
  }

  state.availableWines = availableOptions;
  state.phase = 'SHOPPING_COMPLETE';

  // FINAL RECOMMENDATION ASSEMBLY
  return this.finalizeRecommendation(state);
}
```

### Phase 5: Final Assembly & Presentation

```javascript
async finalizeRecommendation(state) {
  console.log("🎭 Phase 5: Assembling final recommendation...");

  // RANKING ALGORITHM - Orchestrator applies final logic
  const rankedOptions = this.rankWineOptions(state.availableWines, {
    userPreferences: state.userPreferences,
    ingredientMatch: state.recommendations.scores,
    priceValue: true,
    availability: true
  });

  // EXPLANATION GENERATION
  const explanation = await this.generateExplanation(
    rankedOptions[0], // Top recommendation
    state.ingredients,
    state.userPreferences
  );

  // CONFIDENCE SCORING
  const confidence = this.calculateConfidence(state);

  // FINAL RECOMMENDATION OBJECT
  const finalRecommendation = {
    primaryRecommendation: rankedOptions[0],
    alternatives: rankedOptions.slice(1, 4),
    explanation: explanation,
    confidence: confidence,
    conversationId: state.conversationId,
    canRefine: confidence < 0.9 // Offer refinement if not highly confident
  };

  // LEARNING - Update preferences based on recommendation
  this.sendMessage('Preference', MessageTypes.UPDATE_RECOMMENDATION_HISTORY, {
    userId: state.userId,
    recommendation: finalRecommendation,
    context: state
  });

  return finalRecommendation;
}
```

## State Management Deep Dive

### Conversation State Structure

```javascript
class ConversationState {
  constructor(userInput, conversationId) {
    this.conversationId = conversationId;
    this.userId = userInput.userId;
    this.timestamp = Date.now();
    this.phase = 'INITIALIZED';
    
    // Input tracking
    this.originalInput = userInput;
    this.ingredients = userInput.ingredients;
    this.budget = userInput.budget;
    
    // Agent responses
    this.agentResponses = new Map();
    this.validatedIngredients = null;
    this.userPreferences = null;
    this.recommendations = null;
    this.availableWines = null;
    
    // Decision tracking
    this.decisions = [];
    this.errors = [];
    this.refinementAttempts = 0;
    
    // Quality metrics
    this.confidence = 0;
    this.qualityScore = 0;
  }

  addDecision(decision, reasoning, agent) {
    this.decisions.push({
      timestamp: Date.now(),
      decision,
      reasoning,
      agent,
      phase: this.phase
    });
  }

  recordAgentResponse(agentName, response, duration) {
    this.agentResponses.set(agentName, {
      response,
      duration,
      timestamp: Date.now(),
      phase: this.phase
    });
  }
}
```

## Error Handling & Recovery

### Circuit Breaker Integration

```javascript
class SommelierAgent {
  constructor() {
    this.circuitBreakers = new Map();
    
    // Create circuit breakers for each agent
    ['InputValidation', 'Preference', 'Recommendation', 'Shopper', 'Fallback'].forEach(agent => {
      this.circuitBreakers.set(agent, new CircuitBreaker({
        failureThreshold: 3,
        timeout: 30000,
        fallbackFunction: this.getAgentFallback(agent)
      }));
    });
  }

  async sendMessage(agentName, messageType, payload) {
    const circuitBreaker = this.circuitBreakers.get(agentName);
    
    return circuitBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        const response = await this.sendMessageToAgent(agentName, messageType, payload);
        const duration = Date.now() - startTime;
        
        console.log(`✅ ${agentName} responded in ${duration}ms`);
        return response;
        
      } catch (error) {
        console.error(`❌ ${agentName} failed: ${error.message}`);
        throw error;
      }
    });
  }

  getAgentFallback(agentName) {
    const fallbacks = {
      'InputValidation': () => ({ validIngredients: [], invalidIngredients: [] }),
      'Preference': () => ({ preferences: this.getDefaultPreferences() }),
      'Recommendation': () => ({ wines: this.getGenericRecommendations() }),
      'Shopper': () => ({ wines: [] }),
      'Fallback': () => ({ suggestions: [] })
    };
    
    return fallbacks[agentName] || (() => ({}));
  }
}
```

## Real-World Example Walkthrough

Let's trace through a complete orchestration:

```javascript
// User Input: "I'm making beef bourguignon with mushrooms and pearl onions, budget $30"

// Phase 1 (Parallel - 2 seconds total):
// ├── InputValidation Agent (1.2s): ✅ All ingredients valid
// └── Preference Agent (1.8s): ✅ User likes bold reds, Burgundy region

// Phase 2 (Sequential - 0.5 seconds):
// └── Sommelier Decision: ✅ Proceed with premium French red focus

// Phase 3 (Iterative - 4 seconds total):
// ├── Recommendation Agent Attempt 1 (2s): Suggests Burgundy ($50+) - ❌ Over budget
// ├── Sommelier Decision: Budget mismatch detected
// ├── Recommendation Agent Attempt 2 (2s): Suggests Côtes du Rhône ($25-35) - ✅ Good match

// Phase 4 (Parallel - 3 seconds):
// ├── Shopper searches Côtes du Rhône (2.1s): ✅ Found 8 options
// └── Shopper searches backup Languedoc (2.8s): ✅ Found 5 options

// Phase 5 (Assembly - 1 second):
// └── Final ranking and explanation generation

// Total time: ~10.5 seconds
// Result: Confident recommendation with alternatives
```

## Key Orchestration Benefits

1. **Resilience**: Circuit breakers and fallbacks prevent total failure
2. **Efficiency**: Parallel execution where possible, sequential where necessary
3. **Quality**: Multiple quality gates and refinement opportunities
4. **Learning**: State tracking enables continuous improvement
5. **Flexibility**: Dynamic decision-making based on intermediate results

The orchestration logic essentially transforms a complex multi-agent system into a reliable, efficient recommendation engine that can handle real-world complexity and edge cases while maintaining high quality output.
