module.exports = {
  displayName: 'backend',
  testEnvironment: 'node',
  rootDir: '.',
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1',
    // Removed '^zod$': '<rootDir>/backend/__mocks__/zod.ts', to use real zod
    '^spacy$': '<rootDir>/../__mocks__/spacy.js',
    '^spacy/matcher$': '<rootDir>/../__mocks__/spacy.js',
    '^ts-jest$': '<rootDir>/../node_modules/ts-jest',
    '^../../di/Types$': '<rootDir>/di/Types.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest', 
      {
        tsconfig: 'tsconfig.test.json'
      }
    ]
  },
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  setupFiles: ['<rootDir>/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  coverageDirectory: '<rootDir>/coverage',
}
