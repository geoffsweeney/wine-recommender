module.exports = {
  projects: [
    '<rootDir>/jest.config.backend.js',
    '<rootDir>/jest.config.frontend.js'
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'backend/**/*.{ts,tsx}',
    'frontend/wine-recommender/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  testTimeout: 10000,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results' }]
  ]
}
