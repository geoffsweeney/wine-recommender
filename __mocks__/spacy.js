// __mocks__/spacy.js

const mockMatcher = {
  add: jest.fn(),
  // Mock the Matcher call method
  // It should return an array of matches in the format [[match_id, start, end]]
  // For now, return an empty array
  __call__: jest.fn(() => []),
};

const mockNlp = {
  vocab: {
    strings: {
      // Mock vocab strings if needed for rule ID lookup
      // Example: 'WINE_TYPE': 1, 'SWEETNESS': 2
    },
  },
  // Mock the nlp call method
  // It should return a mock Doc object
  __call__: jest.fn((text) => ({
    text: text,
    // Add other mock Doc properties/methods as needed by the tests
    slice: jest.fn((start, end) => ({
      text: text.slice(start, end),
      // Add other mock Span properties/methods
    })),
    ents: [], // Mock entities
  })),
};

const spacy = {
  load: jest.fn(() => mockNlp),
  // Matcher is now exported separately
};

// Export the mock spacy object and the Matcher
module.exports = spacy;
module.exports.Matcher = jest.fn(() => mockMatcher); // Export Matcher separately