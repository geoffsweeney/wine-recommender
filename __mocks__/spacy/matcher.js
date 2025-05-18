// __mocks__/spacy/matcher.js

class Matcher {
  constructor(vocab) {
    this.vocab = vocab;
    this.rules = new Map();
  }

  add(key, patterns) {
    this.rules.set(key, patterns);
  }

  // Mock the Matcher call method
  // It should return an array of matches in the format [[match_id, start, end]]
  // For now, return an empty array
  __call__(doc) {
    console.log('MockMatcher called with doc:', doc.text);
    // Basic mock matching logic (can be expanded)
    const matches = [];
    // Example: If a rule for 'WINE_TYPE' exists and the input text contains 'red', 'white', etc.
    // This is a simplified example; real matching would be more complex.
    if (this.rules.has('WINE_TYPE')) {
      const wineTypePatterns = this.rules.get('WINE_TYPE');
      for (const pattern of wineTypePatterns) {
        // Simplified pattern matching: check if any token lower case matches
        for (const token of doc.text.toLowerCase().split(' ')) { // Basic tokenization
          if (pattern.some(p => p.LOWER === token)) {
             // Add a mock match [match_id, start, end]
             // Need to map string rule ID back to a number if used in the actual code
             // For now, use a placeholder match_id
             matches.push([1, doc.text.toLowerCase().indexOf(token), doc.text.toLowerCase().indexOf(token) + token.length]);
             // Break after finding one match for simplicity
             break;
          }
        }
      }
    }
     // TODO: Add mock matching logic for other rule IDs like 'SWEETNESS'

    return matches;
  }
}

module.exports = { Matcher };