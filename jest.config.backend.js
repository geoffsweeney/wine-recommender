module.exports = {
  displayName: 'backend',
  testEnvironment: 'node',
  rootDir: '.',
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/backend/$1',
    '^@tests/(.*)$': '<rootDir>/backend/__tests__/$1',
    '^spacy$': '<rootDir>/__mocks__/spacy.js',
    '^spacy/matcher$': '<rootDir>/__mocks__/spacy.js',
    '^ts-jest$': '<rootDir>/node_modules/ts-jest',
  },
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
    '^spacy$': '<rootDir>/__mocks__/spacy.js',
    '^spacy/matcher$': '<rootDir>/__mocks__/spacy.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  setupFiles: ['<rootDir>/backend/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/backend/test-setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  coverageDirectory: '<rootDir>/coverage',
}
