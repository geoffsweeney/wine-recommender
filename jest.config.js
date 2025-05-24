module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json'
      }
    ]
  },
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/backend/$1',
    '^@tests/(.*)$': '<rootDir>/backend/__tests__/$1',
    '^spacy$': '<rootDir>/__mocks__/spacy.js', // Map spacy to a mock file
    '^spacy/matcher$': '<rootDir>/__mocks__/spacy.js', // Map spacy/matcher to the base mock file
  },
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/backend/test-setup.ts'],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node', 'd.ts']
}
