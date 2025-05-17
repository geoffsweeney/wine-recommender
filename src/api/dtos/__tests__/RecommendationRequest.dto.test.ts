import { RecommendationRequest } from '../RecommendationRequest.dto';

describe('RecommendationRequest DTO', () => {
  it('should validate a request with conversation history', () => {
    const validRequestWithHistory = {
      userId: 'test-user',
      input: {
        preferences: {
          wineType: 'red',
        },
      },
      conversationHistory: [
        { role: 'user', content: 'I like red wine' },
        { role: 'assistant', content: 'Great choice!' },
      ],
    };

    const result = RecommendationRequest.safeParse(validRequestWithHistory);
    expect(result.success).toBe(true);
  });

  it('should validate a request without conversation history', () => {
    const validRequestWithoutHistory = {
      userId: 'test-user',
      input: {
        preferences: {
          wineType: 'white',
        },
      },
    };

    const result = RecommendationRequest.safeParse(validRequestWithoutHistory);
    expect(result.success).toBe(true);
  });

  it('should reject a request with invalid conversation history format', () => {
    const invalidRequestHistory = {
      userId: 'test-user',
      input: {
        preferences: {
          wineType: 'red',
        },
      },
      conversationHistory: [
        { role: 'user', content: 'Turn 1' },
        { role: 'bot', message: 'Invalid turn' }, // Invalid role and property name
      ],
    };

    const result = RecommendationRequest.safeParse(invalidRequestHistory);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.errors.map(error => error.message);
      expect(errorMessages).toContain("Invalid enum value. Expected 'user' | 'assistant', received 'bot'");
      expect(errorMessages).toContain("Required"); // Expect error for missing 'content'
    }
  });

  it('should reject a request with invalid role in conversation history', () => {
    const invalidRequestRole = {
      userId: 'test-user',
      input: {
        preferences: {
          wineType: 'red',
        },
      },
      conversationHistory: [
        { role: 'invalid_role', content: 'Turn 1' }, // Invalid role
      ],
    };

    const result = RecommendationRequest.safeParse(invalidRequestRole);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.errors.map(error => error.message);
      expect(errorMessages).toContain("Invalid enum value. Expected 'user' | 'assistant', received 'invalid_role'");
    }
  });

  it('should reject a request with missing content in conversation history turn', () => {
    const invalidRequestMissingContent = {
      userId: 'test-user',
      input: {
        preferences: {
          wineType: 'red',
        },
      },
      conversationHistory: [
        { role: 'user' }, // Missing content
      ],
    };

    const result = RecommendationRequest.safeParse(invalidRequestMissingContent);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.errors.map(error => error.message);
      expect(errorMessages).toContain("Required");
    }
  });
});