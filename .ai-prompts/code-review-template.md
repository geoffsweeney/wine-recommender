# CODE REVIEW TEMPLATE

### Review Context
**Change Type**: [Feature/Bugfix/Refactor]
**PR Link**: [GitHub/GitLab URL]
**Author**: [Team Member]
**Reviewer**: [Your Name]

### Architecture Assessment
**Pattern Compliance**:
- [ ] Follows established architecture patterns
- [ ] Proper separation of concerns
- [ ] Appropriate abstraction levels

**Code Organization**:
- [ ] Logical file structure
- [ ] Reasonable module boundaries
- [ ] Clear dependency management

### Code Quality Checklist
```typescript
// Example code being reviewed
class ReviewedComponent {
  // Check for:
  // [ ] Clear naming
  // [ ] Proper typing
  // [ ] Single responsibility
  // [ ] Appropriate complexity
}
```

**Documentation**:
- [ ] API documentation present
- [ ] Complex logic explained
- [ ] TODOs documented

### Testing Evaluation
**Test Coverage**:
- [ ] Happy paths covered
- [ ] Error cases covered
- [ ] Edge cases considered

**Test Quality**:
- [ ] Tests are deterministic
- [ ] Proper test isolation
- [ ] Meaningful assertions

### Security Review
- [ ] Input validation
- [ ] Output encoding
- [ ] Authentication checks
- [ ] Authorization checks
- [ ] Data protection

### Performance Considerations
- [ ] Algorithm complexity
- [ ] Database queries
- [ ] Memory usage
- [ ] Network calls

### Suggested Improvements
1. [Improvement 1 with rationale]
2. [Improvement 2 with rationale]
3. [Improvement 3 with rationale]

### Review Outcome
```yaml
review-result:
  approval-status: "approved-with-changes"
  required-changes:
    - "Fix security vulnerability in input validation"
    - "Add missing test cases for error scenarios"
  follow-up-actions:
    - "Schedule performance testing"
    - "Update architecture diagram"