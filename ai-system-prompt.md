# WINE RECOMMENDATION AI DEVELOPMENT SYSTEM PROMPT

## ABSOLUTE REQUIREMENTS (NON-NEGOTIABLE)
1. **Code Analysis First**: Always analyze existing patterns before implementation
2. **TypeScript Strict**: All code must use strict TypeScript typing
3. **Error Handling**: Mandatory Result<T, E> pattern for all functions
4. **Testing**: 95%+ test coverage required for all new code
5. **Documentation**: JSDoc for all public methods and types
6. **Performance**: Meet strict latency benchmarks (API < 300ms p99)
7. **Security**: Zod schema validation for all inputs/outputs
8. **Logging**: Structured logs with correlation IDs
9. **Integration**: Seamless compatibility with existing agents
10. **Backward Compatibility**: Versioned API changes only

## ARCHITECTURE IMPERATIVES
```typescript
// REQUIRED: Base agent implementation
abstract class WineAgent {
  constructor(
    protected config: AgentConfig,
    protected logger: StructuredLogger,
    protected metrics: MetricsCollector,
    protected wineData: WineDataService
  ) {}

  // Mandatory message handling
  abstract handleMessage(
    message: AgentMessage<WineRequest>
  ): Promise<Result<WineResponse, AgentError>>;

  // Standard validation
  protected validateRequest(
    input: unknown
  ): Result<ValidatedWineRequest, ValidationError> {
    return wineRequestSchema.safeParse(input);
  }
}
```

## QUALITY GATES
```yaml
quality_checks:
  typescript:
    strict: true
    no_implicit_any: true
  testing:
    coverage: 95%
    types: [unit, integration, performance]
  linting:
    eslint: error
    prettier: error
  security:
    zod_validation: required
    input_sanitization: required
  performance:
    api_latency: <300ms
    db_query: <100ms
```

## IMPLEMENTATION WORKFLOW
1. **Pre-Coding**:
   - Analyze existing agent implementations
   - Identify reuse opportunities
   - Document integration points
   - Plan test strategy

2. **Development**:
   - Follow strict TypeScript patterns
   - Implement with Result<T,E> error handling
   - Include correlation IDs in all logs
   - Write tests concurrently

3. **Validation**:
   - Pass all quality gates
   - Verify performance benchmarks
   - Confirm backward compatibility
   - Document all changes

## WINE-SPECIFIC PATTERNS
```typescript
// Standard wine recommendation response
interface WineRecommendation {
  wineId: string;
  name: string;
  vintage: number;
  priceRange: [number, number];
  pairingScore: number;
  explanation: string;
  alternatives: WineRecommendation[];
}

// Error handling pattern
type WineAgentError =
  | { type: 'validation'; details: ZodIssue[] }
  | { type: 'wine_data'; sourceError: Error }
  | { type: 'pricing'; code: number };