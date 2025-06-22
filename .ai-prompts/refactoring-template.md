# REFACTORING TEMPLATE

### Refactoring Identification
**Component Name**: [Component being refactored]
**Current Version**: [Current implementation version]
**Motivation**: [Reason for refactoring - performance, maintainability, etc.]

### Technical Context
**Current Architecture**:
```typescript
// Current implementation example
class LegacyComponent {
  private state: any;
  
  process(input: any): any {
    // Complex legacy logic
  }
}
```

**Problems Identified**:
1. [Issue 1]
2. [Issue 2]
3. [Issue 3]

### Refactoring Plan
**New Architecture**:
```typescript
// Proposed new implementation
interface RefactoredComponent {
  process(input: ValidatedInput): Promise<StandardOutput>;
  getMetrics(): ComponentMetrics;
}

class NewComponent implements RefactoredComponent {
  constructor(
    private dependencies: ComponentDeps,
    private config: ComponentConfig
  ) {}
  
  async process(input: ValidatedInput): Promise<StandardOutput> {
    // New cleaner implementation
  }
}
```

**Migration Strategy**:
1. [Step 1 - Initial compatibility layer]
2. [Step 2 - Gradual migration]
3. [Step 3 - Final cleanup]

### Testing Approach
**Backward Compatibility**:
- [ ] Verify old inputs still work
- [ ] Compare outputs between versions

**Performance Benchmarks**:
- [ ] Before refactoring metrics
- [ ] After refactoring metrics

**Error Handling**:
- [ ] Legacy error cases
- [ ] New error cases

### Documentation Updates
- [ ] API changes
- [ ] Migration guide
- [ ] Deprecation notices

### Rollout Plan
```yaml
# REQUIRED: Gradual rollout configuration
refactored-component:
  rollout-percentage: 10%
  health-checks:
    - error-rate < 1%
    - latency < 200ms
  rollback-conditions:
    - error-rate > 5%
    - critical-bugs > 0