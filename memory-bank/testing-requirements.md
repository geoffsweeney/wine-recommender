# Testing Requirements

## Test Configuration Best Practices

### Timeout Management
- **Default Timeouts**: Always set appropriate default timeouts for test suites, especially for integration tests that may involve network calls, database operations, or complex business logic. A reasonable default is 30 seconds for integration tests.
- **Test-Specific Timeouts**: For tests that require more time due to external dependencies or complex operations, set individual timeouts using `jest.setTimeout()`.
- **Avoid Extremely Short Timeouts**: Be cautious of setting very short timeouts (e.g., 100ms) as they can cause tests to fail before they complete, leading to false negatives.

### Assertion Best Practices
- **Match Implementation Structure**: Ensure that test assertions match the actual implementation structure. When the implementation changes, update tests accordingly.
- **Use Flexible Matchers**: Utilize Jest's flexible matchers like `expect.any(String)`, `expect.objectContaining()`, and `expect.arrayContaining()` to handle dynamic values in test assertions.
- **Examine Implementation**: When debugging assertion mismatches, examine the actual implementation to understand the exact structure being produced.

### Mocking Strategies
- **Real vs Mock Dependencies**: Balance the use of real components vs mocks. Using real controller instances can ensure test behavior matches the actual implementation, but requires careful dependency setup.
- **Mock Behavior**: Ensure mocks behave as closely as possible to real components, including returning objects with the same structure and properties.
- **Dependency Injection**: Use dependency injection frameworks (like tsyringe) to properly set up dependencies for tests.

### Debugging Test Failures
- **Systematic Approach**: When debugging test failures, start with obvious issues (like timeouts) and work through more complex problems systematically.
- **Iterative Testing**: Make incremental changes to tests and rerun them to isolate and fix issues.
- **Logging**: Use console logs or debugging tools to inspect the actual values being tested when assertions fail.

### Documentation
- **Update Documentation**: Document lessons learned from debugging exercises to improve future development and testing practices.
- **Maintain Test Expectations**: Keep test expectations in sync with implementation changes through code reviews and documentation updates.

## Example: Integration Test Configuration

```typescript
describe('Admin Conversational Flow Integration Tests', () => {
  jest.setTimeout(30000); // Set default timeout to 30 seconds

  // Test cases...
});
```

By following these best practices, we can ensure our tests are reliable, maintainable, and provide accurate feedback about the system's behavior.
