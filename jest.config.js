module.exports = {
  rootDir: '.', // Set rootDir to the project root
  projects: [
    '<rootDir>/backend/jest.config.js',
    '<rootDir>/frontend/with-typescript-app/jest.config.js'
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'backend/**/*.{ts,tsx}',
    'frontend/with-typescript-app/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  testTimeout: 10000,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results' }]
  ]
}
