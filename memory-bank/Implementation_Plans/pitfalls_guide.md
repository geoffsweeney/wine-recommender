## Wine Recommendation System: Common Pitfalls Guide

### Node.js Implementation Issues
**Symptoms**:
- Memory leaks in long-running processes
- Context loss in async operations
- Unhandled promise rejections
- Configuration validation failures

**Solutions**:
- Use DI container for all dependencies
- Implement proper async context propagation
- Centralize error handling middleware
- Validate all configuration on startup

### Dependency Injection Problems
**Symptoms**:
- Circular dependency errors
- Incorrect scoping (singleton vs request)
- Over-injected dependencies
- Test mocking difficulties

**Solutions**:
- Review DI container configuration
- Use interface-based injection
- Implement proper scoping
- Create test-specific DI configurations

## Wine Recommendation System: Common Pitfalls Guide

### Quality Gate Issues
**Symptoms**:
- Recommendations failing quality checks
- High rate of fallback activations
- Low confidence scores

**Solutions**:
- Adjust confidence thresholds gradually
- Add detailed logging for quality evaluations
- Review training data for recommendation models

### Circuit Breaker Triggers
**Symptoms**:
- Frequent fallback activations  
- Inconsistent API response times
- Service degradation

**Solutions**:
- Review failure threshold configurations
- Check dependency service health
- Implement progressive backoff

### Phase Transition Problems  
**Symptoms**:
- Stuck in certain phases
- Premature phase advancement
- Missing phase data

**Solutions**:
- Verify all entry/exit criteria
- Add phase timeout safeguards
- Implement phase validation checks

### Performance Bottlenecks
**Symptoms**:
- Slow recommendation generation
- High CPU/memory usage
- Timeout errors

**Solutions**:
- Profile agent performance
- Optimize expensive operations
- Scale horizontally if needed

### Agent Communication Pitfalls
**Symptoms**:
- "No callback found" warnings in logs
- Broken request-response cycles between agents
- Unexpected behavior in agent interactions

**Solutions**:
- Ensure correct `correlationId` and `conversationId` propagation.
- Avoid redundant `this.communicationBus.sendResponse()` calls within agent handlers; let the `EnhancedAgentCommunicationBus` handle responses based on returned `Result` objects.
- For "fire and forget" messages (sent via `publishToAgent`), ensure handlers return `Result<null, AgentError>` to prevent "No callback found" warnings.
- Refer to [Agent Communication Refactoring Plan](agent_communication_refactor.md) for detailed best practices.