module.exports = {
  displayName: 'frontend',
  testEnvironment: 'jsdom',
  rootDir: '.',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Updated to point to src
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript',
        '@babel/preset-react'
      ],
      // Explicitly set tsconfig path relative to this jest config file
      tsconfig: 'tsconfig.test.json' 
    }],
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)', // Updated to point to src
    '<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)' // Updated to point to src
  ],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  // Removed setupFilesAfterEnv as jest.setup.ts is missing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    '/node_modules/(?!@swc/helpers|@babel/runtime)/'
  ],
  coverageDirectory: '<rootDir>/coverage',
};
